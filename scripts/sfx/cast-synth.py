"""시전음 합성 (2026-10-27 Lim 「저작권 문제 없이 해당 원본을 참고해서 새롭게 만들어보자」): src/sfx/cast-loop-<직업>.ogg 7개.

원본 음원은 읽지 않는다. 예전 사제 시전음 (와우 원본)에서 잰 느낌만 따름: 낮은 D 울림이 가장 크고 (150Hz 밑),
그 위에 성가대 같은 중음, 6kHz 위 맑은 숨결 · 반짝임, 한 바퀴에 한 번 천천히 부푸는 움직임.
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
PEAK_DB = -1.0
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


# ---------- 직업마다 (예전 6직업 변형의 방향을 그대로: 드루이드 낮고 따뜻하게 · 잎, 성기사 낮고 금관, 주술사 흐르는 겹침 · 물,
# 수도사 부드럽고 안개, 점성술사 높고 밝게 · 별, 결계사 조금 높게 · 유리 울림 · 느린 맥박) ----------


def priest() -> np.ndarray:
    """사제: 낮은 D 성가 울림 + 「아」 성가대 + 맑은 숨결 · 높은 반짝임, 한 바퀴에 한 번 부풂 (6.4초)"""
    L = Loop(6.4, 1)
    drone = mix(
        (L.pad("D2", (1, 0.45, 0.25, 0.12, 0.06)), 0),
        (L.pad("A1", (1, 0.2)), -10),
        (L.pad("A2", (1, 0.3, 0.15)), -5),
        (L.pad("D3", (1, 0.25)), -8),
        (L.pad("E3", (1, 0.2)), -14),
        (L.pad("A3", (1,)), -14),
    ) * L.swell(1.5, 4, 0.3)
    choir = L.formant(L.stack("D3", 4500, 1.1) + L.stack("A3", 4500, 1.1), [(650, 120, 0), (1050, 140, -6), (2600, 250, -18), (3300, 300, -22)])
    choir = unit(choir) * L.swell(3, 2, 1.1)
    air = L.noise(5000, 19000) * L.swell(4, 3, 0.4) * L.swell(2, 5)
    sparkle = L.glints(14, ["D7", "E7", "F#7", "A7", "B7"], (0.5, 1.1), ((1, 1), (2, 0.25)), attack=0.05)
    y = mix((drone, 0), (choir, -13), (air, -15), (sparkle, -24)) * L.swell(2.5, 1)
    return L.reverb(y, 3.0, 0.35)


def druid() -> np.ndarray:
    """드루이드: 낮은 C 따뜻한 울림 (높은 소리를 눌러) + 피리 같은 숨결 + 잎 바스락 (7.2초)"""
    L = Loop(7.2, 2)
    drone = mix(
        (L.pad("C2", (1, 0.35, 0.15)), 0),
        (L.pad("G2", (1, 0.25)), -3),
        (L.pad("C3", (1, 0.2)), -5),
        (L.pad("D3", (1,)), -10),
        (L.pad("G3", (1,)), -10),
        (L.pad("C4", (1,)), -14),
    ) * L.swell(1.5, 3)
    drone = L.lowpass(drone, 1800)
    flute = L.breath(["G4", "C5", "D5"], 4.0) * L.swell(4, 2, 0.8)
    rustle = L.grains(L.noise(2000, 7000, tilt=-2), 30) * L.swell(3, 3, 2.0)
    air = L.noise(4000, 11000) * L.swell(3, 2)
    y = mix((drone, 0), (flute, -16), (rustle, -21), (air, -27)) * L.swell(2.5, 1)
    return L.reverb(y, 2.4, 0.3)


def paladin() -> np.ndarray:
    """성기사: 낮은 A 장엄한 울림 + 눌러 데운 금관 + 낮게 일렁이는 성스러운 불길 + 드문 종 반짝임 (8.0초)"""
    L = Loop(8.0, 3)
    drone = mix(
        (L.pad("A1", (1, 0.5, 0.3, 0.15)), 0),
        (L.pad("E2", (1, 0.35, 0.15)), -4),
        (L.pad("A2", (1, 0.25)), -7),
        (L.pad("C#3", (1,)), -9),
        (L.pad("E3", (1,)), -9),
        (L.pad("A3", (1,)), -12),
    ) * L.swell(1.5, 4)
    brass = unit(L.stack("A2", 3500, 0.9) + 0.7 * L.stack("E3", 3500, 0.9))
    brass = L.lowpass(np.tanh(2.5 * brass), 1800) * L.swell(3, 2, 0.5)
    flame = L.noise(150, 900) * L.swell(3, 5) * L.swell(2, 3, 1.3)
    bells = L.glints(6, ["A5", "C#6", "E6"], (0.8, 1.4), ((1, 1), (2.4, 0.45), (3.9, 0.2)), attack=0.01)
    air = L.noise(6000, 12000) * L.swell(3, 2)
    y = mix((drone, 0), (brass, -9), (flame, -24), (bells, -24), (air, -27)) * L.swell(2.5, 1)
    return L.reverb(y, 3.2, 0.35)


def shaman() -> np.ndarray:
    """주술사: 낮은 E 넓게 흐르는 두 겹 울림 (한 바퀴에 한 번 서로 넘어감) + 퐁퐁 물방울 + 흐르는 물결 (6.8초)"""
    L = Loop(6.8, 4)
    wide = (-2, -1, 0, 1, 2)
    low = mix(
        (L.pad("E2", (1, 0.35, 0.15), wide), 0),
        (L.pad("B2", (1, 0.25), wide), -5),
        (L.pad("E3", (1, 0.2), wide), -8),
        (L.pad("F#3", (1,), wide), -13),
        (L.pad("B3", (1,), wide), -14),
    )
    high = mix((L.pad("E4", (1,), wide), 0), (L.pad("B4", (1,), wide), -3), (L.pad("E5", (1,), wide), -7))
    fade = 0.5 + 0.5 * L.lfo(1)
    flow = unit(low) * (1 - 0.35 * fade) + unit(high) * db(-7) * (0.3 + fade)
    drops = L.glints(40, ["E5", "G#5", "B5", "C#6", "E6"], (0.04, 0.09), ((1, 1),), glide=3.0, attack=0.004)
    water = L.noise(800, 4000, tilt=-1) * L.swell(4, 3) * L.swell(3, 7, 0.9)
    shimmer = L.noise(4000, 10000) * L.swell(4, 5, 0.2)
    y = mix((flow, 0), (drops, -14), (water, -23), (shimmer, -27)) * L.swell(2, 1)
    return L.reverb(y, 2.2, 0.3)


def monk() -> np.ndarray:
    """수도사: 맑은 G 사인 울림 (부드럽게) + 위상이 번진 안개 겹침 + 천천히 오가는 바람 + 드문 대나무 풍경 (7.6초)"""
    L = Loop(7.6, 5)
    drone = mix(
        (L.pad("G2", (1, 0.15)), 0),
        (L.pad("D3", (1, 0.1)), -5),
        (L.pad("G3", (1,)), -9),
        (L.pad("A3", (1,)), -13),
        (L.pad("D4", (1,)), -11),
        (L.pad("G4", (1,)), -15),
    ) * L.swell(1.5, 3)
    mist = L.blur(drone, 0.35) * L.swell(3, 2, 1.7)
    fade = 0.5 + 0.5 * L.lfo(1, 0.6)
    fog = L.noise(300, 900) * fade + L.noise(900, 2500) * (1 - fade)
    wind = L.noise(1000, 6000, tilt=-3) * L.swell(6, 2, 2.4)
    chimes = L.glints(5, ["G5", "A5", "D6"], (0.4, 0.8), ((1, 1), (2.9, 0.35), (5.1, 0.12)), attack=0.006)
    y = mix((drone, 0), (mist, -8), (fog, -13), (wind, -22), (chimes, -23)) * L.swell(2, 1)
    return L.lowpass(L.reverb(y, 3.6, 0.45), 3500, 1)


def astrologer() -> np.ndarray:
    """점성술사: 한 옥타브 높은 A 밝은 울림 + 아주 낮은 우주 울림 + 자주 반짝이는 별 종소리 + 맑은 숨결 (5.1초)"""
    L = Loop(5.1, 6)
    drone = mix(
        (L.pad("A3", (1, 0.3, 0.15)), 0),
        (L.pad("E4", (1, 0.25)), -4),
        (L.pad("A4", (1, 0.15)), -7),
        (L.pad("B4", (1,)), -12),
        (L.pad("E5", (1,)), -13),
    ) * L.swell(1.5, 3)
    cosmos = L.pad("A1", (1, 0.3), (-1, 1)) * L.swell(3, 2, 0.4)
    stars = L.glints(20, ["A6", "B6", "C#7", "E7", "F#7"], (0.25, 0.6), ((1, 1), (2.76, 0.4), (5.4, 0.15)), attack=0.003)
    air = L.noise(7000, 16000) * L.swell(4, 4)
    y = mix((drone, 0), (cosmos, -3), (stars, -15), (air, -19)) * L.swell(2.5, 1)
    return L.reverb(y, 3.0, 0.4)


def warder() -> np.ndarray:
    """결계사: 높은 F# 울림 (아래 F#은 옅게) + 빗살 필터로 만든 유리 울림 + 한 바퀴에 두 번 느린 맥박 + 수정 핑 (5.7초)"""
    L = Loop(5.7, 7)
    drone = mix(
        (L.pad("F#2", (1, 0.3)), -4),
        (L.pad("F#3", (1, 0.35, 0.2)), 0),
        (L.pad("C#4", (1, 0.25)), -4),
        (L.pad("F#4", (1, 0.2)), -7),
        (L.pad("G#4", (1,)), -12),
        (L.pad("C#5", (1,)), -14),
    )
    src = L.noise(200, 8000)
    glass = unit(L.comb(src, "F#4", 0.985)) + 0.6 * unit(L.comb(src, "C#5", 0.985))
    glass = L.shape(glass, lambda f: 1 / (1 + (1000 / np.maximum(f, 1)) ** 2) / (1 + (f / 6000) ** 2)) * L.swell(3, 3, 0.9)
    pings = L.glints(8, ["F#6", "C#7", "F#7"], (0.3, 0.7), ((1, 1), (2.0, 0.3), (3.0, 0.15), (4.2, 0.08)), attack=0.002)
    air = L.noise(6000, 14000) * L.swell(3, 3)
    y = mix((drone, 0), (glass, -12), (pings, -22), (air, -25)) * L.swell(3, 2)
    return L.reverb(y, 2.6, 0.3)


MAKERS = {"priest": priest, "druid": druid, "paladin": paladin, "shaman": shaman, "monk": monk, "astrologer": astrologer, "warder": warder}


def write_ogg(path: Path, y: np.ndarray) -> None:
    with sf.SoundFile(str(path), "w", R, 1, format="OGG", subtype="VORBIS", compression_level=QUALITY) as f:
        for i in range(0, len(y), 8192):
            f.write(y[i : i + 8192])


def main() -> None:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("src/sfx")
    names = sys.argv[2:] or list(MAKERS)
    for h in names:
        y = finish(MAKERS[h]())
        dst = out / f"cast-loop-{h}.ogg"
        write_ogg(dst, y)
        print(f"{h}: {len(y) / R:.2f}s RMS {20 * np.log10(rms(y)):.1f} dBFS 첨두 {20 * np.log10(np.max(np.abs(y))):.1f} dBFS {dst.stat().st_size}B")


if __name__ == "__main__":
    main()
