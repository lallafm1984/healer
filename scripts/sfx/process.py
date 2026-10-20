"""효과음 다듬기 (기획 107): 생성한 WAV → 게임용 src/sfx/<이름>.ogg.

모노로 합침 → 앞 무음을 자름 → keep초 안에서 소리가 끝나는 곳까지 → 앞 3ms · 끝 최대 80ms 페이드 (108 5장) →
세기 맞춤 (활성 구간 RMS -17 dBFS, 첨두 -1 dBFS를 넘지 않게) → Ogg Vorbis 모노 (품질 0.35).

한 소리에 생성본이 여럿이면 (<이름>.wav, <이름>~2.wav …, make.mjs --takes) 하나를 고름:
폰 스피커 (약 350Hz 밑을 못 냄)로 들어도 덜 작아지고, keep 안에서 스스로 끝나며 (자른 곳이 크면 감점, 108: 길이 강제 절단 대신 다시 생성),
잡음 같지 않은 것. <raw>/picks.json {"이름": "~2"} 이 있으면 그 생성본으로 (듣고 고른 것). 후보마다 다듬은 소리는 <raw>/takes/에 남김.

실행 (scripts/sfx/make.mjs가 부름):
  uv run --with numpy --with soundfile python scripts/sfx/process.py <raw 폴더> <출력 폴더> <params.json>
params.json = [{"name": ..., "keep": 초}, ...]. 결과 표를 출력 폴더 밖 <raw>/report.json에 씀.
"""

import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ONSET_DB = -38.0  # 첨두에서 이만큼 낮은 곳부터 소리로 봄
TAIL_DB = -50.0  # 끝: 이보다 작아지면 끝난 것으로
RMS_TARGET_DB = -17.0
PEAK_MAX_DB = -1.0
QUALITY = 0.35  # Vorbis 압축 정도 (0 = 가장 좋음, 1 = 가장 작음)


def db(x: float) -> float:
    return 20 * np.log10(max(x, 1e-12))


