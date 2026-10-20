"""
앱 안 글꼴 만들기 (2026-10-20 Lim 「a 폰트 넣어」): 예전엔 실행할 때마다 Google Fonts에서 받아 인터넷이 없거나 느리면 다른 글꼴로 보였음.
원본 (OFL, google/fonts 저장소의 가변 글꼴)은 기획 폴더 나혼자힐러/리소스/fonts-src에 두고, 여기서 굵기마다 고정 인스턴스로 바꾼 뒤
게임 글자 (src 전체 + index.html) + KS X 1001 한글 2,350자 + 자모 + ASCII · 기호만 남겨 woff2로 src/fonts/에 씀.
굵기는 예전 Google 링크와 같은 Hahmlet 700 · 800, Noto Sans KR 400 · 500 · 700 · 900 (600 · 800은 브라우저가 예전처럼 가까운 굵기로).

  python3 -m pip install --user fonttools brotli   # 한 번
  python3 scripts/fonts/subset.py [원본 폴더]
새 글자 (닉네임 · 대사)를 넣으면 다시 돌린다. 빠진 글자는 기기 글꼴로 보임.
"""
import os, sys, glob
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# 원본 자리: 맥 체크아웃 (저장소 안 나혼자힐러/, git에는 안 올림) 또는 worktrees/<이름>에서 두 단계 위
SRC = sys.argv[1] if len(sys.argv) > 1 else next((p for p in (os.path.join(ROOT, '나혼자힐러', '리소스', 'fonts-src'), os.path.join(ROOT, '..', '..', '나혼자힐러', '리소스', 'fonts-src')) if os.path.isdir(p)), '')
if not os.path.isdir(SRC): sys.exit('원본 글꼴 폴더가 없음: 나혼자힐러/리소스/fonts-src (google/fonts ofl/notosanskr · ofl/hahmlet 가변 TTF)')
OUT = os.path.join(ROOT, 'src', 'fonts')
os.makedirs(OUT, exist_ok=True)

chars = set(chr(c) for c in range(0x20, 0x7F))
chars |= set(chr(c) for c in range(0x3131, 0x3164))  # 한글 자모 (ㅋㅋ · ㅠㅠ)
for hi in range(0xB0, 0xC9):  # KS X 1001 완성형 2,350자
    for lo in range(0xA1, 0xFF):
        try: chars.add(bytes([hi, lo]).decode('euc-kr'))
        except UnicodeDecodeError: pass
chars |= set('·×→←↑↓↖↗↘↙★☆♥♡…「」『』《》〈〉“”‘’—–•∞±%‰℃①②③④⑤⑥⑦⑧⑨⑩✓✕✚▲▼▶◀◆◇○●□■△▽※～')
files = [p for ext in ('ts', 'css', 'html', 'mjs') for p in glob.glob(os.path.join(ROOT, 'src', '**', f'*.{ext}'), recursive=True)] + [os.path.join(ROOT, 'index.html')]
for p in files:
    with open(p, encoding='utf-8') as f: chars |= set(f.read())
chars = {c for c in chars if c.isprintable() or c == ' '}
hangul = sum(1 for c in chars if '가' <= c <= '힣')
print(f'글자 {len(chars)} (한글 완성형 {hangul})')

JOBS = [('Hahmlet[wght].ttf', 'hahmlet', [700, 800]), ('NotoSansKR[wght].ttf', 'noto-sans-kr', [400, 500, 700, 900])]
text = ''.join(sorted(chars))
for src, name, weights in JOBS:
    for w in weights:
        font = TTFont(os.path.join(SRC, src))
        inst = instancer.instantiateVariableFont(font, {'wght': w})
        opts = subset.Options()
        opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True
        opts.hinting = False; opts.desubroutinize = True
        sub = subset.Subsetter(opts); sub.populate(text=text); sub.subset(inst)
        out = os.path.join(OUT, f'{name}-{w}.woff2')
        inst.flavor = 'woff2'; inst.save(out)
        print(out, os.path.getsize(out) // 1024, 'KB')
