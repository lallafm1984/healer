"""Shorten a complete WAV phrase without shifting pitch (analysis Python)."""
import argparse
from pathlib import Path
import numpy as np
import torch
from torchaudio.functional import phase_vocoder
from combat_quality import read_wav
from importlib import import_module

write = import_module('priest-redesign').write


def shorten(x, sr, seconds):
    frames = round(seconds * sr)
    if len(x) <= frames:
        return x.copy()
    # Preserve the original attack. Crossfade into the compressed body so a
    # transient does not smear and the join does not introduce a click.
    attack, overlap = round(sr * .04), round(sr * .008)
    body = torch.tensor(x[attack-overlap:].T, dtype=torch.float32)
    count = frames - attack + overlap
    fft, hop = 1024, 256
    window = torch.hann_window(fft)
    stft = torch.stft(body, fft, hop, window=window, return_complex=True)
    advance = torch.linspace(0, np.pi * hop, stft.shape[-2])[:, None]
    stretched = phase_vocoder(stft, body.shape[-1] / count, advance)
    tail = torch.istft(stretched, fft, hop, window=window, length=count).numpy().T
    y = np.concatenate([x[:attack], tail[overlap:]])
    blend = np.linspace(0, 1, overlap)[:, None]
    y[attack-overlap:attack] = x[attack-overlap:attack]*(1-blend)+tail[:overlap]*blend
    y *= min(np.sqrt(np.mean(x*x))/max(np.sqrt(np.mean(y*y)), 1e-12),
             10**(-3/20)/max(abs(y).max(), 1e-12))
    fade = min(len(y)//3, round(sr*.035))
    y[-fade:] *= np.linspace(1, 0, fade)[:, None]**2
    return y


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('source', type=Path)
    ap.add_argument('output', type=Path)
    ap.add_argument('--seconds', type=float, default=1.45)
    args = ap.parse_args()
    if not .1 <= args.seconds <= 1.5:
        raise ValueError('Output must be 0.1–1.5 seconds')
    torch.set_num_threads(2)
    args.output.mkdir(exist_ok=True)
    for path in sorted(args.source.glob('*.wav')):
        x, sr = read_wav(path)
        y = shorten(x, sr, args.seconds)
        write(args.output/path.name, y, sr)
        print(f'{path.stem}: {len(x)/sr:.3f} -> {len(y)/sr:.3f}s', flush=True)
