"""
앱 안 글꼴 만들기 (2026-10-20 Lim 「a 폰트 넣어」): 예전엔 실행할 때마다 Google Fonts에서 받아 인터넷이 없거나 느리면 다른 글꼴로 보였음.
원본 (OFL, google/fonts 저장소의 가변 글꼴)은 기획 폴더 나혼자힐러/리소스/fonts-src에 두고, 여기서 굵기마다 고정 인스턴스로 바꾼 뒤
게임 글자 (src 전체 + index.html) + KS X 1001 한글 2,350자 + 자모 + ASCII · 기호만 남겨 woff2로 src/fonts/에 씀.
굵기는 예전 Google 링크와 같은 Hahmlet 700 · 800, Noto Sans KR 400 · 500 · 700 · 900 (600 · 800은 브라우저가 예전처럼 가까운 굵기로).

일본어 (2026-10-29 Lim 「일본어 글꼴을 받아」, 기획 121 7장): Noto Serif JP 700 · 800 (제목, 함렛 자리) · Noto Sans JP 400 · 500 · 700 · 900 (본문).
한자 전체를 넣지 않고 게임 글자 (src/i18n/ja.ts 등 src 전체) 에 있는 한자 + 가나 전부 + 일본어 문장 부호만 (글자가 없으면 기기 글꼴로 보임).
한국어 글꼴에는 가나 · 한자를 넣지 않는다 (일본어는 html[lang="ja"]가 JP 글꼴을 앞에 둠, src/theme.css).

  python3 -m pip install --user fonttools brotli   # 한 번
  python3 scripts/fonts/subset.py [원본 폴더] [--only=ko|ja]
새 글자 (닉네임 · 대사 · 번역)를 넣으면 다시 돌린다 (일본어 번역을 더했으면 --only=ja). 빠진 글자는 기기 글꼴로 보임.
"""
import os, sys, glob
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
only = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--only=')), '')
# 원본 자리: 맥 체크아웃 (저장소 안 나혼자힐러/, git에는 안 올림) 또는 worktrees/<이름>에서 두 단계 위
SRC = args[0] if args else next((p for p in (os.path.join(ROOT, '나혼자힐러', '리소스', 'fonts-src'), os.path.join(ROOT, '..', '..', '나혼자힐러', '리소스', 'fonts-src')) if os.path.isdir(p)), '')
if not os.path.isdir(SRC): sys.exit('원본 글꼴 폴더가 없음: 나혼자힐러/리소스/fonts-src (google/fonts ofl/notosanskr · ofl/hahmlet · ofl/notosansjp · ofl/notoserifjp 가변 TTF)')
OUT = os.path.join(ROOT, 'src', 'fonts')
os.makedirs(OUT, exist_ok=True)

is_kana = lambda c: 0x3041 <= ord(c) <= 0x30FF
is_kanji = lambda c: 0x4E00 <= ord(c) <= 0x9FFF or 0x3400 <= ord(c) <= 0x4DBF
is_ja_punct = lambda c: 0x3000 <= ord(c) <= 0x303F or 0xFF01 <= ord(c) <= 0xFF5E

base = set(chr(c) for c in range(0x20, 0x7F))
base |= set('·×→←↑↓↖↗↘↙★☆♥♡…「」『』《》〈〉“”‘’—–•∞±%‰℃①②③④⑤⑥⑦⑧⑨⑩✓✕✚▲▼▶◀◆◇○●□■△▽※～')
files = [p for ext in ('ts', 'css', 'html', 'mjs') for p in glob.glob(os.path.join(ROOT, 'src', '**', f'*.{ext}'), recursive=True)] + [os.path.join(ROOT, 'index.html')]
used = set()
for p in files:
    with open(p, encoding='utf-8') as f: used |= set(f.read())
used = {c for c in used if c.isprintable() or c == ' '}

# 한국어: 자모 + KS X 1001 완성형 2,350자 + 쓰인 글자 (가나 · 한자 빼고)
ko = set(base) | set(chr(c) for c in range(0x3131, 0x3164)) | {c for c in used if not (is_kana(c) or is_kanji(c) or is_ja_punct(c))}
for hi in range(0xB0, 0xC9):
    for lo in range(0xA1, 0xFF):
        try: ko.add(bytes([hi, lo]).decode('euc-kr'))
        except UnicodeDecodeError: pass
# 일본어: 가나 전부 + 일본어 문장 부호 + 쓰인 한자 (한글은 KR 글꼴이 맡음)
ja = set(base) | set(chr(c) for c in range(0x3041, 0x3100)) | set('、。〃々〆〇「」『』【】〒〔〕〜・ー！？（）：；＜＞［］～　')
ja |= {c for c in used if is_kanji(c) or is_ja_punct(c)}
print(f'한국어 글자 {len(ko)} (완성형 {sum(1 for c in ko if "가" <= c <= "힣")}) · 일본어 글자 {len(ja)} (한자 {sum(1 for c in ja if is_kanji(c))})')

JOBS = [
    ('ko', 'Hahmlet[wght].ttf', 'hahmlet', [700, 800], ko),
    ('ko', 'NotoSansKR[wght].ttf', 'noto-sans-kr', [400, 500, 700, 900], ko),
    ('ja', 'NotoSerifJP[wght].ttf', 'noto-serif-jp', [700, 800], ja),
    ('ja', 'NotoSansJP[wght].ttf', 'noto-sans-jp', [400, 500, 700, 900], ja),
]
for lang, src, name, weights, chars in JOBS:
    if only and lang != only: continue
    text = ''.join(sorted(chars))
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
