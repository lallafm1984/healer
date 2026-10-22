/** 전투 판의 파티원 칸 표시 계산. 전투 상태는 변경하지 않는다. */
import { canDispel, type HeroKey } from '../data/heroes';
import { TALENT_DEF, type TalentKey } from '../data/talents';
import type { Debuff, Mod, Totem, Unit } from '../engine/types';

/** 소생 → 새싹 → 생장 → 들꽃 → 서약, 그 뒤 특성 지속 힐 (남은 꽃 · 파도의 여운, 77), 79 직업 지속 힐 (물방울) */
const HOT_TIMER_ORDER = ['renew', 'sprout', 'growth', 'wildflower', 'oath', 'bloom', 'lightWave', 'droplet', 'wanderMist', 'starMark'];
const hotTimerOrder = (key: string) => {
  const index = HOT_TIMER_ORDER.indexOf(key);
  return index < 0 ? HOT_TIMER_ORDER.length : index;
};

/** 모든 직업 공통: 효과별 시간을 분리하고, 갱신·남은 시간 때문에 순서를 바꾸지 않습니다. 점성술사 별자리 표식은 왼쪽 열 원 (starMarkTimerOf)이라 뺀다 */
export function hotTimersOf(u: Pick<Unit, 'hot' | 'hots'>): { key: string; left: number }[] {
  return [...(u.hot > 0 ? [{ key: 'renew', left: u.hot }] : []), ...u.hots.filter(h => h.left > 0 && h.key !== 'starMark')]
    .sort((a, b) => hotTimerOrder(a.key) - hotTimerOrder(b.key) || a.key.localeCompare(b.key));
}

/**
 * 보호막 시간 (모든 직업 공통, 2026-10-16 Lim 「실드는 지속 힐 아이콘처럼 왼쪽에 파란 아이콘으로 시간」): 칸 왼쪽 위 파란 원 하나.
 * 흡수 보호막 (mods absorb)만. 내가 건 힐러 보호막 (src 'healer', 다시 걸 때를 보는 것)이 있으면 그 시간, 없으면 가장 오래 남은 것.
 * amt = 남은 흡수량 합 (길게 누르기 정보). 보호 두루마리 (u.shield, 받는 피해 −40%)는 흡수량이 없어 흰 이중 테두리 그대로
 */
export function shieldTimerOf(u: Pick<Unit, 'mods'>, t: number): { left: number; amt: number } | null {
  const on = u.mods.filter((m: Mod) => m.k === 'absorb' && m.until > t && m.v > 1e-9);
  if (!on.length) return null;
  const own = on.filter(m => m.src === 'healer'), pick = own.length ? own : on;
  return { left: Math.max(...pick.map(m => m.until - t)), amt: on.reduce((a, m) => a + m.v, 0) };
}

/** 방어 생존기 시간 원 순서 (아래로) */
export const GUARD_TIMER_ORDER = ['guardian', 'bark', 'soothe', 'immune', 'sacrifice', 'sleep'] as const;
export type GuardTimerKey = typeof GUARD_TIMER_ORDER[number];

/**
 * 방어 생존기 시간 (모든 직업 공통, 2026-10-18 Lim 「드루이드의 껍질처럼 방어관련 스킬의 지속 시간을 왼쪽에 표시해줘」): 보호막 원 아래로 효과마다 원 하나.
 * 대상에게 거는 것만: 수호 영혼 · 나무껍질 (나무의 몸) · 누그러뜨림 · 보호의 손 · 희생 · 별의 잠. 순서는 고정 (남은 시간 · 다시 건 순서로 바꾸지 않음).
 * 성역 (서 있는 동안 틱마다 다시 참) · 대지 토템은 칸에 세우는 것이라 바닥 그림 그대로, 흡수 보호막 (수호 결계 등)은 보호막 원
 */
export function guardTimersOf(u: Pick<Unit, 'guardian' | 'redu' | 'immune' | 'sacr' | 'sleep'>, t: number, hero: HeroKey): { key: GuardTimerKey; left: number }[] {
  const on: Record<GuardTimerKey, number> = {
    guardian: u.guardian,
    // 받는 피해 감소 (u.redu)는 드루이드 나무껍질 · 수도사 누그러뜨림 · 성기사 성역이 같이 씀
    bark: hero === 'druid' ? u.redu : 0,
    soothe: hero === 'monk' ? u.redu : 0,
    immune: u.immune,
    sacrifice: u.sacr,
    sleep: u.sleep != null ? u.sleep - t : 0,
  };
  return GUARD_TIMER_ORDER.filter(key => on[key] > 0).map(key => ({ key, left: on[key] }));
}

