// 게임 그림 최적화 (28·29 문서): src/art/의 그림을 화면에 나오는 크기에 맞춰 줄이고 WebP로 다시 저장한다.
// 원본: 저장소 밖 ../나혼자힐러/리소스/generated-*-originals/<이름>.png (Codex 원본, 가장 최근 폴더)를 먼저 쓰고,
// 없으면 지금 src/art 파일을 ../나혼자힐러/리소스/art-앱원본/에 한 번 보관해 두고 그걸 원본으로 쓴다 (여러 번 돌려도 화질이 깎이지 않게).
// 인코더는 Playwright의 Chromium (따로 설치할 도구 없음). 사용: npm run art:optimize  (-- --dry 는 결과만 보기, -- --only=이름,이름 은 그 그림만)
import { chromium } from 'playwright';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, 'src/art');
// 저장소 (healer/healer)든 워크트리 (healer/worktrees/x)든 generated-* 폴더가 있는 기획 폴더 리소스를 위로 올라가며 찾음
// (2026-10-28: 예전엔 워크트리에서 원본을 못 찾고 보관본을 healer/worktrees/나혼자힐러/리소스에 쌓았음)
const RES = ['..', '../..', '../../..'].map(up => resolve(ROOT, up, '나혼자힐러/리소스'))
  .find(p => existsSync(p) && readdirSync(p).some(d => d.startsWith('generated-'))) ?? resolve(ROOT, '../나혼자힐러/리소스');
const KEEP = join(RES, 'art-앱원본');
const dry = process.argv.includes('--dry');
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',').filter(Boolean);

/**
 * 이름 앞머리 → 최대 가로·세로(px)와 품질. 화면 최대 크기 × 기기 배율 3 정도.
 * 2026-10-28 Lim 「이미지 리소스를 최대한 용량을 줄여서 apk 용량을 줄여보자」: 보스 · 적 640 → 320, 바닥 · 장소를 줄이고 품질을 낮춤.
 * 한꺼번에 다시 구울 때는 scripts/art-slim.py (이 RULES를 그대로 읽고 Pillow method 6으로 더 작게). aq = 투명도 품질 (art-slim.py만), keep = 굽지 않음
 */
