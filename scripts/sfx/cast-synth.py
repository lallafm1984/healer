"""시전음 합성 (2026-10-27 Lim 「저작권 문제 없이 해당 원본을 참고해서 새롭게 만들어보자」): src/sfx/cast-loop-<직업>.ogg 7개.

원본 음원은 읽지 않는다. 예전 사제 시전음 (와우 원본)에서 잰 느낌만 따름: 낮은 D 울림이 가장 크고 (150Hz 밑),
그 위에 조용한 직업별 질감, 6kHz 위 옅은 숨결, 한 바퀴에 한 번 천천히 부푸는 움직임.
모든 층을 한 바퀴 (반복 주기) 안에서 원형으로 만든다: 사인은 바퀴마다 정수 번 돌고, 잡음은 주파수 영역에서 만들고,
울림 · 빗살 필터는 원형 합성곱, 짧은 반짝임은 끝을 처음으로 감아 넣음. 그래서 이음새 없이 반복된다.
세기는 활성 RMS -13.4 dBFS (예전 시전음과 같음, 게임은 0.45로 재생), 첨두 -1 dBFS 밑, Ogg Vorbis 모노.

실행: uv run --no-project --with numpy --with soundfile python scripts/sfx/cast-synth.py [출력 폴더 (기본 src/sfx)] [직업 …]
"""

import sys
from pathlib import Path

import numpy as np
import soundfile as sf

R = 44100
RMS_DB = -13.4
PEAK_DB = -1.5  # Leave headroom for Vorbis reconstruction overshoot.
QUALITY = 0.2  # Vorbis 압축 정도 (0 = 가장 좋음)
A4 = 440.0
NOTE = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}


def hz(name: str) -> float:
    """'D2' → 73.42"""
    p, o = name[:-1], int(name[-1])
    return A4 * 2 ** ((NOTE[p] + 12 * (o - 4)) / 12)


def rms(y: np.ndarray) -> float:
    return float(np.sqrt(np.mean(y**2))) or 1e-12


def unit(y: np.ndarray) -> np.ndarray:
    return y / rms(y)


def db(v: float) -> float:
    return 10 ** (v / 20)


