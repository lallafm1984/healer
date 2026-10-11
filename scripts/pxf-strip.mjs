// PXF 공방 이펙트 (pxf.graph@1) → 게임 프레임 띠 (Lim 2026-10-11 시험).
// 게임에는 PXF 엔진이 없어서, 실제 엔진이 그린 타임라인 그림(PXF 도구 render_pxf의 timeline PNG: 64px 프레임 5칸씩 · 줄 높이 76px · 8px 체커 배경)에서
// 체커 배경을 걷어 내 투명 프레임을 되살리고, 가로로 이어 붙여 src/art/fx-pxf-<이름>.png로 저장한다 (굽는 법은 pxf-bake.mjs).
// Palette bands 출력이라 픽셀 색은 팔레트 색 (또는 Outline 색) 중 하나: C = a·P + (1 − a)·배경 을 색마다 풀어 가장 잘 맞는 (P, a)를 고른다.
// 그 색들로 설명이 안 되는 픽셀이 있으면 (다른 노드가 색을 바꾸거나 반투명 색끼리 겹친 그래프) 멈춘다.
// 사용: node scripts/pxf-strip.mjs heal-dust   (src/art/pxf/heal-dust.pxf.json + heal-dust.timeline.png → src/art/fx-pxf-heal-dust.png)
// 128px 판 전체 그림 (조각 4개로 그림)은 pxf-tiles.mjs.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeStrip, graphPalette } from './pxf-bake.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const name = process.argv[2];
if (!name) { console.error('사용: node scripts/pxf-strip.mjs <이름>'); process.exit(1); }
const dir = join(ROOT, 'src/art/pxf');
const graph = JSON.parse(readFileSync(join(dir, `${name}.pxf.json`), 'utf8'));
const { size, frames } = graph.settings;
if (size !== 64) { console.error(`타임라인 칸이 64px라 size 64만 됨 (지금 ${size}, 128은 pxf-tiles.mjs)`); process.exit(1); }
const palette = graphPalette(graph);
if (!palette.length) { console.error('Palette 노드가 없는 그래프는 아직 못 구움'); process.exit(1); }
const timeline = readFileSync(join(dir, `${name}.timeline.png`)).toString('base64');

const out = await bakeStrip({ size, frames, pieces: [{ timeline, palette, dx: 0, dy: 0 }] });
// 8비트 반올림 오차는 1 안팎. 그보다 크면 배경을 잘못 걷어 냈거나 팔레트 밖 색
if (out.worst > 3) { console.error(`팔레트로 설명이 안 되는 픽셀 (오차 ${out.worst.toFixed(1)}): 그래프와 타임라인 그림이 맞는지 확인`); process.exit(1); }
const file = join(ROOT, 'src/art', `fx-pxf-${name}.png`);
writeFileSync(file, out.png);
console.log(`✓ ${file}  ${size * frames}×${size} (${frames}프레임) · 최대 오차 ${out.worst.toFixed(2)}`);