/**
 * 결계사 인장 남은 시간 (2026-10-19 Lim 「인장도 이미지 대신 보호막 유지 시간처럼 단순하게, 유지 시간 표시와 같은 크기」): 결계사 전투에서 인장이 붙어 있으면 남은 초, 아니면 null.
 * 칸 왼쪽 열에서 보호막 원 · 방어 생존기 원 아래 같은 크기 원 (예전 인장 그림 board-seal은 다른 원과 같이 있을 때 작아져 크기가 들쭉날쭉했음)
 */
export const sealTimerOf = (u: Pick<Unit, 'seal'>, t: number, hero: HeroKey): number | null => (hero === 'warder' && u.seal != null && u.seal > t ? u.seal - t : null);
/**
 * 점성술사 별자리 표식 남은 시간 (2026-10-19 Lim 「표식 스킬도 보호막처럼 지속시간을 숫자로」): 칸 왼쪽 열에서 결계사 인장처럼 보호막 원과 같은 크기 원 + 남은 초.
 * 예전 별자리 표식 그림 (board-star-mark)과 오른쪽 지속 힐 원은 없앰
 */
export const starMarkTimerOf = (u: Pick<Unit, 'hots'>, hero: HeroKey): number | null => {
  if (hero !== 'astrologer') return null;
  const m = u.hots.find(h => h.key === 'starMark' && h.left > 0);
  return m ? m.left : null;
};

/**
 * 사제 빛의 전이 남은 시간 (2026-10-20 Lim 「사제 전이도 이미지빼고 왼쪽에 지속시간으로」): 빛이 깃든 칸이면 전이 전체의 남은 초, 아니면 null.
 * 옮겨 가는 동안 (flyUntil 전)도 이미 새 칸 몫이라 원이 바로 따라간다 (예전 빛 구슬 그림 · 깃듦 · 옮겨 감 · 사라짐 그림은 없앰)
 */
export const relayTimerOf = (relays: readonly { id: number; until: number }[], u: Pick<Unit, 'id'>, t: number): number | null => {
  const left = relays.filter(d => d.id === u.id && d.until > t).map(d => d.until - t); // 빛 여럿이 한 칸에 깃들면 가장 오래 남는 것 (2026-10-22)
  return left.length ? Math.max(...left) : null;
};

/**
 * 특성 버튼 지속 효과 남은 시간 (2026-10-19 Lim 「특성에 달린 버튼들을 눌렀을때 이펙트와 지속시간 표시도 필요하다」): 켜져 있는 자기 강화 특성 (기도의 정점 · 숲의 기억 · 은하수 등)마다
 * 내 칸 왼쪽 열 원 + 남은 초. 칸을 고르는 특성 (쉼터 · 바다의 자리 · 모이는 안개 · 성채)은 그 칸에 (talentObjectTimers). 버튼의 금빛 테 · 남은 초는 그대로
 */
export function talentBuffTimers(act: Partial<Record<TalentKey, { left: number }>>): { key: TalentKey; left: number }[] {
  return (Object.keys(act) as TalentKey[])
    .filter(k => (act[k]?.left ?? 0) > 1e-9 && !!TALENT_DEF[k]?.active?.dur && !TALENT_DEF[k].active!.cell)
    .map(k => ({ key: k, left: act[k]!.left }));
}
/** 칸을 고르는 특성의 판 위 물건 남은 시간: 쉼터 (사제) · 바다 샘 (주술사) · 안개 샘 (수도사) · 성채 (결계사). 그 칸에 사람이 서 있으면 그 사람 왼쪽 열, 비었으면 칸 왼쪽 위 */
export type TalentObjectKey = 'shelter' | 'sea' | 'mist' | 'citadel';
export function talentObjectTimers(shelter: number, shelterLeft: number, totems: readonly Pick<Totem, 'kind' | 'cell' | 'until'>[], t: number): { cell: number; key: TalentObjectKey; left: number }[] {
  const out: { cell: number; key: TalentObjectKey; left: number }[] = [];
  if (shelter >= 0 && shelterLeft > 1e-9) out.push({ cell: shelter, key: 'shelter', left: shelterLeft });
  for (const tm of totems) if ((tm.kind === 'sea' || tm.kind === 'mist' || tm.kind === 'citadel') && tm.until > t) out.push({ cell: tm.cell, key: tm.kind, left: tm.until - t });
  return out;
}

/**
 * 칸 글자 크기 (판 그림 좌표). 모든 판이 5인 던전 칸 모양이라 (2026-10-16 Lim, 레이드 전용 작은 칸 없앰) 대상 폰에서 scale은 50 이상,
 * 10 · 20인은 판 전체를 줄여 그려 글자도 같은 비율로 작아짐
 */
