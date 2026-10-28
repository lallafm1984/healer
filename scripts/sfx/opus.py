"""효과음을 Ogg Vorbis → Ogg Opus로 (2026-10-28 Lim, APK 줄이기 「1,2,3」).

짧은 효과음 900여 개가 Vorbis 약 148 kbps (파일마다 머리 4 KB)라 Opus 모노 약 48 kbps로 다시 굽는다 (전체 약 40%).
확장자 .ogg 그대로 (src/sfx/index.ts가 decodeAudioData로 풂, 안드로이드 웹뷰는 Ogg Opus를 읽음).
그대로 두는 것: 확정 사제 효과음 (scripts/sfx/priest-approved.json, 해시를 tests/sfx.test.ts가 봄) ·
이음새 없이 반복하는 소리 (시전음 cast-loop-* · 쉬는 화면 rest-loop: Opus 앞뒤 채움이 이음새를 만들 수 있음).
길이 · 세기는 그대로 (48 kHz로 다시 표본화만). 이미 Opus인 파일은 건너뛴다. 새 효과음을 Vorbis로 만들었으면 이것을 다시 돌린다.

실행:
  uv run --no-project --with numpy --with soundfile python -I scripts/sfx/opus.py src/sfx
"""

import json
import os
import sys
import tempfile
from pathlib import Path

import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "bgm"))
from importlib import import_module

resample = import_module("import").resample

# libsndfile Opus 압축 정도: 모노 0.85 ≈ 48 kbps (0.8 ≈ 64, 0.9 ≈ 35)
LEVEL = 0.85
LOOPS = ("cast-loop", "rest-loop")


def main() -> None:
    root = Path(sys.argv[1])
    approved = {Path(f["file"]).name for f in json.loads((Path(__file__).parent / "priest-approved.json").read_text(encoding="utf-8"))["files"]}
    before = after = 0
    done = 0
    for p in sorted(root.glob("*.ogg")):
        size = p.stat().st_size
        before += size
        info = sf.info(str(p))
        if p.name in approved or p.name.startswith(LOOPS) or info.subtype == "OPUS":
            after += size
            continue
        x, sr = sf.read(str(p), dtype="float32", always_2d=True)
        y = resample(x, sr, 48000)
        fd, tmp = tempfile.mkstemp(suffix=".ogg", dir=tempfile.gettempdir())
        os.close(fd)
        with sf.SoundFile(tmp, "w", 48000, y.shape[1], format="OGG", subtype="OPUS", compression_level=LEVEL) as f:
            f.write(y)
        new = os.path.getsize(tmp)
        if new < size:
            os.replace(tmp, p)
            after += new
            done += 1
        else:
            os.remove(tmp)
            after += size
    print(f"{done}개 바꿈 · 합계 {before / 1048576:.2f}MB → {after / 1048576:.2f}MB")


main()