def shape(x: np.ndarray, rate: int, keep: float) -> np.ndarray:
    peak = float(np.max(np.abs(x)))
    if peak <= 1e-6:
        raise ValueError("무음")
    env = np.abs(x)
    on = np.flatnonzero(env > peak * 10 ** (ONSET_DB / 20))
    start = max(0, int(on[0]) - int(0.004 * rate))
    end = min(len(x), start + int(keep * rate))
    loud = np.flatnonzero(env[start:end] > peak * 10 ** (TAIL_DB / 20))
    if len(loud):
        end = min(end, start + int(loud[-1]) + int(0.03 * rate))
    y = x[start:end].astype(np.float64).copy()
    n = len(y)
    fin = min(n, int(0.003 * rate))
    if fin:
        y[:fin] *= np.linspace(0, 1, fin, endpoint=False)
    fout = min(n // 3, int(0.08 * rate))
    if fout > 1:
        y[-fout:] *= np.cos(np.linspace(0, np.pi / 2, fout)) ** 2
    # 세기: 활성 구간 (첨두 -30 dB 위) RMS를 목표로, 첨두는 -1 dBFS까지만
    act = y[np.abs(y) > np.max(np.abs(y)) * 10 ** (-30 / 20)]
    rms = float(np.sqrt(np.mean(act**2))) if len(act) else float(np.sqrt(np.mean(y**2)))
    gain = min(10 ** (RMS_TARGET_DB / 20) / max(rms, 1e-9), 10 ** (PEAK_MAX_DB / 20) / float(np.max(np.abs(y))))
    return (y * gain).astype(np.float32)


def highpass(y: np.ndarray, rate: int, fc: float = 350.0) -> np.ndarray:
    """폰 스피커 흉내: 1차 고역 통과 두 번 (옥타브당 12 dB)"""
    a = 1 / (1 + 2 * np.pi * fc / rate)
    for _ in range(2):
        out = np.empty_like(y)
        px = py = 0.0
        for i, v in enumerate(y):
            py = a * (py + v - px)
            px = v
            out[i] = py
        y = out
    return y


def judge(x: np.ndarray, rate: int, keep: float) -> dict:
    """생성본 하나를 다듬고 점수를 매김"""
    m = x.mean(axis=1)
    y = shape(m, rate, keep)
    rms = float(np.sqrt(np.mean(y**2))) + 1e-12
    phone = db(float(np.sqrt(np.mean(highpass(y.astype(np.float64), rate) ** 2))) / rms)
    # 다듬기 전 신호에서 자른 곳 (앞 무음 + keep) 직전 50ms 세기: 크면 소리가 keep 밖까지 이어지다 잘린 것
    peak = float(np.max(np.abs(m)))
    on = int(np.flatnonzero(np.abs(m) > peak * 10 ** (ONSET_DB / 20))[0])
    cut = min(len(m), on + int(keep * rate))
    seg = m[max(on, cut - int(0.05 * rate)) : cut]
    cut_db = db(float(np.sqrt(np.mean(seg**2))) / peak) if len(seg) else -99.0
    seg1 = y[: min(len(y), rate)].astype(np.float64)
    seg1 = np.pad(seg1, (0, max(0, 1024 - len(seg1))))
    spec = np.abs(np.fft.rfft(seg1 * np.hanning(len(seg1)))) + 1e-12
    flat = float(np.exp(np.mean(np.log(spec))) / np.mean(spec))
    score = phone - (8 if cut_db > -20 else 3 if cut_db > -30 else 0) - (10 if flat > 0.6 else 0)
    return {"y": y, "phone_db": round(phone, 1), "cut_db": round(cut_db, 1), "flat": round(flat, 3), "score": round(score, 1)}


def write_ogg(path: Path, y: np.ndarray, rate: int) -> None:
    # 긴 소리를 한 번에 쓰면 윈도우 libsndfile Vorbis가 스택 넘침으로 죽을 수 있어 나눠 씀
    with sf.SoundFile(str(path), "w", rate, 1, format="OGG", subtype="VORBIS", compression_level=QUALITY) as f:
        for i in range(0, len(y), 8192):
            f.write(y[i : i + 8192])


def main() -> None:
    raw, out, params = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    takes_dir = raw / "takes"
    takes_dir.mkdir(exist_ok=True)
    picks_file = raw / "picks.json"
    picks = json.loads(picks_file.read_text(encoding="utf-8")) if picks_file.is_file() else {}
    report = []
    for p in json.loads(params.read_text(encoding="utf-8")):
        name, keep = p["name"], float(p["keep"])
        srcs = [s for s in [raw / f"{name}.wav", *sorted(raw.glob(f"{name}~*.wav"))] if s.is_file()]
        if not srcs:
            report.append({"name": name, "error": "생성 파일 없음"})
            continue
        tries = []
        for src in srcs:
            label = src.stem[len(name) :] or "~1"
            x, rate = sf.read(str(src), dtype="float64", always_2d=True)
            if not np.all(np.isfinite(x)):
                tries.append({"take": label, "error": "숫자가 아닌 값"})
                continue
            try:
                j = judge(x, rate, keep)
            except ValueError as e:
                tries.append({"take": label, "error": str(e)})
                continue
            j.update(take=label, rate=rate, src_channels=x.shape[1], src_peak_db=round(db(float(np.max(np.abs(x)))), 1))
            if len(srcs) > 1:
                write_ogg(takes_dir / f"{name}{label}.ogg", j["y"], rate)
            tries.append(j)
        ok = [t for t in tries if "error" not in t]
        if not ok:
            report.append({"name": name, "error": "쓸 생성본 없음", "takes": tries})
            continue
        forced = [t for t in ok if t["take"] == picks.get(name)]
        best = forced[0] if forced else max(ok, key=lambda t: t["score"])
        y, rate = best["y"], best["rate"]
        dst = out / f"{name}.ogg"
        write_ogg(dst, y, rate)
        report.append({
            "name": name,
            "take": best["take"],
            "picked": "듣고 고름" if forced else "점수",
            "sec": round(len(y) / rate, 3),
            "bytes": dst.stat().st_size,
            "peak_db": round(db(float(np.max(np.abs(y)))), 1),
            "rate": rate,
            "takes": [{k: v for k, v in t.items() if k != "y"} for t in tries],
        })
        r = report[-1]
        print(f"{name}: {r['take']} ({r['picked']}) {r['sec']}s {r['bytes']}B 폰 {best['phone_db']}dB 자른곳 {best['cut_db']}dB / 후보 {len(ok)}")
    (raw / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    bad = [r for r in report if "error" in r]
    for r in bad:
        print(f"!! {r['name']}: {r['error']}", file=sys.stderr)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