class Loop:
    """한 바퀴 n 샘플. 모든 층은 이 바퀴 안에서 원형"""

    def __init__(self, sec: float, seed: int):
        self.n = int(round(sec * R))
        self.t = np.arange(self.n) / self.n  # 0..1 한 바퀴
        self.f = np.fft.rfftfreq(self.n, 1 / R)
        self.rng = np.random.default_rng(seed)

    def k(self, f: float) -> int:
        """한 바퀴에 정수 번 도는 가장 가까운 주파수의 바퀴 수"""
        return max(1, int(round(f * self.n / R)))

    def lfo(self, cycles: int, ph: float = 0.0) -> np.ndarray:
        return np.sin(2 * np.pi * cycles * self.t + ph)

    def swell(self, depth_db: float, cycles: int, ph: float = 0.0) -> np.ndarray:
        return db(depth_db * self.lfo(cycles, ph))

    def pad(self, note: str, harm=(1.0, 0.35, 0.15), spread=(-1, 0, 1)) -> np.ndarray:
        """한 음의 겹친 울림: 바퀴 수가 1씩 다른 목소리끼리 아주 느리게 맥놀이 (합창처럼)"""
        f0 = hz(note)
        y = np.zeros(self.n)
        for d in spread:
            for h, a in enumerate(harm, 1):
                if a <= 0 or f0 * h > R / 2.2:
                    continue
                y += a * np.sin(2 * np.pi * (self.k(f0 * h) + d) * self.t + self.rng.random() * 2 * np.pi)
        return unit(y)

    def stack(self, note: str, top: float = 5000, roll: float = 1.0, spread=(-1, 0, 1)) -> np.ndarray:
        """배음이 많은 소리 (성가대 · 금관의 바탕): h번째 배음 h^-roll"""
        f0 = hz(note)
        hs = int(top // f0)
        return self.pad(note, harm=tuple(h ** -roll for h in range(1, hs + 1)), spread=spread)

    def noise(self, lo: float, hi: float, soft: float = 0.25, tilt: float = 0.0) -> np.ndarray:
        """lo~hi 대역 잡음 (주파수 영역에서 만들어 바퀴마다 같음). tilt = 옥타브마다 dB"""
        lf = np.log(np.maximum(self.f, 1.0))
        m = 1 / (1 + np.exp(-(lf - np.log(lo)) / soft)) / (1 + np.exp((lf - np.log(hi)) / soft))
        m = m * db(tilt * np.log2(np.maximum(self.f, lo) / lo))
        X = m * np.exp(2j * np.pi * self.rng.random(len(self.f)))
        X[0] = 0
        return unit(np.fft.irfft(X, self.n))

    def breath(self, notes, bw: float = 5.0) -> np.ndarray:
        """음높이가 있는 숨결 (피리 · 바람): 음마다 아주 좁은 잡음 띠"""
        g = np.zeros(len(self.f))
        for nt in notes:
            for h, a in ((1, 1.0), (2, 0.35), (3, 0.12)):
                g += a * np.exp(-0.5 * ((self.f - hz(nt) * h) / (bw * h)) ** 2)
        X = g * np.exp(2j * np.pi * self.rng.random(len(self.f)))
        return unit(np.fft.irfft(X, self.n))

    def shape(self, y: np.ndarray, fn) -> np.ndarray:
        """주파수 영역 필터 (원형): fn(주파수) → 배율"""
        return np.fft.irfft(np.fft.rfft(y) * fn(self.f), self.n)

    def formant(self, y: np.ndarray, peaks) -> np.ndarray:
        """모음 울림 (성가대 「아」): peaks = [(Hz, 폭, dB)]"""
        return self.shape(y, lambda f: 0.03 + sum(db(g) * np.exp(-0.5 * ((f - p) / w) ** 2) for p, w, g in peaks))

    def lowpass(self, y: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
        return self.shape(y, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))

    def comb(self, y: np.ndarray, note: str, g: float) -> np.ndarray:
        """유리 같은 울림: 그 음 주기의 되먹임 빗살 필터 (원형, 정확)"""
        d = R / hz(note)
        return self.shape(y, lambda f: 1 / np.abs(1 - g * np.exp(-2j * np.pi * f * d / R)))

    def grains(self, y: np.ndarray, count: int, dur=(0.04, 0.12)) -> np.ndarray:
        """y를 짧은 알갱이로 (잎 바스락): 무작위 자리의 짧은 언덕들, 끝은 처음으로 감김"""
        env = np.zeros(self.n)
        for _ in range(count):
            L = int(self.rng.uniform(*dur) * R)
            at = int(self.rng.random() * self.n)
            np.add.at(env, (at + np.arange(L)) % self.n, np.hanning(L) * self.rng.uniform(0.4, 1.0))
        return unit(y * env)

    def glints(self, count: int, notes, dur=(0.4, 1.0), partials=((1.0, 1.0),), glide: float = 0.0, attack: float = 0.02) -> np.ndarray:
        """맑은 반짝임 · 방울: 부드럽게 올라와 잦아드는 짧은 음, 끝은 0, 바퀴 끝을 넘으면 처음으로 감김. glide = 초당 음높이 비 (방울은 위로)"""
        y = np.zeros(self.n)
        for _ in range(count):
            L = int(self.rng.uniform(*dur) * R)
            tt = np.arange(L) / R
            T = L / R
            env = (1 - np.exp(-tt / attack)) * (1 - tt / T) ** 2.5
            f0 = hz(self.rng.choice(notes)) * self.rng.uniform(0.997, 1.003)
            ph = 2 * np.pi * f0 * (tt + 0.5 * glide * tt**2)
            s = sum(a * np.sin(r * ph + self.rng.random() * 6.28) * (1 - tt / T) ** (r - 1) for r, a in partials)
            at = int(self.rng.random() * self.n)
            np.add.at(y, (at + np.arange(L)) % self.n, env * s * self.rng.uniform(0.5, 1.0))
        return unit(y)

    def blur(self, y: np.ndarray, amount: float) -> np.ndarray:
        """위상을 조금씩 흐트러뜨림 (안개처럼 번진 겹침)"""
        X = np.fft.rfft(y)
        return np.fft.irfft(X * np.exp(1j * amount * 2 * np.pi * self.rng.standard_normal(len(X))), self.n)

    def reverb(self, y: np.ndarray, rt: float, mix: float, lo: float = 150, hi: float = 9000) -> np.ndarray:
        """원형 합성곱 울림 (rt = -60 dB까지 초). 울림 꼬리도 다음 바퀴 처음으로 이어짐"""
        L = min(self.n, int(rt * R))
        tt = np.arange(L) / R
        h = np.zeros(self.n)
        h[:L] = self.rng.standard_normal(L) * np.exp(-6.9 * tt / rt)
        H = np.fft.rfft(h)
        band = 1 / (1 + (lo / np.maximum(self.f, 1)) ** 2) / (1 + (self.f / hi) ** 2)
        wet = np.fft.irfft(np.fft.rfft(y) * H * band, self.n)
        return (1 - mix) * y + mix * wet * rms(y) / rms(wet)


def mix(*layers) -> np.ndarray:
    """(소리, dB) 쌍들을 단위 세기 기준으로 섞음"""
    return sum(unit(y) * db(g) for y, g in layers)


def finish(y: np.ndarray) -> np.ndarray:
    y = y - y.mean()
    lim = db(PEAK_DB)
    for _ in range(8):  # 세기를 맞추고 넘치는 첨두만 부드럽게 누름 (모든 샘플에 같은 곡선이라 이음새 그대로)
        y = y * db(RMS_DB) / rms(y)
        if np.max(np.abs(y)) <= lim:
            break
        y = np.where(np.abs(y) > 0.7 * lim, np.sign(y) * (0.7 * lim + 0.3 * lim * np.tanh((np.abs(y) - 0.7 * lim) / (0.3 * lim))), y)
    return y * min(1.0, lim / np.max(np.abs(y)))


# Soft casting beds. Original synthesis only; no reference samples or extracted spectra.
PROFILES = {
    "priest": (6.4, 101, "D2", "A2", "D3", "A3"),
    "druid": (7.2, 102, "C2", "G2", "C3", "G3"),
    "paladin": (8.0, 103, "A1", "E2", "A2", "E3"),
    "shaman": (6.8, 104, "E2", "B2", "E3", "B3"),
    "monk": (7.6, 105, "G2", "D3", "G3", "D4"),
    "astrologer": (6.4, 106, "A2", "E3", "A3", "E4"),
    "warder": (6.8, 107, "F#2", "C#3", "F#3", "C#4"),
}


def soft_cast(name):
    sec, seed, root, fifth, octave, upper = PROFILES[name]
    L = Loop(sec, seed)
    # Nearby low clusters breathe slowly; the brighter classes keep a bass bed.
    bass = L.pad(root, (1, .32, .20, .10, .05), (-2, -1, 0, 1, 2))
    under = L.pad(root, (1,), (0,))
    body = mix((L.pad(fifth, (1, .16)), 0),
               (L.pad(octave, (1, .10)), -6),
               (L.breath([octave, upper], 2.2), -12))
    body = L.lowpass(body, 850, 3) * L.swell(.8, 4, .6)
    air = L.noise(6800, 16000, soft=.12, tilt=-2)
    air *= L.swell(1.2, 3, .4) * L.swell(.6, 6, 1.1)
    # Long-attack material textures, without exposed bells / water transients.
    if name == "priest":
        colour = L.formant(L.stack(octave, 1800, 1.4),
                           [(430, 150, 0), (800, 190, -9)])
        colour = L.lowpass(colour, 1200, 3)
    elif name == "druid":
        colour = L.grains(L.noise(650, 2600, tilt=-4), 24, (.22, .65))
        colour = L.reverb(colour, 1.8, .65, hi=2300)
    elif name == "paladin":
        colour = L.lowpass(np.tanh(.8 * L.stack(octave, 1700, 1.3)), 900, 3)
        colour += .15 * L.noise(180, 650, tilt=-3)
    elif name == "shaman":
        fade = .5 + .5 * L.lfo(1, .7)
        colour = L.breath([octave], 9) * fade
        colour += L.breath([upper], 7) * (1 - fade)
        colour += .18 * L.noise(650, 2200, tilt=-3)
    elif name == "monk":
        colour = L.blur(L.breath([octave, upper], 12), .45)
        colour += .3 * L.noise(300, 1500, tilt=-4)
        colour = L.lowpass(colour, 1300, 3)
    elif name == "astrologer":
        colour = L.reverb(L.breath([upper], 4), 3.2, .7, hi=2000)
        colour += .12 * L.noise(7500, 13000, soft=.12)
    else:
        colour = L.comb(L.noise(280, 1800, tilt=-4), upper, .87)
        colour = L.lowpass(colour, 1700, 3) * L.swell(.8, 2, .4)
    # Keep air quiet and the 1–6 kHz region recessed to reduce listening fatigue.
    y = mix((bass, 0), (under, -12), (body, -5),
            (colour, -17 if name == "priest" else -22), (air, -20))
    if name == "priest":
        # Fine, irregular sizzling rather than exposed crackles. Circular Hann
        # grains have soft attacks, and every tail wraps across the loop join.
        sizzle = L.grains(L.noise(5700, 14500, soft=.14, tilt=-2.5),
                          480, (.008, .032))
        sizzle = L.reverb(sizzle, .24, .22, lo=5200, hi=13000)
        sizzle *= L.swell(1.4, 3, .8) * L.swell(.7, 7, .2)
        # A very quiet lower texture keeps it audible on small speakers without
        # filling the fatiguing 2.5–6 kHz region or distorting the bass bed.
        grain = L.grains(L.noise(1100, 2200, soft=.12, tilt=-2),
                         160, (.025, .075))
        y = y + unit(sizzle) * db(-17) + unit(grain) * db(-33)
    y *= L.swell(2.8, 1, -.9) * L.swell(.45, 5, .2)
    return L.reverb(y, 2.8, .18, lo=140, hi=1600)


def priest():
    return soft_cast("priest")


def druid():
    return soft_cast("druid")


def paladin():
    return soft_cast("paladin")


def shaman():
    return soft_cast("shaman")


def monk():
    return soft_cast("monk")


def astrologer():
    return soft_cast("astrologer")


def warder():
    return soft_cast("warder")


MAKERS = {"priest": priest, "druid": druid, "paladin": paladin, "shaman": shaman, "monk": monk, "astrologer": astrologer, "warder": warder}


def write_ogg(path: Path, y: np.ndarray) -> None:
    with sf.SoundFile(str(path), "w", R, 1, format="OGG", subtype="VORBIS", compression_level=QUALITY) as f:
        for i in range(0, len(y), 8192):
            f.write(y[i : i + 8192])


def main() -> None:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("src/sfx")
    out.mkdir(parents=True, exist_ok=True)
    names = sys.argv[2:] or list(MAKERS)
    for h in names:
        y = finish(MAKERS[h]())
        dst = out / f"cast-loop-{h}.ogg"
        write_ogg(dst, y)
        print(f"{h}: {len(y) / R:.2f}s RMS {20 * np.log10(rms(y)):.1f} dBFS 첨두 {20 * np.log10(np.max(np.abs(y))):.1f} dBFS {dst.stat().st_size}B")


if __name__ == "__main__":
    main()
