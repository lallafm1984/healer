"""
게임 그림을 한꺼번에 다시 굽기 (2026-10-28 Lim 「이미지 리소스를 최대한 용량을 줄여서 apk 용량을 줄여보자」).
크기 · 품질 규칙은 art-optimize.mjs의 RULES 한 곳 (이 스크립트가 그 줄을 읽음). 인코더만 다르다:
Pillow (libwebp method 6, 투명도 품질 aq)라 Chromium 캔버스 인코더보다 같은 품질에서 10%쯤 작다.

원본: ../나혼자힐러/리소스/generated-*-originals/<이름>.png (가장 최근 폴더)가 지금 그림과 같은 그림일 때만 쓴다
(비율이 같고 작게 줄인 모습이 거의 같음, 원본을 뒤에 손본 그림을 되돌리지 않게). 아니면 지금 파일을
../나혼자힐러/리소스/art-앱원본/에 한 번 보관해 두고 그 보관본에서 굽는다 (여러 번 돌려도 화질이 깎이지 않게).
더 작아질 때만 바꾼다.

사용: python3 scripts/art-slim.py [--dry] [--only=앞머리,앞머리] [--skip=앞머리,앞머리] [--out=폴더]
  --only=boss-,mob-   이름이 이 앞머리로 시작하는 그림만
  --skip=fx-skill-    이 앞머리는 빼고 (큰 묶음은 따로 나란히 돌릴 때)
  --out=폴더           src/art를 바꾸지 않고 그 폴더에 씀 (비교용)
"""
import io
import os
import re
import shutil
import sys

from PIL import Image, ImageChops, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'src', 'art')


def find_res():
    """기획 폴더의 리소스 (generated-*-originals가 있는 곳). 저장소 (healer/healer)든 워크트리 (healer/worktrees/x)든 위로 올라가며 찾음"""
    d = ROOT
    for _ in range(4):
        d = os.path.dirname(d)
        p = os.path.join(d, '나혼자힐러', '리소스')
        if os.path.isdir(p) and any(x.startswith('generated-') for x in os.listdir(p)):
            return p
    return os.path.normpath(os.path.join(ROOT, '..', '나혼자힐러', '리소스'))


RES = find_res()
KEEP = os.path.join(RES, 'art-앱원본')
# 예전 art-optimize.mjs를 워크트리에서 돌리면 보관본이 healer/worktrees/나혼자힐러/리소스/art-앱원본에 쌓였음: 거기도 봄
OLD_KEEP = os.path.normpath(os.path.join(ROOT, '..', '나혼자힐러', '리소스', 'art-앱원본'))
KEEPS = [k for k in dict.fromkeys([KEEP, OLD_KEEP]) if os.path.isdir(k)]

args = sys.argv[1:]
dry = '--dry' in args
only = next((a[7:].split(',') for a in args if a.startswith('--only=')), None)
skip = next((a[7:].split(',') for a in args if a.startswith('--skip=')), [])
out_dir = next((a[6:] for a in args if a.startswith('--out=')), None)


def load_rules():
    src = open(os.path.join(ROOT, 'scripts', 'art-optimize.mjs'), encoding='utf-8').read()
    rules = []
    for m in re.finditer(r'\{\s*re:\s*/(.+?)/,\s*w:\s*(\d+),\s*h:\s*(\d+),\s*q:\s*([\d.]+)(?:,\s*aq:\s*([\d.]+))?(?:,\s*keep:\s*(true))?\s*\}', src):
        rules.append({'re': re.compile(m.group(1)), 'w': int(m.group(2)), 'h': int(m.group(3)), 'q': float(m.group(4)),
                      'aq': float(m.group(5)) if m.group(5) else 1.0, 'keep': bool(m.group(6))})
    if not rules:
        raise SystemExit('art-optimize.mjs RULES를 못 읽음')
    return rules


RULES = load_rules()


def rule_of(name):
    return next((r for r in RULES if r['re'].search(name)), {'w': 1200, 'h': 1200, 'q': 0.8, 'aq': 1.0, 'keep': False})


