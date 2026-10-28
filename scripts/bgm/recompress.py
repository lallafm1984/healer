"""전투 배경음만 음질을 다시 맞추기 (2026-10-28 Lim 「음질은 24k로 줄여보자. 전투곡을 자르지는 말아줘」).

src/bgm의 전투 곡 (지역 · 새 장소, title · lobby · victory · defeat 빼고)을 풀어 import.py의 OPUS_LEVEL_BATTLE (약 24 kbps)로 다시 굽는다.
길이 · 세기 · 페이드는 그대로 (자르지 않음). 이미 그 비트율 근처 (+1 kbps 안)인 곡은 건너뛴다.
원본 MP3 (배경음 등록판)에서 새로 넣을 때는 import.py가 같은 값을 쓰므로 이 스크립트는 필요 없다.

실행:
  uv run --no-project --with numpy --with soundfile python -I scripts/bgm/recompress.py src/bgm
"""

import os
import sys
import tempfile
from pathlib import Path

import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module

OPUS_LEVEL_BATTLE = import_module("import").OPUS_LEVEL_BATTLE
KEEP = ("title-", "lobby-", "victory-", "defeat-")
TARGET_KBPS = 24.0


def kbps(path: Path, frames: int, sr: int) -> float:
    return path.stat().st_size * 8 / (frames / sr) / 1000


def main() -> None:
    root = Path(sys.argv[1])
    before = after = 0
    for p in sorted(root.glob("*.ogg")):
        size = p.stat().st_size
        before += size
        if p.name.startswith(KEEP):
            after += size
            continue
        info = sf.info(str(p))
        if kbps(p, info.frames, info.samplerate) <= TARGET_KBPS + 1:
            after += size
            continue
        x, sr = sf.read(str(p), dtype="float32", always_2d=True)
        fd, tmp = tempfile.mkstemp(suffix=".ogg", dir=str(root))
        os.close(fd)
        with sf.SoundFile(tmp, "w", sr, x.shape[1], format="OGG", subtype="OPUS", compression_level=OPUS_LEVEL_BATTLE) as f:
            f.write(x)
        new = os.path.getsize(tmp)
        if new < size:
            os.replace(tmp, p)
            after += new
        else:
            os.remove(tmp)
            after += size
        print(f"{p.name:28} {size // 1024}KB → {min(new, size) // 1024}KB")
    print(f"\n합계 {before / 1048576:.1f}MB → {after / 1048576:.1f}MB")


main()
