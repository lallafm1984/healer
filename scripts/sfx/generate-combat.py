"""Generate a resumable combat pack with the installed Agent Audio CPU runtime.

Run with Agent Audio's Python:
  python scripts/sfx/generate-combat.py --home <AGENT_AUDIO_HOME> --manifest <json>

The controller uses Agent Audio's readiness/provenance checks, environment and
exclusive generation lock. Three separate stages reuse the pinned upstream model
classes while keeping only one large model in memory. No installed
source, weights, inference parameters or user configuration is modified.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--home", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--round", type=int, default=1)
    ap.add_argument("--names", nargs="*")
    ap.add_argument("--kind", choices=["sfx", "music"], default="sfx")
    ap.add_argument("--profile", choices=["medium", "small-sfx"], default="medium",
                    help="Use a separate manifest folder for each model profile")
    ap.add_argument("--stage", choices=["text", "sample", "decode"])
    args = ap.parse_args()
    os.environ["AGENT_AUDIO_HOME"] = str(Path(args.home).resolve())
    manifest = Path(args.manifest).resolve()
    profile_path = manifest.parent / "generation-profile.json"
    if profile_path.exists():
        if json.loads(profile_path.read_text(encoding="utf-8"))["profile"] != args.profile:
            raise RuntimeError("Model profile differs from cached candidates; use a new manifest folder")
    elif args.profile != "medium" and any(manifest.parent.glob("*.npz")):
        raise RuntimeError("Unidentified cached candidates; use a new manifest folder for Small SFX")
    entries = json.loads(manifest.read_text(encoding="utf-8"))
    entries = [e for e in entries if not args.names or e["name"] in args.names]
    entries.sort(key=lambda e: e["gen"])  # Avoid repeated tensor reallocations.
    if all((manifest.parent / f'{e["name"]}-{args.round:02}.wav').exists() for e in entries):
        print(f"Round {args.round}: all {len(entries)} candidates already exist", flush=True)
        return
    if not args.stage:
        from agent_audio.runtime import (backend_ready, runtime_paths, runtime_python,
                                         runtime_environment, verify_upstream_checkout)
        from agent_audio.storage import file_lock
        if not backend_ready("tflite"):
            raise RuntimeError("Installed Agent Audio TFLite runtime is not ready")
        from agent_audio.profiles import PROFILES
        weights = Path(args.home) / "runtime/stable-audio-3/optimized/tflite/models/tflite"
        for relative in PROFILES[args.profile].tflite_files:
            if not (weights / relative).is_file():
                raise RuntimeError(f"Missing installed {args.profile} model: {relative}")
        paths = runtime_paths()
        verify_upstream_checkout(paths.upstream)
        env = runtime_environment()
        env["HF_HUB_OFFLINE"] = "1"
        with file_lock(paths.root / "generation"):
            if not profile_path.exists():
                profile_path.write_text(json.dumps({"profile": args.profile}), encoding="utf-8")
            for stage in ("text", "sample", "decode"):
                command = [str(runtime_python("tflite")), str(Path(__file__).resolve()), *sys.argv[1:], "--stage", stage]
                subprocess.run(command, env=env, check=True)
        return

    import numpy as np
    import soundfile as sf
    folder = Path(args.home) / "runtime/stable-audio-3/optimized/tflite"
    sys.path.insert(0, str(folder / "scripts"))
    import sa3_tflite as sa
    dit = "sm-sfx" if args.profile == "small-sfx" else "medium"
    decoder = "same-s" if args.profile == "small-sfx" else "same-l"

    def model_path(relative):
        path = sa.ensure_local(relative)
        # LiteRT memory-maps weights. A sequential read warms the Windows file
        # cache and avoids minutes of tiny random HDD reads during allocation.
        if os.name == "nt":
            scratch = bytearray(8 * 1024 * 1024)
            with open(path, "rb") as stream:
                while stream.readinto(scratch):
                    pass
        return path

    review_path = manifest.parent / "screening.json"
    feedback = {}
    if review_path.exists():
        for candidate in json.loads(review_path.read_text(encoding="utf-8"))["candidates"]:
            feedback[candidate["name"]] = candidate["reasons"]
    model = None
    tokeniser = sa.P.Tokenizer() if args.stage == "text" else None
    for i, spec in enumerate(entries):
        name = spec["name"]
        out = manifest.parent / f"{name}-{args.round:02}.wav"
        if out.exists():
            print(f"SKIP {name}: existing candidate", flush=True)
            continue
        prompt = spec["prompt"]
        if args.round > 1 and args.kind == "sfx":
            # Shorten crowded prompts and address the actual failed acoustic checks.
            description = spec["match"].split(". ")[0].rstrip(".") + "."
            if args.round >= 4 and spec.get("retryPrompt"):
                description = spec["retryPrompt"]
            reasons = feedback.get(name, [])
            correction = ""
            if "weak phone-speaker midrange" in reasons:
                correction += " Strong audible midrange texture, with a soft woody contact; avoid bass-only rumble."
            if "unfinished loud tail" in reasons:
                correction += " Damped at its source, very brief resonance, no sustained sound or reverb."
            if "weak event dominated by a sharp peak" in reasons:
                correction += " Rounded attack with a clear full-bodied sound, no isolated sharp click or tiny transient spike."
            if "unwanted sound class dominates" in reasons:
                correction += " Clear foreground object sound in a completely silent recording space."
            prompt = (f'{description} A single brief sound, lasting {spec["keep"] * 0.65:.2f} seconds, '
                      'with an immediate attack and complete natural decay. Dry studio recording of one isolated '
                      'fantasy game sound effect, followed by silence. No voice, music, background or repetition. '
                      + correction + ('' if args.round == 2 else ' Very short, softly damped, midrange-focused.'))
        elif args.round > 1:
            prompt += " Entirely instrumental with clear acoustic instruments, no human vocal sounds or background noise, balanced dynamics."
        intermediate = out.with_suffix(".npz")
        latents_path = out.with_suffix(".latents.npy")
        started = time.monotonic()
        print(f'{args.stage.upper()} {i + 1}/{len(entries)} {name} round {args.round}', flush=True)
        length = sa.valid_T_lat(spec["gen"])
        seed = 20261020 + args.round * 1000 + i
        if args.stage == "text":
            if intermediate.exists():
                continue
            if model is None:
                model = sa.P.T5GemmaTFLite(model_path(sa.T5_REL), 8)
            ids, mask = tokeniser(prompt)
            hidden = model(ids, mask)
            with intermediate.open("xb") as f:
                np.savez(f, hidden=hidden, mask=mask)
        elif args.stage == "sample":
            if latents_path.exists():
                continue
            with np.load(intermediate) as data:
                hidden, mask = data["hidden"], data["mask"].astype(np.float32)
            if model is None:
                model = sa.BakedDiT(model_path(sa.dit_rel(dit, "fp32")), length,
                                   hidden, mask, spec["gen"], 8, cfg=1.0)
            else:
                model.set_conditioning(length, hidden, mask, spec["gen"], cfg=1.0)
            x0, noise = sa.P.make_noise(length, 8, seed)
            latent = sa.P.sample(model, x0, noise, sa.P.build_pingpong_schedule(8, 1.0), None, None)
            with latents_path.open("xb") as f:
                np.save(f, latent)
        else:
            if model is None:
                model = sa.RungDecoder(model_path(sa.dec_rel(decoder, "w8a8")), threads=8,
                                       trim=sa.RUNG_TRIM[decoder])
            latent = np.load(latents_path)
            if decoder == "same-s" and latent.shape[-1] % 2:
                latent = np.concatenate([latent, latent[:, :, -1:]], axis=2)
            rendered = model.decode(latent)[0, :, :round(spec["gen"] * 44100)]
            temporary = out.with_suffix(".partial.wav")
            sa.P.save_wav(str(temporary), rendered)
            x, rate = sf.read(temporary, always_2d=True)
            if not np.isfinite(x).all() or abs(len(x) / rate - spec["gen"]) > 1 / rate:
                raise RuntimeError(f"Invalid generated WAV: {name}")
            os.link(temporary, out)
            temporary.unlink()
            out.with_suffix(".json").write_text(json.dumps({
                "name": name, "round": args.round, "prompt": prompt, "seed": seed,
                "generator": f"agent-audio / pinned Stable Audio 3 {args.profile} TFLite runtime (staged batch)",
                "profile": args.profile,
                "source_seconds": len(x) / rate, "sample_rate": rate, "channels": x.shape[1],
            }, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f'DONE {args.stage} {name}: {time.monotonic() - started:.1f}s', flush=True)


if __name__ == "__main__":
    main()
