"""Signal checks for one-shot combat sounds; these are NOT a listening verdict."""
import math
import wave
import numpy as np


def db(x):
    return 20 * math.log10(max(float(x), 1e-12))


def read_wav(path):
    with wave.open(str(path), "rb") as f:
        if f.getsampwidth() != 2:
            raise ValueError("Expected PCM16 WAV from Agent Audio")
        x = np.frombuffer(f.readframes(f.getnframes()), dtype="<i2").astype(np.float64) / 32768
        return x.reshape(-1, f.getnchannels()), f.getframerate()


def prepare(x, rate, keep, event_gap=.08):
    if not np.isfinite(x).all():
        raise ValueError("non-finite samples")
    y = x.mean(axis=1)
    peak = np.max(np.abs(y))
    if peak < 0.0001:
        raise ValueError("silent")
    block = max(1, int(rate * 0.01))
    env = np.array([np.sqrt(np.mean(y[i:i + block] ** 2)) for i in range(0, len(y), block)])
    active = np.flatnonzero(env > env.max() * 0.035)
    # A generated file may begin with a tiny click before the useful sound.
    # Pick the most energetic event; brief gaps within a crack/rustle stay together.
    # A multi-note spell may intentionally contain a short pause between notes.
    regions = np.split(active, np.where(np.diff(active) > max(1, round(event_gap/.01)))[0] + 1)
    region = max(regions, key=lambda a: float(np.sum(env[a[0]:a[-1] + 1] ** 2)))
    first = int(region[0])
    start = max(0, first * block - int(rate * 0.005))
    max_end = min(len(y), start + int(keep * rate))
    end = min(max_end, (int(region[-1]) + 4) * block)
    segment = y[start:end].copy()
    tail = segment[-max(1, int(rate * .035)):]
    tail_db = db(np.sqrt(np.mean(tail ** 2)) / max(env.max(), 1e-12))
    # Normalise with headroom; a low-level fade does not turn a cut tail into a pass.
    rms = np.sqrt(np.mean(segment ** 2))
    gain = min(10 ** (-20 / 20) / max(rms, 1e-12), 10 ** (-3 / 20) / max(np.max(np.abs(segment)), 1e-12))
    segment *= gain
    fin, fout = min(len(segment), int(rate * .003)), min(len(segment) // 3, int(rate * .035))
    segment[:fin] *= np.linspace(0, 1, fin)
    segment[-fout:] *= np.linspace(1, 0, fout) ** 2
    spec = np.abs(np.fft.rfft(segment * np.hanning(len(segment)))) ** 2
    freqs = np.fft.rfftfreq(len(segment), 1 / rate)
    phone = 10 * np.log10(max(float(spec[(freqs >= 250) & (freqs <= 7000)].sum() / max(spec.sum(), 1e-12)), 1e-12))
    clipped = float(np.mean(np.abs(x) >= .999))
    metrics = {"seconds": round(len(segment) / rate, 3), "onset_seconds": round(start / rate, 3),
               "tail_db": round(tail_db, 2), "phone_band_db": round(float(phone), 2),
               "clipped_fraction": clipped, "peak_db": round(db(np.max(np.abs(segment))), 2),
               "rms_db": round(db(np.sqrt(np.mean(segment ** 2))), 2)}
    reasons = []
    if len(segment) / rate < min(keep * .2, .06): reasons.append("event too short")
    if tail_db > -18: reasons.append("unfinished loud tail")
    if phone < -16: reasons.append("weak phone-speaker midrange")
    if clipped > .002: reasons.append("clipped source")
    if metrics["seconds"] >= .2 and metrics["rms_db"] < -30:
        reasons.append("weak event dominated by a sharp peak")
    return segment, metrics, reasons


def write_wav(path, samples, rate):
    with wave.open(str(path), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(rate)
        f.writeframes((np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes())
