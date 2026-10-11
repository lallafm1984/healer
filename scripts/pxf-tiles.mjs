// 128px PXF 그림을 64px 조각 4개로 나눠 그리고 다시 잇기 (Lim 2026-10-11 「전체공격의 픽셀이 좀더 디테일 했으면」): 공방에서 128px 설계가 어떻게 나오는지 확인용.
// 게임 띠는 우리 렌더러가 같은 설계를 256px로 그린 것 (node scripts/fxr.mjs --wide <이름>, Lim 「256px」).
// 공방 render_pxf는 size 128로 그려도 전체 프레임은 64px 썸네일 (부드럽게 줄여 색이 섞임)로만 돌려줘서 128px 띠를 구울 수 없다.
// 그래서 128px 원본 그래프 (src/art/pxf/<이름>.pxf.json, settings.size 128)를 왼쪽 위 · 오른쪽 위 · 왼쪽 아래 · 오른쪽 아래
// 64px 조각 그래프로 바꿔 (src/art/pxf/tiles/<이름>.<tl|tr|bl|br>.pxf.json) 따로 렌더링하고, 네 조각의 타임라인을 이어 128px 띠로 굽는다.
//
// 조각으로 바꾸는 법: 위치 (0–1 화면 비율)는 조각 기준으로 옮기고 (v' = 2v − 조각 자리), 픽셀 단위 값 (크기 · 두께 · 속도)은 그대로
// (원본 128px의 1px = 조각 64px의 1px). 그래서 원본은 128px 기준으로 만든다.
// 곡선 획 (Stroke)은 점 범위가 −1–2라 원본 0–1 안이면 어느 조각에서나 그대로 그려진다.
// 도형 · 파티클 · 번개 · 가시는 기준점 (가운데 · 방출점 · 양끝)이 그 조각 안 (가장자리 포함)일 때만 그 조각에 그린다:
// 판 한가운데 (0.5, 0.5)는 네 조각의 공통 모서리라 어느 조각에서나 그려지고, 같은 시드면 같은 자리에 같은 모양이 나온다.
// 기준점이 다른 조각에 있는데 모양이 이 조각으로 넘어오면 그 부분은 잘린다 → split이 경고하니 원본에서 옮긴다.
// 회전 · 이동 (Transform · Repeat) · 왜곡 · 노이즈처럼 캔버스 전체를 다루는 노드는 조각마다 달라져서 쓰지 않는다.
//
// 사용: node scripts/pxf-tiles.mjs split <이름>   → tiles/<이름>.<조각>.pxf.json (빈 조각은 안 만듦), 경고 출력
//       (조각 그래프마다 render_pxf → 첫 그림 (타임라인)을 tiles/<이름>.<조각>.timeline.png로 저장)
//       node scripts/pxf-tiles.mjs bake <이름> [--out 파일.png]   → 공방 모습 128px 띠 (기본은 임시 폴더, 게임 띠를 덮어쓰지 않음)
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeStrip, graphPalette } from './pxf-bake.mjs';
import { OFF, S, splitGraph, TILE_KEYS } from './pxf-split.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'src/art/pxf'), TILES = join(DIR, 'tiles');

const main = async () => {
  const [cmd, name] = process.argv.slice(2);
  if (!['split', 'bake'].includes(cmd) || !name) { console.error('사용: node scripts/pxf-tiles.mjs split|bake <이름>'); process.exit(1); }
  const g = JSON.parse(readFileSync(join(DIR, `${name}.pxf.json`), 'utf8'));
  const { tiles, warns } = splitGraph(g);
  if (cmd === 'split') {
    mkdirSync(TILES, { recursive: true });
    for (const q of TILE_KEYS) {
      const f = join(TILES, `${name}.${q}.pxf.json`);
      if (!tiles[q]) { if (existsSync(f)) rmSync(f); console.log(`${q}: 빈 조각 (렌더링 안 함)`); continue; }
      writeFileSync(f, JSON.stringify(tiles[q], null, 2) + '\n');
      console.log(`${q}: ${f}  노드 ${tiles[q].nodes.length} · 연결 ${tiles[q].links.length}`);
    }
    for (const w of warns) console.warn(`⚠ ${w}`);
    return;
  }
  const pieces = TILE_KEYS.map(q => {
    if (!tiles[q]) return { timeline: null, palette: [], dx: OFF[q][0], dy: OFF[q][1] };
    const saved = JSON.parse(readFileSync(join(TILES, `${name}.${q}.pxf.json`), 'utf8'));
    if (JSON.stringify(saved) !== JSON.stringify(tiles[q])) throw new Error(`${q}: 조각 그래프가 원본과 안 맞음 → split 다시 하고 렌더링`);
    return { timeline: readFileSync(join(TILES, `${name}.${q}.timeline.png`)).toString('base64'), palette: graphPalette(tiles[q]), dx: OFF[q][0], dy: OFF[q][1] };
  });
  const out = await bakeStrip({ size: S, frames: g.settings.frames, pieces });
  if (out.worst > 3) { console.error(`팔레트로 설명이 안 되는 픽셀 (오차 ${out.worst.toFixed(1)}): 조각 그래프와 타임라인 그림이 맞는지 확인`); process.exit(1); }
  const at = process.argv.indexOf('--out'), file = at > 0 ? resolve(process.argv[at + 1]) : join(tmpdir(), `pxf-tiles-${name}.png`);
  writeFileSync(file, out.png);
  console.log(`✓ ${file}  ${S * g.settings.frames}×${S} (${g.settings.frames}프레임, 조각 ${pieces.filter(p => p.timeline).length}개) · 최대 오차 ${out.worst.toFixed(2)}`);
};
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
