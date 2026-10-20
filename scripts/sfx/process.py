"""효과음 다듬기 (기획 107): 생성한 WAV → 게임용 src/sfx/<이름>.ogg.

모노로 합침 → 앞 무음을 자름 → keep초 안에서 소리가 끝나는 곳까지 → 앞 3ms · 끝 페이드 →
세기 맞춤 (활성 구간 RMS -17 dBFS, 첨두 -1 dBFS를 넘지 않게) → Ogg Vorbis 모노 (품질 0.35).

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


def main() -> None:
    raw, out, params = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    report = []
    for p in json.loads(params.read_text(encoding="utf-8")):
        src = raw / f"{p['name']}.wav"
        if not src.is_file():
            report.append({"name": p["name"], "error": "생성 파일 없음"})
            continue
        x, rate = sf.read(str(src), dtype="float64", always_2d=True)
        if not np.all(np.isfinite(x)):
            report.append({"name": p["name"], "error": "숫자가 아닌 값"})
            continue
        try:
            y = shape(x.mean(axis=1), rate, float(p["keep"]))
        except ValueError as e:
            report.append({"name": p["name"], "error": str(e)})
            continue
        dst = out / f"{p['name']}.ogg"
        sf.write(str(dst), y, rate, format="OGG", subtype="VORBIS", compression_level=QUALITY)
        report.append({
            "name": p["name"],
            "sec": round(len(y) / rate, 3),
            "bytes": dst.stat().st_size,
            "peak_db": round(db(float(np.max(np.abs(y)))), 1),
            "src_peak_db": round(db(float(np.max(np.abs(x)))), 1),
            "rate": rate,
            "src_channels": x.shape[1],
        })
        print(f"{p['name']}: {report[-1]['sec']}s {report[-1]['bytes']}B")
    (raw / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    bad = [r for r in report if "error" in r]
    for r in bad:
        print(f"!! {r['name']}: {r['error']}", file=sys.stderr)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
