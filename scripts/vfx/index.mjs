// 스킬 이펙트 목록 (직업마다 한 파일). 굽기: node scripts/vfx-bake.mjs <이름|직업|all>
// 이펙트 = { frames: 장 수 (24fps, 한 번), logical: 기준 칸 62일 때 그림 지름 (battle/pxf.ts logicalSize), scope: 재생 칸 (target · area · party), draw(g, k),
//   size?: 프레임 크기 (기본 FX_SIZE, 작고 자주 뜨는 공통 효과는 192), gray?: 회색 단계로만 그림 (게임이 색을 곱함),
//   loop?: 판 위 물건이 서 있는 동안 계속 도는 그림 (마지막 장 다음이 첫 장, fps 초당 장 수) }
import * as lib from './lib.mjs';
import priest from './priest.mjs';
import druid from './druid.mjs';
import paladin from './paladin.mjs';
import shaman from './shaman.mjs';
import monk from './monk.mjs';
import astro from './astro.mjs';
import warder from './warder.mjs';
import common from './common.mjs';

/** 프레임 한 장 크기 (px): 폰 5인 판 칸 지름 약 290px에 맞춰 늘려 그림 */
export const FX_SIZE = 224;
export const HERO_FX = { priest: Object.keys(priest), druid: Object.keys(druid), paladin: Object.keys(paladin), shaman: Object.keys(shaman), monk: Object.keys(monk), astrologer: Object.keys(astro), warder: Object.keys(warder), common: Object.keys(common).filter(k => k.startsWith('common-')), ally: Object.keys(common).filter(k => k.startsWith('ally-')) };
export const FX = { ...priest, ...druid, ...paladin, ...shaman, ...monk, ...astro, ...warder, ...common };
export { lib };
