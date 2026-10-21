"""Measure candidates and score acoustic descriptions with local CLAP.

Run in an environment with numpy, scipy, torch and transformers. Model weights
are an explicit local path; this script never uploads sound or downloads models.
The report labels model-assisted screening separately from human listening.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from combat_quality import prepare, read_wav, write_wav


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("manifest")
    ap.add_argument("--model", required=True)
    ap.add_argument("--names", nargs="*")
    args = ap.parse_args()
    manifest = Path(args.manifest).resolve()
    specs = json.loads(manifest.read_text(encoding="utf-8"))
    if args.names:
        specs = [s for s in specs if s["name"] in args.names]
    folder = manifest.parent
    prepared = folder / "review"
    prepared.mkdir(exist_ok=True)
    candidates = []
    for spec in specs:
        for source in sorted(folder.glob(f'{spec["name"]}-[0-9][0-9].wav')):
            entry = {"name": spec["name"], "source": source.name, "reasons": [], "match": spec["match"]}
            try:
                x, rate = read_wav(source)
                y, metrics, reasons = prepare(x, rate, spec["keep"])
                path = prepared / source.name
                write_wav(path, y, rate)
                entry.update(metrics=metrics, reasons=reasons, prepared=str(path))
            except ValueError as error:
                entry["reasons"].append(str(error))
            candidates.append(entry)
    if not candidates:
        raise RuntimeError("No generated candidates to review")

    # Reuse expensive semantic inference only for byte-identical prepared audio,
    # the same acoustic description and the same explicitly selected checkpoint.
    cache_path = folder / "semantic-cache.json"
    semantic_cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    for entry in candidates:
        if "prepared" in entry:
            entry["semantic_key"] = hashlib.sha256(
                Path(entry["prepared"]).read_bytes() + entry["match"].encode()
                + str(Path(args.model).resolve()).encode() + b"clap-screen-v1").hexdigest()
    import torch
    from scipy.signal import resample_poly
    from transformers import ClapModel, ClapProcessor
    torch.set_num_threads(2)
    # Eager sequential reading avoids very slow first-inference page faults on HDDs.
    model = ClapModel.from_pretrained(args.model, local_files_only=True, disable_mmap=True).eval()
    processor = ClapProcessor.from_pretrained(args.model, local_files_only=True)
    wrong = ["A person speaking words.", "A person singing a song.",
             "Continuous music with a melody and rhythm.", "Background room noise and static hiss.",
             "Traffic and engine noise.", "Birds chirping outdoors."]
    cache = {}
    for entry in candidates:
        if "prepared" not in entry:
            continue
        cached = semantic_cache.get(entry["semantic_key"])
        if cached:
            entry["semantic"] = cached["semantic"]
            entry["reasons"].extend(cached["reasons"])
            entry["rank_score"] = cached["rank_score"]
            entry["screening"] = "pass" if not entry["reasons"] else "reject"
            print(f'{entry["name"]} {entry["source"]}: {entry["screening"]} (unchanged audio, cached analysis)', flush=True)
            continue
        labels = [entry["match"], "A short fantasy video game sound effect."] + wrong
        key = entry["name"]
        with torch.inference_mode():
            if key not in cache:
                inputs = processor(text=labels, return_tensors="pt", padding=True, truncation=True)
                text = model.get_text_features(**inputs)
                if not isinstance(text, torch.Tensor): text = text.pooler_output
                cache[key] = torch.nn.functional.normalize(text, dim=-1)
            x, sr = read_wav(entry["prepared"])
            sound = resample_poly(x[:, 0], 160, 147).astype(np.float32) if sr == 44100 else x[:, 0].astype(np.float32)
            inputs = processor(audio=sound, sampling_rate=48000, return_tensors="pt", padding="pad")
            embedding = model.get_audio_features(**inputs)
            if not isinstance(embedding, torch.Tensor): embedding = embedding.pooler_output
            scores = (torch.nn.functional.normalize(embedding, dim=-1) @ cache[key].T)[0].tolist()
        entry["semantic"] = {"desired": round(scores[0], 4), "game_sfx": round(scores[1], 4),
                             "alternatives": dict(zip(wrong, [round(v, 4) for v in scores[2:]]))}
        unwanted = scores[2:4] + scores[5:] if entry["name"] in ("win", "lose") else scores[2:]
        semantic_reasons = []
        if scores[0] < .12:
            semantic_reasons.append("low acoustic-description match")
        if max(unwanted) > max(scores[:2]) + .025:
            semantic_reasons.append("unwanted sound class dominates")
        entry["reasons"].extend(semantic_reasons)
        entry["screening"] = "pass" if not entry["reasons"] else "reject"
        entry["rank_score"] = round(scores[0] - max(unwanted), 4)
        semantic_cache[entry["semantic_key"]] = {
            "semantic": entry["semantic"], "reasons": semantic_reasons, "rank_score": entry["rank_score"]}
        print(f'{entry["name"]} {entry["source"]}: {entry["screening"]} '
              f'match={scores[0]:.3f} tail={entry["metrics"]["tail_db"]} {entry["reasons"]}', flush=True)
    cache_path.write_text(json.dumps(semantic_cache, indent=2), encoding="utf-8")
    result = {
        "method": "Local CLAP description similarity + signal screening; not human listening or an artistic guarantee",
        "model": "laion/clap-htsat-unfused@8fa0f1c6d0433df6e97c127f64b2a1d6c0dcda8a",
        "candidates": candidates,
        "selected": {},
        "retry": [],
    }
    for spec in specs:
        passed = [e for e in candidates if e["name"] == spec["name"] and e.get("screening") == "pass"]
        if passed:
            result["selected"][spec["name"]] = max(passed, key=lambda e: e["rank_score"])["source"]
        else:
            result["retry"].append(spec["name"])
    report = folder / ("screening-partial.json" if args.names else "screening.json")
    report.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f'SELECTED {len(result["selected"])} / {len(specs)}, RETRY {len(result["retry"])}', flush=True)


if __name__ == "__main__":
    main()