ORIG_DIRS = sorted((d for d in (os.listdir(RES) if os.path.isdir(RES) else []) if re.match(r'^generated-.*-originals$', d)), reverse=True)


def originals_of(name):
    """원본 후보: Codex 원본 PNG (최근 폴더 먼저) → 보관해 둔 PNG"""
    out = [os.path.join(RES, d, name + '.png') for d in ORIG_DIRS]
    out += [os.path.join(k, name + '.png') for k in KEEPS]
    return [p for p in out if os.path.exists(p)]


def kept_of(f):
    return next((os.path.join(k, f) for k in KEEPS if os.path.exists(os.path.join(k, f))), None)


def same_picture(a, b):
    """비율이 같고 48px로 줄인 모습의 평균 차이가 작으면 같은 그림"""
    if abs(a.width / a.height - b.width / b.height) > 0.01:
        return False
    sa, sb = a.convert('RGBA').resize((48, 48), Image.BILINEAR), b.convert('RGBA').resize((48, 48), Image.BILINEAR)
    diff = ImageStat.Stat(ImageChops.difference(sa, sb)).mean
    return sum(diff) / len(diff) < 6


def encode(im, rule):
    k = min(1.0, rule['w'] / im.width, rule['h'] / im.height)
    if k < 1:
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    has_alpha = im.mode in ('RGBA', 'LA', 'P') and im.convert('RGBA').getextrema()[3][0] < 255
    im = im.convert('RGBA' if has_alpha else 'RGB')
    buf = io.BytesIO()
    kw = {'quality': round(rule['q'] * 100), 'method': 6}
    if has_alpha:
        kw['alpha_quality'] = round(rule['aq'] * 100)
    im.save(buf, 'WEBP', **kw)
    return buf.getvalue(), im.size


def main():
    files = sorted(f for f in os.listdir(ART) if f.endswith('.webp') and (not only or any(f.startswith(p) for p in only))
                   and not any(f.startswith(p) for p in skip))
    before = after = 0
    used_orig = 0
    for f in files:
        name, cur = f[:-5], os.path.join(ART, f)
        rule = rule_of(name)
        old = os.path.getsize(cur)
        before += old
        if rule['keep']:
            after += old
            continue
        now = Image.open(cur)
        now.load()
        src_path, src_im, from_png = None, None, False
        for orig in originals_of(name):
            o = Image.open(orig)
            o.load()
            if same_picture(o, now):
                src_path, src_im, from_png = orig, o, True
                break
        if src_im is None:
            kept = kept_of(f)
            if kept:
                k_im = Image.open(kept)
                k_im.load()
                if not same_picture(k_im, now):
                    kept = None  # 보관본 뒤에 그림이 바뀜: 지금 그림을 씀
            if not kept and not dry:
                kept = os.path.join(KEEP, f)
                os.makedirs(KEEP, exist_ok=True)
                if os.path.exists(kept):
                    kept = os.path.join(KEEP, f'{name}-{os.path.getmtime(cur):.0f}.webp')
                shutil.copyfile(cur, kept)
            src_path = kept or cur
            src_im = Image.open(src_path)
            src_im.load()
        data, size = encode(src_im, rule)
        use = len(data) < old * 0.97
        after += len(data) if use else old
        used_orig += from_png
        print(f"{'✓' if use else '·'} {name:34} {now.width}×{now.height} → {size[0]}×{size[1]}  {old // 1024}KB → {(len(data) if use else old) // 1024}KB{'  (원본 PNG)' if from_png else ''}")
        if use and not dry:
            dst = os.path.join(out_dir or ART, f)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            with open(dst, 'wb') as fh:
                fh.write(data)
    print(f"\n{len(files)}장 · 원본 PNG {used_orig}장 · 합계 {before / 1048576:.2f}MB → {after / 1048576:.2f}MB{' (--dry: 안 바꿈)' if dry else ''}")


main()
