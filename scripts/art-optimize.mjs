// 게임 그림 최적화 (28·29 문서): src/art/의 그림을 화면에 나오는 크기에 맞춰 줄이고 WebP로 다시 저장한다.
// 원본: 저장소 밖 ../나혼자힐러/리소스/generated-*-originals/<이름>.png (Codex 원본, 가장 최근 폴더)를 먼저 쓰고,
// 없으면 지금 src/art 파일을 ../나혼자힐러/리소스/art-앱원본/에 한 번 보관해 두고 그걸 원본으로 쓴다 (여러 번 돌려도 화질이 깎이지 않게).
// 인코더는 Playwright의 Chromium (따로 설치할 도구 없음). 사용: npm run art:optimize  (-- --dry 는 결과만 보기)
import { chromium } from 'playwright';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, 'src/art');
const RES = resolve(ROOT, '../나혼자힐러/리소스');
const KEEP = join(RES, 'art-앱원본');
const dry = process.argv.includes('--dry');

/** 이름 앞머리 → 최대 가로·세로(px)와 품질. 화면 최대 크기 × 기기 배율 3 정도 */
const RULES = [
  { re: /^emblem-/, w: 256, h: 256, q: 0.86 }, // 직업 문장: 금테 원 안 24~112px
  { re: /^mark-/, w: 192, h: 192, q: 0.86 }, // 세력 문양: 24~56px
  { re: /^(boss|mob)-/, w: 640, h: 640, q: 0.82 }, // 보스 무대 원형 초상·공략
  { re: /^floor-/, w: 1024, h: 1024, q: 0.74 }, // 전투 진형 판 뒤 (위에 칸·숫자가 올라감)
  { re: /^scene-lobby-clouds-/, w: 2160, h: 720, q: 0.82 }, // 가로 3:1 구름 띠: 두 타일을 이어 우→좌 이동
  { re: /^scene-/, w: 1200, h: 1600, q: 0.78 }, // 카드 390×120 · 입장 390×155 · 타이틀 세로 전체
  // 로비 그림 (30 문서)
  { re: /^icon-/, w: 192, h: 192, q: 0.86 }, // 금테 메달 48px 안
  { re: /^tab-/, w: 128, h: 128, q: 0.86 }, // 하단 탭 24px
  { re: /^obj-/, w: 512, h: 512, q: 0.82 }, // 로비 장면 속 물건 64~112px
  // 캐릭터 탭 그림 (31 문서)
  { re: /^(item|skill)-/, w: 192, h: 192, q: 0.86 }, // 장비 칸 62px · 스킬 휠 84px · 전투 휠
  { re: /^stat-/, w: 128, h: 128, q: 0.86 }, // 능력치 동그라미 26px
  // 파티원 말풍선 (43 문서): 9조각으로 늘리는 틀 · 꼬리 · 감정 아이콘 · 이펙트 띠 (프레임 가로로)
  { re: /^ui-bubble-tail-/, w: 96, h: 96, q: 0.86 },
  { re: /^ui-bubble-/, w: 384, h: 192, q: 0.86 },
  { re: /^emote-/, w: 128, h: 128, q: 0.86 },
  { re: /^fx-talk-/, w: 768, h: 192, q: 0.84 },
  { re: /^ui-(note|seal)/, w: 384, h: 384, q: 0.82 }, // 양피지 쪽지·밀랍 도장
  { re: /^ui-magic-circle/, w: 640, h: 640, q: 0.82 }, // 스킬 화면 마법진 320px (31 문서)
  { re: /^ui-/, w: 1200, h: 1200, q: 0.78 }, // 메뉴 머리 띠 · 게시판 나무틀
  // 이펙트 · 칸 무늬 (36 강화 연출, 37 4장 B·F)
  { re: /^fx-link-/, w: 256, h: 64, q: 0.86 }, // 생명 사슬 띠: 가로 4:1, 두 칸 사이에 이어 붙임
  { re: /^fx-/, w: 256, h: 256, q: 0.86 }, // 칸 무늬 · 판 위 이펙트 (칸 40~110px) · 보스 그림 위 연출
];
const ruleOf = name => RULES.find(r => r.re.test(name)) || { w: 1200, h: 1200, q: 0.8 };

/** Codex 원본 PNG (가장 최근 generated-*-originals 폴더) */
function originalOf(name) {
  if (!existsSync(RES)) return null;
  const dirs = readdirSync(RES).filter(d => /^generated-.*-originals$/.test(d)).sort().reverse();
  for (const d of dirs) { const p = join(RES, d, `${name}.png`); if (existsSync(p)) return p; }
  return null;
}

const files = readdirSync(ART).filter(f => /\.(webp|png|jpe?g)$/i.test(f));
const browser = await chromium.launch();
const page = await browser.newPage();
let before = 0, after = 0;
try {
  for (const f of files) {
    const name = basename(f, extname(f)), cur = join(ART, f), rule = ruleOf(name);
    let src = originalOf(name);
    if (!src) {
      // 원본 PNG가 없는 그림: 지금 파일을 한 번만 보관하고 그 보관본에서 만든다
      const kept = join(KEEP, f);
      if (!existsSync(kept) && !dry) { mkdirSync(KEEP, { recursive: true }); copyFileSync(cur, kept); }
      src = existsSync(kept) ? kept : cur;
    }
    const mime = /\.png$/i.test(src) ? 'image/png' : /\.jpe?g$/i.test(src) ? 'image/jpeg' : 'image/webp';
    const b64 = readFileSync(src).toString('base64');
    const out = await page.evaluate(async ({ b64, mime, w, h, q }) => {
      const blob = await (await fetch(`data:${mime};base64,${b64}`)).blob();
      const full = await createImageBitmap(blob);
      const k = Math.min(1, w / full.width, h / full.height);
      const W = Math.round(full.width * k), H = Math.round(full.height * k);
      const bmp = k < 1 ? await createImageBitmap(blob, { resizeWidth: W, resizeHeight: H, resizeQuality: 'high' }) : full;
      const cv = new OffscreenCanvas(W, H);
      cv.getContext('2d').drawImage(bmp, 0, 0);
      const webp = await cv.convertToBlob({ type: 'image/webp', quality: q });
      const buf = new Uint8Array(await webp.arrayBuffer());
      let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { b64: btoa(s), W, H, sw: full.width, sh: full.height };
    }, { b64, mime, w: rule.w, h: rule.h, q: rule.q });
    const data = Buffer.from(out.b64, 'base64'), old = statSync(cur).size;
    const dst = join(ART, `${name}.webp`);
    // 더 커지면 그대로 둠 (이미 최적화된 그림)
    const use = data.length < old || extname(f).toLowerCase() !== '.webp';
    before += old; after += use ? data.length : old;
    console.log(`${use ? '✓' : '·'} ${name.padEnd(22)} ${out.sw}×${out.sh} → ${out.W}×${out.H}  ${(old / 1024).toFixed(0)}KB → ${((use ? data.length : old) / 1024).toFixed(0)}KB${src.includes('originals') ? '  (원본 PNG)' : ''}`);
    if (use && !dry) {
      writeFileSync(dst, data);
      if (dst !== cur) unlinkSync(cur);
    }
  }
} finally {
  await browser.close();
}
console.log(`\n합계 ${(before / 1024 / 1024).toFixed(2)}MB → ${(after / 1024 / 1024).toFixed(2)}MB${dry ? ' (--dry: 안 바꿈)' : ''}`);
