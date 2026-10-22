"""빨간 주의 표시 경고음: 생성 모델 대신 직접 합성 → src/sfx/warn-alert.ogg.

2026-10-21 Lim 「삐~ 삐~ 삐~」 → 「첨부 사운드를 조금 더 굵은 음으로」 (굵은 삐) → 2026-10-22 「유튜브 경고음 모음 41~48초 (4번)를 참고해서」:
참고 소리는 맑게 울리고 사그라지는 「딩~」이 0.87초마다 되풀이됨. 기본음 약 785Hz에 4배음 (약 3.14kHz)이 강하고, 기본음 조금 아래 (약 740Hz)
어긋난 울림이 있어 금속 종 같은 결, 첫 소리가 바로 서고 0.6초 동안 약 30dB 줄어듦. 그 결 · 높이 · 사그라짐을 따라 새로 합성 (참고 소리는 쓰지 않음).
게임에서는 예고 하나에 한 번 울리므로 딩을 두세 번으로 짧게 묶음. 세기는 활성 구간 RMS -13 dBFS, 첨두 -1 dBFS 밑.

실행: uv run --no-project --with numpy --with soundfile python scripts/sfx/warn_beep.py [안 번호]
  안마다 .sfx-raw/takes/warn-alert~<번호>.ogg (듣기 페이지), 고른 안 (기본 GAME)을 src/sfx/warn-alert.ogg로
"""

import sys
from pathlib import Path

import numpy as np
import soundfile as sf

RATE = 44100
RMS_TARGET_DB, PEAK_MAX_DB = -13.0, -1.0
F0 = 785.0
# 울림: (주파수 배수, 세기, 사그라짐 시간 상수 초). 4배음이 밝게, 0.94배 어긋난 울림이 금속 결을 줌
PARTIALS = [(1.0, 1.0, 0.17), (4.0, 0.7, 0.11), (0.943, 0.3, 0.15), (3.0, 0.18, 0.09), (2.0, 0.08, 0.12)]

# 안: (설명, 딩 시작 시각들 (초), 한 딩 길이 (초))
VARIANTS = {
    1: ("딩~ 딩~ 두 번 (0.43초 간격)", [0.0, 0.43], 0.55),
    2: ("참고 박자 그대로 딩~ 딩~ 두 번 (0.87초 간격)", [0.0, 0.87], 0.6),
    3: ("딩딩딩 세 번 빠르게 (0.27초 간격)", [0.0, 0.27, 0.54], 0.45),
    4: ("딩~ 한 번 길게", [0.0], 0.8),
}
GAME = 1


def ding(dur: float) -> np.ndarray:
    n = int(dur * RATE)
    t = np.arange(n) / RATE
    y = np.zeros(n)
    for mul, amp, tau in PARTIALS:
        y += amp * np.exp(-t / tau) * np.sin(2 * np.pi * F0 * mul * t)
    a = int(0.003 * RATE)
    y[:a] *= np.linspace(0, 1, a)
    r = int(0.02 * RATE)
    y[-r:] *= np.linspace(1, 0, r)
    return y


def make(v: int) -> np.ndarray:
    _, starts, dur = VARIANTS[v]
    y = np.zeros(int((starts[-1] + dur) * RATE) + 1)
    for s in starts:
        d = ding(dur)
        i = int(s * RATE)
        y[i : i + len(d)] += d
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
