"""배경음 넣기: 배경음 등록판 (Artifact, Lim이 Mureka 웹사이트로 만든 곡을 구간마다 올림)의 곡 → 게임용 src/bgm/<구간>-<번호>.ogg.

등록판은 음원을 앱 저장소가 받는 JSON 조각 ({kind: "bgm-part", name, type, part, parts, data: base64})으로 나눠 올린다.
Claude가 등록판 db의 tracks (use가 꺼지지 않은 곡)를 읽고 조각을 Artifact read로 내려받아 manifest를 만든 뒤 이 스크립트를 돌린다.

곡은 자르지 않는다 (2026-10-21 Lim 「노래는 자르지 말고」). 하는 일:
1. 조각을 이어 원본으로 → 풀기 (MP3 · WAV · FLAC · OGG)
2. 48 kHz로 (Opus는 48 kHz만), 세기 맞춤 (100 Hz 위 RMS −18 dBFS, 첨두 −1 dBFS를 넘지 않게) → 곡마다 들쭉날쭉하지 않게
3. 맨 앞 20 ms · 맨 끝 0.5초만 짧게 페이드 (딸깍 소리 막기). 결과 곡 (victory · defeat)은 30초로 (Lim 「30초 분량」, Mureka는 3분쯤 만듦):
   조용한 도입을 건너뛰고 (1초 세기가 곡의 큰 소리 −8 dB에 처음 닿는 곳) 30초, 끝 2.5초 페이드
4. Ogg Opus 스테레오 → <구간>-<번호>.ogg. 앱 용량을 최대한 줄이게 (2026-10-21 Lim 「용량을 최대한 줄여서」, 곡 56개 · 약 170분)
   타이틀 · 로비 약 38 kbps (3분 곡 약 0.85 MB), 지역 전투 · 결과 곡은 효과음에 묻혀 약 32 kbps (약 0.7 MB).
   구간의 옛 파일은 지우고 새로 씀

실행:
  uv run --no-project --with numpy --with soundfile python -I scripts/bgm/import.py <manifest.json> src/bgm
manifest.json = [{"section": "lobby", "name": "lobby-a.mp3", "parts": ["/…/<asset id>.json", …]}, …] (구간 안 순서 = 번호 순)
"""

import base64
import io
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

OUT_SR = 48000
RMS_TARGET_DB = -18.0
PEAK_MAX_DB = -1.0
# libsndfile Opus 압축 정도 → 스테레오 비트율 (0.9 = 64 kbps, 0.95 = 38, 0.96 = 33, 0.97 = 28)
OPUS_LEVEL = {"title": 0.95, "lobby": 0.95}
OPUS_LEVEL_BATTLE = 0.962
# 결과 곡 길이 (초)
CUE = {"victory", "defeat"}
CUE_LEN, CUE_FADE = 30.0, 2.5


def db(x: float) -> float:
    return 20 * np.log10(max(x, 1e-12))


def resample(x: np.ndarray, sr: int, to: int) -> np.ndarray:
    """FFT 다시 표본화 (앞뒤 1초 0을 붙여 끝이 처음으로 감기지 않게)"""
    if sr == to:
        return x.astype(np.float32)
    pad = sr
    xp = np.pad(x, ((pad, pad), (0, 0)))
    n = len(xp)
    m = int(round(n * to / sr))
    X = np.fft.rfft(xp, axis=0)
    k = m // 2 + 1
    Y = np.zeros((k, x.shape[1]), dtype=complex)
    c = min(k, X.shape[0])
    Y[:c] = X[:c]
    y = np.fft.irfft(Y, m, axis=0) * (m / n)
    p2 = int(round(pad * to / sr))
    return y[p2 : p2 + int(round(len(x) * to / sr))].astype(np.float32)


def level(y: np.ndarray, sr: int) -> tuple[np.ndarray, float]:
    m = y.mean(axis=1).astype(np.float64)
    sp = np.fft.rfft(m)
    sp[: int(100 * len(m) / sr)] = 0
    rms = float(np.sqrt(np.mean(np.fft.irfft(sp, len(m)) ** 2)))
    gain = min(10 ** (RMS_TARGET_DB / 20) / max(rms, 1e-9), 10 ** (PEAK_MAX_DB / 20) / float(np.max(np.abs(y)) + 1e-12))
    return (y * gain).astype(np.float32), gain


def cue(y: np.ndarray, sr: int) -> np.ndarray:
    """결과 곡: 조용한 도입을 건너뛰고 CUE_LEN초, 끝 CUE_FADE초 페이드"""
    if len(y) <= (CUE_LEN + 4) * sr:
        return y
    m = y.mean(axis=1).astype(np.float64)
    win = sr // 10
    e = np.sqrt(np.convolve(m ** 2, np.ones(win * 10) / (win * 10), mode="same")[::win])  # 0.1초마다 1초 세기
    loud = np.percentile(e, 95)
    hit = np.flatnonzero(e >= loud * 10 ** (-8 / 20))
    start = max(0, int(hit[0]) * win - win // 2) if len(hit) else 0
    start = min(start, len(y) - int(CUE_LEN * sr))
    out = y[start : start + int(CUE_LEN * sr)].copy()
    fo = int(CUE_FADE * sr)
    out[-fo:] *= np.linspace(1, 0, fo)[:, None]
    return out


def main() -> None:
    manifest, out = Path(sys.argv[1]), Path(sys.argv[2])
    items = json.loads(manifest.read_text(encoding="utf-8"))
    out.mkdir(parents=True, exist_ok=True)
    count: dict[str, int] = {}
    sections = sorted({it["section"] for it in items})
    for s in sections:
        for old in out.glob(f"{s}-*.ogg"):
            old.unlink()
    for it in items:
        s = it["section"]
        parts = [json.loads(Path(p).read_text(encoding="utf-8")) for p in it["parts"]]
        parts.sort(key=lambda j: j["part"])
        raw = b"".join(base64.b64decode(j["data"]) for j in parts)
        if parts and len(raw) != parts[0].get("size", len(raw)):
            raise SystemExit(f"{it['name']}: 조각을 이은 크기가 다름 ({len(raw)} / {parts[0]['size']})")
        try:
            x, sr = sf.read(io.BytesIO(raw), dtype="float64", always_2d=True)
        except Exception as e:  # noqa: BLE001
            raise SystemExit(f"{it['name']}: 풀 수 없는 형식 ({e}). MP3 · WAV · FLAC · OGG로 올려 주세요")
        if x.shape[1] == 1:
            x = np.repeat(x, 2, axis=1)
        y = resample(x[:, :2], sr, OUT_SR)
        y, gain = level(y, OUT_SR)
        if s in CUE:
            y = cue(y, OUT_SR)
        fi, fo = int(0.02 * OUT_SR), int(0.5 * OUT_SR)
        y[:fi] *= np.linspace(0, 1, fi, endpoint=False)[:, None]
        y[-fo:] *= np.linspace(1, 0, fo)[:, None]
        count[s] = count.get(s, 0) + 1
        dst = out / f"{s}-{count[s]}.ogg"
        with sf.SoundFile(str(dst), "w", OUT_SR, 2, format="OGG", subtype="OPUS", compression_level=OPUS_LEVEL.get(s, OPUS_LEVEL_BATTLE)) as f:
            for i in range(0, len(y), 9600):
                f.write(y[i : i + 9600])
        print(f"{dst.name} ← {it['name']}: {len(y) / OUT_SR:.0f}초, {dst.stat().st_size / 1048576:.2f} MB, 세기 {db(gain):+.1f} dB")


if __name__ == "__main__":
    main()
