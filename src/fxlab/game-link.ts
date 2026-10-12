// 개발용 이펙트 화면: 그래프가 게임 값 (src/battle/pxf.ts PXF)과 맞는지. 다르면 tests/pxf.test.ts가 실패함
import type { PxfGraph } from '../../scripts/fxr/render.mjs';
import { isBossPxf, PXF, WIDE_DESIGN, type PxfKey } from '../battle/pxf';
import type { Check } from './graph-edit';

export function gameChecks(file: string, g: PxfGraph): Check[] {
  if (!file) return [{ level: 'info', text: '새 그래프: 저장하면 src/art/pxf/<이름>.pxf.json' }];
  if (!(file in PXF)) {
    const ok = g.settings.size === 64;
    return [{ level: 'info', text: ok
      ? `게임에 아직 안 씀: 구운 뒤 src/battle/pxf.ts PXF에 '${file}': clip(${g.settings.frames}, ${g.game?.impactFrame ?? 0}) 를 더하면 됨`
      : `게임에 아직 안 씀: 게임 띠는 64px 설계 (칸 이펙트) 또는 128px 설계 boss-* (판 전체 공격)만 씀` }];
  }
  const k = file as PxfKey, c = PXF[k], design = isBossPxf(k) ? WIDE_DESIGN : c.size, game = g.game ?? {}, out: Check[] = [];
  const pairs: [string, unknown, unknown][] = [
    ['캔버스 크기', g.settings.size, design], ['장 수', g.settings.frames, c.frames], ['fps', g.settings.fps, c.fps], ['반복', g.settings.loop, false],
    ['맞는 순간', game.impactFrame, c.impactFrame], ['게임 크기 (logicalSize)', game.logicalSize, c.logicalSize], ['기준 칸', game.referenceCell ?? 62, c.referenceCell],
  ];
  for (const [label, a, b] of pairs) if (a !== b) out.push({ level: 'warn', text: `게임 값과 다름 · ${label}: 그래프 ${String(a)}, 게임 ${String(b)} → src/battle/pxf.ts도 고쳐야 함` });
  const [px, py] = game.pivot ?? [];
  if (px !== 0.5 || py !== 0.5) out.push({ level: 'warn', text: '게임은 칸 가운데에 그림: game.pivot을 [0.5, 0.5]로' });
  if (!out.length) out.push({ level: 'info', text: `게임 값과 같음 (${isBossPxf(k) ? '판 전체 공격 · 256px 격자로 구움' : `${c.size}px 가로 띠`}${c.gray ? ' · 회색 그림, 게임이 색을 곱함' : ''})` });
  return out;
}
export const isGameFx = (file: string): boolean => file in PXF;