const RULES = [
  { re: /^emblem-/, w: 256, h: 256, q: 0.8 }, // 직업 문장: 금테 원 안 24~112px
  { re: /^mark-/, w: 192, h: 192, q: 0.8 }, // 세력 문양: 24~56px
  { re: /^board-/, w: 192, h: 192, q: 0.8 }, // 판 위 물건 · 칸 표시 (토템 · 쉼터 · 인장 등): 칸 지름 40~110px
  { re: /^(boss|mob)-/, w: 320, h: 320, q: 0.8 }, // 전투 머리 초상 76px · 공략 64px · 판 위 쫄 칸 (칸 지름 × 1.15): 기기 배율 3에서 230px 안
  { re: /^floor-/, w: 768, h: 768, q: 0.6 }, // 전투 진형 판 뒤 (위에 칸·숫자가 올라가고 34~72% 어둡게 덮임)
  { re: /^village-/, w: 2048, h: 2048, q: 0.84 }, // 로비 살아 있는 마을 (853×1844 좌표 그대로, 크기 줄이지 않음)
  { re: /^scene-sanctuary$/, w: 1200, h: 1600, q: 0.78, keep: true }, // 타이틀 세로 전체 (첫 화면이라 그대로)
  { re: /^scene-/, w: 1080, h: 1440, q: 0.7 }, // 출전 장소 그림 폭 340px · 장소 카드 · 전투 머리 뒤 (84% 어둡게)
  // 로비 그림 (30 문서)
  { re: /^icon-a2-/, w: 512, h: 512, q: 0.8 }, // 로비 · 위 정보창 큰 메달 (크기 그대로)
  { re: /^icon-/, w: 192, h: 192, q: 0.8 }, // 금테 메달 48px 안
  { re: /^tab-/, w: 128, h: 128, q: 0.8 }, // 하단 탭 24px
  { re: /^lobby-.*-emblem/, w: 344, h: 430, q: 0.86 }, // 로비 상점 · 행상인 문장 (2026-10-22 임무 · 상점 시안): 폭 68~86px
  { re: /^obj-/, w: 512, h: 512, q: 0.82 }, // 로비 장면 속 물건 64~112px
  { re: /^a2-/, w: 4096, h: 4096, q: 0.8 }, // 위 정보창 · 아래 받침 · 나무 · 종이 결 (9조각 자리가 그림 크기에 맞춰져 있어 크기 그대로)
  // 캐릭터 탭 그림 (31 문서)
  { re: /^(item|skill|talent)-/, w: 192, h: 192, q: 0.8 }, // 장비 칸 62px · 스킬 휠 84px · 전투 휠 · 특성 칸 (78)
  { re: /^stat-/, w: 128, h: 128, q: 0.8 }, // 능력치 동그라미 26px
  { re: /^spec-/, w: 128, h: 128, q: 0.8 }, // 특수능력 묶음 표식 20~40px (36 I)
  // 파티원 말풍선 (43 문서): 9조각으로 늘리는 틀 · 꼬리 · 감정 아이콘 · 이펙트 띠 (프레임 가로로)
  { re: /^ui-bubble-tail-/, w: 96, h: 96, q: 0.86 },
  { re: /^ui-bubble-/, w: 384, h: 192, q: 0.86 },
  { re: /^emote-/, w: 128, h: 128, q: 0.8 },
  { re: /^fx-talk-/, w: 768, h: 192, q: 0.84 },
  { re: /^ui-(note|seal)/, w: 384, h: 384, q: 0.82 }, // 양피지 쪽지·밀랍 도장
  { re: /^ui-magic-circle/, w: 640, h: 640, q: 0.82 }, // 스킬 화면 마법진 320px (31 문서)
  { re: /^ui-legend-rim/, w: 256, h: 256, q: 0.86 }, // 전설 장비 칸 노란 테 (88): 장비 칸 44~90px 위에 겹침
  { re: /^ui-class-/, w: 4096, h: 4096, q: 0.8, aq: 0.9 }, // 전투 조작판 직업 틀 · 자원 그림 (칸 좌표가 그림 크기에 맞춰져 있어 크기 그대로)
  { re: /^ui-/, w: 1200, h: 1200, q: 0.74 }, // 메뉴 머리 띠 · 게시판 나무틀
  // 이펙트 · 칸 무늬 (36 강화 연출, 37 4장 B·F)
  { re: /^fx-link-snap$/, w: 256, h: 256, q: 0.8 }, // 사슬 끊김 (정사각)
  { re: /^fx-link-/, w: 256, h: 64, q: 0.86 }, // 생명 사슬 띠: 가로 4:1, 두 칸 사이에 이어 붙임
  { re: /^fx-edge-/, w: 512, h: 128, q: 0.86 }, // 칸 테두리 띠 (89): 육각 여섯 변에 한 장씩, 위 = 칸 바깥쪽
  { re: /^fx-wide-/, w: 1280, h: 1280, q: 0.8 }, // 보스 판 전체 공격 그림 띠 (66): 256px 프레임 격자 그대로 (줄이면 칸이 어긋남)
  { re: /^fx-skill-/, w: 2048, h: 2048, q: 0.72, aq: 0.8 }, // 손그림풍 이펙트 (scripts/vfx-bake.mjs): 224 · 192px (그림이 큰 것은 320 · 384px) 프레임 격자 그대로 (줄이면 칸이 어긋남)
  { re: /^fx-level-up-/, w: 1024, h: 1024, q: 0.8 }, // 레벨 업 빛 (화면 폭)
  { re: /^fx-/, w: 256, h: 256, q: 0.8 }, // 칸 무늬 · 판 위 이펙트 (칸 40~110px) · 보스 그림 위 연출
];
const ruleOf = name => RULES.find(r => r.re.test(name)) || { w: 1200, h: 1200, q: 0.8 };

/** Codex 원본 PNG (가장 최근 generated-*-originals 폴더) */
function originalOf(name) {
  if (!existsSync(RES)) return null;
  const dirs = readdirSync(RES).filter(d => /^generated-.*-originals$/.test(d)).sort().reverse();
  for (const d of dirs) { const p = join(RES, d, `${name}.png`); if (existsSync(p)) return p; }
  return null;
}

const files = readdirSync(ART).filter(f => /\.(webp|png|jpe?g)$/i.test(f) && (!only || only.includes(basename(f, extname(f)))));
const browser = await chromium.launch();
const page = await browser.newPage();
let before = 0, after = 0;
try {
  for (const f of files) {
    const name = basename(f, extname(f)), cur = join(ART, f), rule = ruleOf(name);
    if (rule.keep) continue;
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
