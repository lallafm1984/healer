"""Publish reviewed candidates only when every combat sound passed screening."""
import hashlib
import json
from pathlib import Path
import shutil
import sys
import numpy as np
import soundfile as sf
from combat_quality import db, read_wav


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None


def main():
    manifest = Path(sys.argv[1]).resolve()
    root = Path(__file__).resolve().parents[2]
    specs = json.loads(manifest.read_text(encoding="utf-8"))
    report = json.loads((manifest.parent / "screening.json").read_text(encoding="utf-8"))
    if report["retry"] or set(report["selected"]) != {s["name"] for s in specs}:
        raise RuntimeError("Incomplete screening: refusing to publish a partial pack")
    staging = manifest.parent / "selected"
    staging.mkdir(exist_ok=True)
    records = []
    for spec in specs:
        name = spec["name"]
        source = report["selected"][name]
        candidate = next(c for c in report["candidates"] if c["source"] == source)
        if candidate["screening"] != "pass":
            raise RuntimeError(f"Selected rejected source: {source}")
        y, rate = read_wav(candidate["prepared"])
        out = staging / f"{name}.ogg"
        with sf.SoundFile(str(out), "w", rate, 1, format="OGG", subtype="VORBIS", compression_level=.35) as f:
            for i in range(0, len(y), 8192):
                f.write(y[i:i + 8192])
        decoded, decoded_rate = sf.read(out)
        if not np.isfinite(decoded).all() or np.max(np.abs(decoded)) >= .98 or decoded_rate != rate:
            raise RuntimeError(f"Encoded asset failed validation: {name}")
        destination = root / "src/sfx" / out.name
        metadata = (manifest.parent / source).with_suffix(".json")
        records.append({
            "name": name, "where": spec["where"], "source": source,
            "generation": json.loads(metadata.read_text(encoding="utf-8")) if metadata.exists()
                          else {"metadata": "not retained for the initial Agent Audio CLI pilot"},
            "source_sha256": digest(manifest.parent / source),
            "previous_sha256": digest(destination), "sha256": digest(out),
            "seconds": round(len(decoded) / decoded_rate, 3),
            "encoded_peak_db": round(db(np.max(np.abs(decoded))), 2),
            "metrics": candidate["metrics"], "semantic": candidate["semantic"],
            "candidates": [{"source": c["source"], "screening": c.get("screening", "reject"), "reasons": c["reasons"]}
                           for c in report["candidates"] if c["name"] == name],
        })
    # All validation precedes replacement. Originals remain available through git.
    for record in records:
        shutil.copyfile(staging / f'{record["name"]}.ogg', root / "src/sfx" / f'{record["name"]}.ogg')
    (root / "scripts/sfx/combat-review.json").write_text(json.dumps({
        "generator": "Agent Audio / Stable Audio 3 Medium, local TFLite CPU, 8 steps, CFG 1",
        "screening_method": report["method"], "screening_model": report["model"],
        "human_listening": "not performed", "sounds": records,
    }, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n")
    print(f"Published {len(records)} combat sounds", flush=True)


if __name__ == "__main__":
    main()