export function cellTypography(scale: number): { hp: number; nick: number; debuff: number } {
  return {
    hp: Math.max(14, scale * 0.28),
    // 이름: 0.24배 (11px 이상), 칸이 아주 작으면 0.3배 · 9px까지 (2026-10-10 Lim)
    nick: Math.min(Math.max(9, scale * 0.3), Math.max(11, scale * 0.24)),
    debuff: Math.max(11, scale * 0.2),
  };
}

/**
 * 칸 체력 글자: 모든 판 (3 · 5인 · 레이드 작은 칸)이 같은 체력 숫자 (2026-10-16 Lim 「레이드도 3 · 5인과 같은 표시, % 제거」). 살아 있는 극소 체력도 0이 아니게 올림, 영원한 저녁은 ?
 * 보호막이 있으면 체력 + 남은 흡수량 합 (shieldTimerOf amt)을 합친 숫자 하나 (2026-10-19 Lim 「+5000 으로 보호막 표시가 아닌 합산해서 파란색으로 표시」, 색은 board.ts가 보호막 파랑)
 */
export const hpLabelText = (hp: number, dark = false, shield?: number | null): string => (dark ? '?' : String(Math.ceil(Math.max(0, hp) + Math.max(0, shield ?? 0))));

/** 글꼴 크기를 줄이지 않고 이름을 말줄임한다. 전체 이름은 길게 누르기 정보에서 제공한다. */
export function fitPartyName(name: string, maxWidth: number, measure: (text: string) => number): string {
  if (measure(name) <= maxWidth) return name;
  const chars = Array.from(name);
  while (chars.length > 1) {
    chars.pop();
    const candidate = `${chars.join('')}…`;
    if (measure(candidate) <= maxWidth) return candidate;
  }
  return measure(`${chars[0] ?? ''}…`) <= maxWidth ? `${chars[0] ?? ''}…` : '…';
}

export type DispelState = 'available' | 'unavailable' | 'dangerous';
const TYPE_SHORT: Record<string, string> = { 질병: '질', 독: '독', 마법: '마', 저주: '저' };

