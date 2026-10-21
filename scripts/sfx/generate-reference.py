"""Generate a local Stable Audio 3 variation from a user-supplied WAV reference.

Uses the already-installed Agent Audio runtime and its official audio-to-audio
CLI. No upload, model download, or MCP schema change is involved.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import wave


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--home", required=True)
    ap.add_argument("--manifest", required=True, type=Path)
    args = ap.parse_args()
    os.environ["AGENT_AUDIO_HOME"] = str(Path(args.home).resolve())
    from agent_audio.runtime import (backend_ready, runtime_paths, runtime_python,
                                     runtime_environment, verify_upstream_checkout,
                                     UPSTREAM_REVISION, MODEL_REVISION)
    from agent_audio.storage import file_lock
    from agent_audio.download_models import TFLITE_SHA256
    if not backend_ready("tflite"):
        raise RuntimeError("Installed Agent Audio Medium runtime is not ready")
    paths = runtime_paths()
    verify_upstream_checkout(paths.upstream)
    folder = paths.upstream / "optimized/tflite"
    manifest = args.manifest.resolve()
    specs = json.loads(manifest.read_text(encoding="utf-8"))
    env = runtime_environment()
    env["HF_HUB_OFFLINE"] = "1"
    with file_lock(paths.root / "generation"):
        # Warm file-backed weights sequentially before LiteRT's random accesses.
        scratch = bytearray(8 * 1024 * 1024)
        for relative in TFLITE_SHA256:
            with (folder / "models/tflite" / relative).open("rb") as stream:
                while stream.readinto(scratch):
                    pass
        for spec in specs:
            name = spec["name"]
            if Path(name).name != name or not name or "." in name:
                raise ValueError("Candidate name must be a simple stem")
            output = manifest.parent / f"{name}.wav"
            metadata = output.with_suffix(".json")
            reference = Path(spec["reference"]).resolve()
            reference_hash = hashlib.sha256(reference.read_bytes()).hexdigest()
            identity = {**spec, "reference_sha256": reference_hash,
                        "runtime_revision": UPSTREAM_REVISION, "model_revision": MODEL_REVISION}
            if output.exists():
                if metadata.exists() and json.loads(metadata.read_text(encoding="utf-8"))["request"] == identity:
                    print(f"SKIP completed candidate {name}", flush=True)
                    continue
                raise FileExistsError(f"Refusing to replace an existing candidate: {output}")
            # Upstream accepts sigma >= .01; lower values retain more reference
            # detail. The CLI's .4-.8 help text is a suggestion, not a limit.
            if not 0.01 <= spec["strength"] < 1:
                raise ValueError("Reference variation strength must be >= .01 and < 1")
            steps = spec.get("steps", 8)
            if not isinstance(steps, int) or not 1 <= steps <= 16:
                raise ValueError("Steps must be an integer between 1 and 16")
            temporary = output.with_suffix(".partial.wav")
            if temporary.exists():
                raise FileExistsError(f"Incomplete candidate exists: {temporary}")
            command = [str(runtime_python("tflite")), str(folder / "scripts/sa3_tflite.py"),
                       "--dit", "medium", "--decoder", "same-l", "--dit-precision", "fp32",
                       "--encoder-precision", "w8a8", "--decoder-precision", "w8a8",
                       "--prompt", spec["prompt"], "--init-audio", str(reference),
                       "--init-noise-level", str(spec["strength"]), "--seconds", str(spec["seconds"]),
                       "--seed", str(spec["seed"]), "--steps", str(steps), "--cfg", "1",
                       "--threads", "8", "--max-rung", "64", "--free-models", "--out", str(temporary)]
            print(f"GENERATE {name}: reference variation {spec['strength']}", flush=True)
            started = time.monotonic()
            with output.with_suffix(".log").open("w", encoding="utf-8") as log:
                subprocess.run(command, cwd=folder, env=env, stdin=subprocess.DEVNULL,
                               stdout=log, stderr=log, check=True, timeout=900)
            with wave.open(str(temporary), "rb") as wav:
                details = {"seconds": wav.getnframes() / wav.getframerate(),
                           "sample_rate": wav.getframerate(), "channels": wav.getnchannels(),
                           "sample_width": wav.getsampwidth()}
            if abs(details["seconds"] - spec["seconds"]) > 1 / details["sample_rate"]:
                raise RuntimeError("Unexpected generated duration")
            os.link(temporary, output)
            temporary.unlink()
            metadata.write_text(json.dumps({"request": identity,
                "generator": "Agent Audio pinned Stable Audio 3 Medium TFLite CPU audio-to-audio",
                "duration_wall_seconds": round(time.monotonic() - started, 2),
                "output": details}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
            print(f"DONE {name}: {time.monotonic() - started:.1f}s", flush=True)


if __name__ == "__main__":
    main()
