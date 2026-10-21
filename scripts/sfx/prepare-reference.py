"""Remove the quiet codec noise floor and master reference-based healing takes.

Requires numpy/scipy; writes PCM16 stereo WAV without mixing in source audio.
"""
import argparse
import hashlib
import json
from pathlib import Path
import wave

import numpy as np
from scipy.ndimage import gaussian_filter1d, uniform_filter1d
from combat_quality import read_wav, db


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source", type=Path)
    ap.add_argument("output", type=Path)
    ap.add_argument("--reference-preview", action="store_true")
    args = ap.parse_args()
    if args.output.exists():
        raise FileExistsError(args.output)
    x, sr = read_wav(args.source)
    if not len(x) or not np.isfinite(x).all() or abs(x).max() < .0001:
        raise ValueError("Empty, silent, or non-finite input")
    if not args.reference_preview:
        # Stereo-linked smooth expander: leave the body/early tail untouched.
        env = np.sqrt(np.maximum(uniform_filter1d(np.mean(x*x, axis=1), size=round(sr*.02)), 0))
        level = 20*np.log10(np.maximum(env, 1e-12))
        t = np.clip((level+72)/14, 0, 1)
        gain = gaussian_filter1d(t*t*(3-2*t), sigma=sr*.005)
        x *= gain[:, None]
        x[-round(sr*.08):] *= np.linspace(1, 0, round(sr*.08))[:, None]
    gain = min(10**(-24/20)/np.sqrt(np.mean(x*x)), 10**(-3/20)/abs(x).max())
    x *= gain
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(args.output), "wb") as f:
        f.setparams((x.shape[1], 2, sr, 0, "NONE", "not compressed"))
        f.writeframes((np.clip(x, -1, 32767/32768)*32768).round().astype("<i2").tobytes())
    report = {"source": str(args.source), "source_sha256": hashlib.sha256(args.source.read_bytes()).hexdigest(),
              "output_sha256": hashlib.sha256(args.output.read_bytes()).hexdigest(),
              "processing": "Level match only" if args.reference_preview else
              "Stereo-linked 20ms RMS expander, -72 to -58 dBFS smoothstep, 5ms smoothing, final 80ms fade; no reference audio mixed in",
              "gain_db": db(gain), "target_rms_dbfs": -24, "peak_limit_dbfs": -3,
              "seconds": len(x)/sr, "channels": x.shape[1], "sample_rate": sr,
              "rms_dbfs": db(np.sqrt(np.mean(x*x))), "peak_dbfs": db(abs(x).max())}
    args.output.with_suffix(".json").write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8", newline="\n")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
