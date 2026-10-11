// 화면 테스트 묶음 목록 (scripts/e2e.mjs가 차례로 돌림). CI는 러너 여러 대에 나눠 동시에 돌린다 (E2E_SHARD=2/6 → 6몫 중 2번째)
import appShell from './app-shell.mjs';
import character from './character.mjs';
import devauto from './devauto.mjs';
import dungeon from './dungeon.mjs';
import gear from './gear.mjs';
import guildOff from './guild-off.mjs';
import shop from './shop.mjs';
import challenge from './challenge.mjs';
import heroes from './heroes.mjs';
import legacyUi from './legacy-ui.mjs';
import talents from './talents.mjs';
import tutorial from './tutorial.mjs';
import portrait from './portrait.mjs';
import lobbyLiving from './lobby-living.mjs';
import lobbyA2 from './lobby-a2.mjs';
import devices from './devices.mjs';
import compactUi from './compact-ui.mjs';
import compactInput from './compact-input.mjs';
import boardEdges from './board-edges.mjs';
import dialogs from './dialogs.mjs';
import manaRing from './mana-ring.mjs';
import places from './places.mjs';
import wordReady from './word-ready.mjs';
import relay from './relay.mjs';
import pxfHeal from './pxf-heal.mjs';
import skillPxf from './skill-pxf.mjs';
import commonPxf from './common-pxf.mjs';
import bossPxf from './boss-pxf.mjs';
import battleNotes from './battle-notes.mjs';
import raidFiveLook from './raid-five-look.mjs';

/**
 * [이름, 묶음, CI에서 걸린 초, 조각 수]. 초는 2026-10-11 CI 기록 (모두 합쳐 33분), 몫을 고르게 나누는 데만 씀.
 * 조각 수가 있으면 나눠 돌릴 때 그 묶음을 그만큼 쪼갬 (묶음이 run(url, shots, { k, n })에서 k번째 조각만 돌림)
 */
export const SUITES = [
  ['세로 UI·이미지', portrait, 79],
  ['로비 생동감·입력·수명', lobbyLiving, 30], // 어림 (아직 CI 기록 없음)
  ['A2 로비 UI·기능·안전영역', lobbyA2, 30], // 어림 (아직 CI 기록 없음)
  ['대상 폰 크기 (S25·울트라·플립)', devices, 66],
  ['마나량 외곽 링·소비·회복', manaRing, 42],
  ['축소 전투·취소 복구', compactUi, 150],
  ['탭·스와이프 입력 소유권', compactInput, 112],
  ['전투판 가장자리·균등 확대·resize 복구', boardEdges, 229],
  ['상세 시트·포커스 복구', dialogs, 20],
  ['앱 틀', appShell, 18],
  ['임시 전투 화면', legacyUi, 19],
  ['던전 흐름', dungeon, 26],
  ['첫 5분 튜토리얼', tutorial, 37],
  ['캐릭터 탭', character, 6],
  ['장비 강화·분해', gear, 8],
  ['힐러 직업', heroes, 17],
  ['사제 특성', talents, 8],
  ['성언 준비 반짝임', wordReady, 25],
  ['사제 빛의 전이', relay, 51],
  ['사제 치유 반짝이 가루 (PXF)', pxfHeal, 60], // 아직 CI 기록 없음: 비슷한 묶음 (빛의 전이) 기준 어림
  ['직업별 스킬 PXF 이펙트', skillPxf, 80], // 어림 (스킬 25개 × 1.5초 + 20인)
  ['전투 공통 효과 PXF', commonPxf, 40], // 어림 (효과 10개 × 1.5초)
  ['보스 판 전체 공격 PXF', bossPxf, 50], // 어림 (11가지 × 1.4초 × 판 둘)
  ['말풍선·상세창·전투 메시지 자리', battleNotes, 170], // 어림 (판 여섯 × 폰 넷, 말풍선 한 명씩)
  ['레이드 판 5인 던전 모양 보기', raidFiveLook, 60], // 어림 (폰 넷 × 판 셋)
  ['길드 빼 둠', guildOff, 6],
  ['재화·임무·상점', shop, 14],
  ['성장·주간 도전·이어하기', challenge, 29],
  ['자동 치유 (개발)', devauto, 13],
  ['장소마다 입장 → 결과', places, 996, 4],
];

/**
 * 돌릴 조각들 (목록 순서). shard가 없으면 모든 묶음을 통째로.
 * shard = 'i/n'이면 조각을 긴 것부터 지금까지 가장 가벼운 몫에 넣어 n몫으로 나누고 i번째 몫만: 모든 조각이 정확히 한 몫에 들어감
 */
export function plan(shard) {
  if (!shard) return SUITES.map(([name, run, sec], at) => ({ name, run, sec, at }));
  const [i, n] = shard.split('/').map(Number);
  if (!(Number.isInteger(i) && Number.isInteger(n) && i >= 1 && i <= n)) throw new Error(`E2E_SHARD는 1/6처럼: ${shard}`);
  const pieces = SUITES.flatMap(([name, run, sec, parts = 1], at) =>
    Array.from({ length: parts }, (_, k) => parts > 1 ? { name: `${name} (${k + 1}/${parts})`, run, sec: sec / parts, at, part: { k, n: parts } } : { name, run, sec, at }));
  const load = Array(n).fill(0), mine = [];
  for (const p of [...pieces].sort((a, b) => b.sec - a.sec || a.at - b.at || (a.part?.k ?? 0) - (b.part?.k ?? 0))) {
    const s = load.indexOf(Math.min(...load));
    load[s] += p.sec;
    if (s === i - 1) mine.push(p);
  }
  return mine.sort((a, b) => a.at - b.at || (a.part?.k ?? 0) - (b.part?.k ?? 0));
}