export function debuffDisplay(debuff: Debuff, hero: HeroKey, short = false): {
  text: string; detail: string; state: DispelState; seconds: number;
} {
  const seconds = Math.max(0, Math.ceil(debuff.left));
  // 함정은 실제로 해제되며 폭발한다. 해제불가와 혼동하지 않는다.
  const state: DispelState = debuff.lock || !canDispel(hero, debuff.type) ? 'unavailable' : debuff.trap ? 'dangerous' : 'available';
  // 칸 위 배지에는 해제 불가·함정 기호(×/!)를 붙이지 않습니다. 상세 설명에서만 안내합니다.
  const kind = short ? TYPE_SHORT[debuff.type] ?? '?' : debuff.type;
  // 마력 역류 (P-RECOIL): 배지에 중첩 수 (내 칸의 숫자)
  if (debuff.count) return { text: `${short ? '' : '역류 '}${debuff.stack ?? 0}중`, detail: `${debuff.name} · ${debuff.type} · ${seconds}초, ${debuff.stack ?? 0}중첩 · 스킬을 쓸 때마다 1중첩, 끝나거나 지우면 중첩만큼 피해 · ${state === 'unavailable' ? '이 직업으로 해제 불가' : '해제 가능 (일찍 지울수록 덜 아픔)'}`, state, seconds };
  if (debuff.link) return { // 생명 사슬 (P-LINK)
    text: `${short ? '사슬' : debuff.name} ${seconds}`,
    detail: `${debuff.name} · ${seconds}초 · ${debuff.link.kind === 'share' ? '이어진 두 사람이 받는 피해·치유를 반씩 나눔' : '이어진 두 사람 체력 차이가 크게 벌어지면 끊어지며 둘 다 피해'} · 해제 불가`,
    state, seconds,
  };
  // 부풀기 (P-SWELL, 46 5장): 배지에 중첩 수. 지우면 이웃만, 두면 본인 + 이웃이 터짐
  if (debuff.swell) return { text: `${short ? '' : '거품 '}${debuff.stack ?? 1}중`, detail: `${debuff.name} · ${debuff.type} · ${seconds}초, ${debuff.stack ?? 1}중첩 · ${debuff.swell.every}초마다 1중첩 (최대 ${debuff.swell.max}) · 지우면 이웃 칸이 중첩만큼, 두면 끝날 때 본인과 이웃 칸이 더 크게 터짐 · ${state === 'unavailable' ? '이 직업으로 해제 불가' : '해제 가능 (적을 때 · 옆에 사람이 적을 때)'}`, state, seconds };
  // 뒤집힘 저주 (P-FLIP): 끝날 때 체력 비율이 뒤집힘
  if (debuff.end?.p === 'flip') return { text: `${short ? '' : '뒤집 '}${seconds}`, detail: `${debuff.name} · ${debuff.type} · ${seconds}초 · 끝날 때 체력 비율이 뒤집힘 (80% → 20%, 30% → 70%) · 높으면 힐을 멈추고 낮으면 둠 · ${state === 'unavailable' ? '이 직업으로 해제 불가' : '해제 가능 (지우면 그냥 사라짐)'}`, state, seconds };
  // 빌린 생명 (P-DEBT, 59 5장): 배지에 남은 빚 (불어날수록 커짐)
  if (debuff.debt) { const amt = Math.round(debuff.debtLeft ?? 0); return { text: `빚 ${short && amt >= 1000 ? `${(amt / 1000).toFixed(amt >= 10000 ? 0 : 1)}k` : amt}`, detail: `${debuff.name} · ${seconds}초 · 남은 빚 ${amt} (초마다 +${Math.round(debuff.debt.grow * 100)}%, 어둠물에 잠기면 2배) · 이 사람에게 넘친 치유가 빚을 갚음 · 시간이 다 되면 남은 빚만큼 피해 · 해제 불가`, state, seconds }; }
  if (debuff.jail) return { text: `${short ? '감옥' : debuff.name}`, detail: `${debuff.name} · 딜 0 · 못 움직임 · 딜러가 감옥을 깨면 풀림 · 해제 불가`, state, seconds: 0 };
  const action = debuff.lock ? (debuff.cureAt != null ? `해제 불가, 체력 ${Math.round(debuff.cureAt * 100)}% 이상이면 사라짐`
    : debuff.untilBossLoss != null ? `해제 불가, 보스 체력 ${Math.round(debuff.untilBossLoss * 100)}% 깎으면 풀림` : '해제 불가')
    : state === 'unavailable' ? '이 직업으로 해제 불가' : state === 'dangerous' ? '해제 시 전염 폭발' : '해제 가능';
  const stack = (debuff.stack ?? 0) > 1 ? `, ${debuff.stack}중첩` : '';
  // 받는 치유가 바뀌는 디버프 (35 4-3): 뒤집힌 축복 · 얼룩진 장갑 · 먼지 범벅
  const heal = debuff.invert ? ' · 받는 치유가 피해로' : debuff.healCut ? ` · 받는 치유 -${Math.round(debuff.healCut * (debuff.stack ?? 1) * 100)}%`
    : debuff.over ? ' · 넘친 치유만큼 옆 칸 아군 피해' : debuff.cap != null ? ` · 체력이 ${Math.round(debuff.cap * 100)}%까지만 참` : '';
  // 매혹 · 옮겨붙음 · 마나 갈취 (35 3장): 길게 눌렀을 때 판단 근거
  const more = debuff.charm ? ` · 이웃을 때림, 힐하면 길어짐, 체력 ${Math.round(debuff.charm.free * 100)}% 아래면 풀림`
    : debuff.end?.p === 'jump' ? ' · 지우면 옆 사람에게 옮겨붙음 (혼자면 사라짐), 두면 보스가 강해짐'
    : debuff.drain ? ` · 마나 초당 -${debuff.drain}`
    : debuff.end?.p === 'pass' ? ` · 치유 흡수 막 ${Math.round(debuff.absorbLeft ?? 0)}, 지우면 가장 건강한 아군에게 넘어감, 두면 끝날 때 남은 막만큼 피해` : '';
  return {
    text: `${kind}${short ? '' : ' '}${seconds}`,
    detail: `${debuff.name} · ${debuff.type} · ${seconds}초${stack}${heal}${more} · ${action}`,
    state,
    seconds,
  };
}

/** 기존 판의 함정 → 독 이외의 알려진 종류 → 나머지 순서를 보존한다. */
export function primaryDebuff(debuffs: readonly Debuff[]): Debuff | undefined {
  const priority = (d: Debuff) => d.jail ? 3 : d.trap || d.swell || d.debt || d.end?.p === 'flip' || d.end?.p === 'pass' ? 2 : TYPE_SHORT[d.type] && d.type !== '독' ? 1 : 0;
  return debuffs.reduce<Debuff | undefined>((best, d) => !best || priority(d) > priority(best) ? d : best, undefined);
}
