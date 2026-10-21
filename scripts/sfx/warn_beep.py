"""빨간 주의 표시 경고음: 생성 모델 대신 직접 만드는 삐 소리 → src/sfx/warn-alert.ogg.

2026-10-21 Lim 「삐~ 삐~ 삐~ 하는 경고음」 → 「첨부 사운드를 조금 더 굵은 음으로」: Lim이 준 참고 소리 (짧은 삐 0.10초 · 쉼 0.065초 · 긴 삐 0.36초,
약 308Hz의 버징한 각진 음)의 리듬과 결을 따라 새로 합성한 소리. 참고 파일은 쓰지 않음 (출처 모름).
굵게 = 기본음을 낮추고 (308 → 230 · 200Hz) 한 옥타브 아래 사인을 깔고, 살짝 어긋난 두 겹으로 두께를 줌.
폰 스피커는 300Hz 밑을 거의 못 내므로 홀수 배음 (각진 결)을 살려 그 위 대역에서 들리게 함.
세기는 활성 구간 RMS -13 dBFS (다른 효과음보다 4dB 크게), 첨두 -1 dBFS 밑 (잘림 없음).

실행: uv run --no-project --with numpy --with soundfile python scripts/sfx/warn_beep.py [안 번호]
  안마다 .sfx-raw/takes/warn-alert~<번호>.ogg (듣기 페이지), 고른 안 (기본 GAME)을 src/sfx/warn-alert.ogg로
"""

import sys
from pathlib import Path

import numpy as np
import soundfile as sf

RATE = 44100
RMS_TARGET_DB, PEAK_MAX_DB = -13.0, -1.0  # 경고는 다른 효과음보다 4dB 크게 (굵은 음은 폰이 못 내는 낮은 몫이 커서)
REF_RHYTHM = [(0.10, 0.065), (0.36, 0.0)]  # 참고 소리: 짧은 삐 → 쉼 → 긴 삐
THREE = [(0.17, 0.08), (0.17, 0.08), (0.17, 0.0)]  # 삐~ 삐~ 삐~

# 안: (설명, 기본음 Hz, 아래 옥타브 세기, 두 겹 어긋남 Hz, 각진 정도 0~1, 리듬)
VARIANTS = {
    1: ("굵게: 230Hz 각진 음 + 아래 옥타브", 230.0, 0.5, 0.0, 0.8, REF_RHYTHM),
    2: ("더 굵게: 200Hz 두 겹 + 아래 옥타브", 200.0, 0.6, 2.5, 0.9, REF_RHYTHM),
    3: ("참고 높이 그대로 두껍게: 308Hz 두 겹 + 아래 옥타브", 308.0, 0.5, 3.0, 0.8, REF_RHYTHM),
    4: ("굵은 음으로 삐~ 삐~ 삐~ 세 번: 230Hz", 230.0, 0.5, 2.0, 0.8, THREE),
}
GAME = 1


def osc(f: float, n: int, edge: float) -> np.ndarray:
    """각진 음: 홀수 배음 (네모파 쪽)과 모든 배음 (톱니 쪽)을 섞고, 7kHz 위는 뺌 (띠 제한이라 접힘 없음)"""
    t = np.arange(n) / RATE
    y = np.zeros(n)
    for k in range(1, int(7000 / f) + 1):
        amp = (1.0 / k) * (1.0 if k % 2 else (1 - edge) * 0.6)
        y += amp * np.sin(2 * np.pi * f * k * t)
    return y


def beep(dur: float, f: float, sub: float, detune: float, edge: float) -> np.ndarray:
    n = int(dur * RATE)
    y = osc(f, n, edge)
    if detune:
        y = 0.6 * y + 0.6 * osc(f + detune, n, edge)
    t = np.arange(n) / RATE
    y = y / np.max(np.abs(y)) + sub * np.sin(2 * np.pi * (f / 2) * t)
    y = np.tanh(1.6 * y / np.max(np.abs(y)))  # 살짝 눌러 버징한 결 (잘림 없이)
    a, r = int(0.004 * RATE), int(0.012 * RATE)
    y[:a] *= np.linspace(0, 1, a)
    y[-r:] *= np.linspace(1, 0, r)
    return y


def make(v: int) -> np.ndarray:
    _, f, sub, detune, edge, rhythm = VARIANTS[v]
    parts = []
    for on, off in rhythm:
        parts += [beep(on, f, sub, detune, edge), np.zeros(int(off * RATE))]
    y = np.concatenate(parts)
    act = y[np.abs(y) > np.max(np.abs(y)) * 10 ** (-30 / 20)]
    y *= min(10 ** (RMS_TARGET_DB / 20) / float(np.sqrt(np.mean(act**2))), 10 ** (PEAK_MAX_DB / 20) / float(np.max(np.abs(y))))
    return y.astype(np.float32)


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    game = int(sys.argv[1]) if len(sys.argv) > 1 else GAME
    takes = root / ".sfx-raw/takes"
    for v, (desc, *_rest) in VARIANTS.items():
        y = make(v)
        if takes.is_dir():
            sf.write(str(takes / f"warn-alert~{v}.ogg"), y, RATE, format="OGG", subtype="VORBIS")
        if v == game:
            sf.write(str(root / "src/sfx/warn-alert.ogg"), y, RATE, format="OGG", subtype="VORBIS")
        print(f"{v}안{' (게임)' if v == game else ''} {len(y) / RATE:.2f}s {desc}")


if __name__ == "__main__":
    main()
