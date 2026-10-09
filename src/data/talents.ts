/**
 * 사제 특성 트리 (06 6장): 10단 × 3택1, Lv 5부터 5레벨마다 한 단 (34 2-1, Lv 50 완성). 언제든 무료로 바꿈.
 * 고른 특성은 직업마다 따로 저장 (25 4-1). 효과는 engine/talents.ts. 이름은 오리지널 (14 문서)
 */
import { FEATURES } from './features';

export type TalentKey =
  | 'longBreath' | 'lightTouch' | 'wideCircle'
  | 'brink' | 'washed' | 'practiced'
  | 'overflow' | 'hopRenew' | 'breather'
  | 'fullHeart' | 'spreadSerenity' | 'echoWord'
  | 'miracle' | 'savedWord' | 'cleansingWord'
  | 'repay' | 'twoGuard' | 'firmWill'
  | 'calmHymn' | 'shelter' | 'grief'
  | 'doublePoh' | 'shareRenew' | 'quickHymn'
  | 'twoShields' | 'focusOne' | 'hymnTail'
  | 'zenith' | 'scatter' | 'endless';

/** 보조 버튼으로 쓰는 특성 (06 9장 2번: 휠 밖 버튼). once = 전투당 1회, cell = 빈 칸을 골라서 */
export interface TalentActive { cd: number; dur: number; once?: boolean; cell?: boolean; short: string }
export interface TalentDef { key: TalentKey; name: string; desc: string; active?: TalentActive }
export interface TalentTier { lv: number; theme: string; picks: [TalentDef, TalentDef, TalentDef] }

const t = (key: TalentKey, name: string, desc: string, active?: TalentActive): TalentDef => ({ key, name, desc, active });

export const TALENTS: TalentTier[] = [
  { lv: 5, theme: '기본 강화', picks: [t('longBreath', '긴 숨결', '소생 지속 시간이 3초 늘어납니다.'), t('lightTouch', '가벼운 손끝', '순간 치유의 마나 소모가 20% 줄어듭니다.'), t('wideCircle', '넓은 원', '치유의 기원 반경이 1 늘어 반경 2가 되고, 회복량은 20% 줄어듭니다.')] },
  { lv: 10, theme: '기본 강화', picks: [t('brink', '벼랑 끝 손길', '체력 30% 이하인 대상에게 하는 힐이 25% 늘어납니다.'), t('washed', '씻어낸 자리', '정화에 성공하면 대상의 체력을 {150} 회복합니다.'), t('practiced', '손에 익은 치유', '치유 시전 시간이 0.3초 줄어듭니다.')] },
  { lv: 15, theme: '기본 강화', picks: [t('overflow', '흘러넘침', '치유로 넘친 힐량의 50%가 붙어 있는 가장 다친 아군에게 흘러갑니다.'), t('hopRenew', '옮겨 가는 소생', '소생이 끝날 때 체력이 가장 낮은 옆 아군에게 한 번 옮겨 갑니다.'), t('breather', '숨 고르기', '3초 동안 아무것도 하지 않으면 마나 재생이 100% 늘어납니다.')] },
  { lv: 20, theme: '성언', picks: [t('fullHeart', '충만한 마음', '성언 게이지가 30% 더 빨리 찹니다.'), t('spreadSerenity', '번지는 평온', '성언: 평온이 옆 아군 2명에게도 50% 위력으로 들어갑니다.'), t('echoWord', '말씀의 여운', '성언을 쓴 뒤 5초 동안 마나 소모가 50% 줄어듭니다.')] },
  { lv: 25, theme: '성언', picks: [t('miracle', '기적의 순간', '전투마다 한 번, 두 성언 게이지를 바로 100%로 채웁니다.', { cd: 0, dur: 0, once: true, short: '기적' }), t('savedWord', '아껴 둔 말씀', '성언 게이지를 2회분까지 모아 둘 수 있습니다.'), t('cleansingWord', '씻는 말씀', '성언: 평온이 종류와 상관없이 디버프 1개도 제거합니다.')] },
  { lv: 30, theme: '생존', picks: [t('repay', '은혜 갚기', `내가 죽을 피해를 받으면 호감도가 가장 높은 파티원이 한 번 대신 맞습니다. 그 파티원 체력이 50% 이상일 때, 전투마다 1회 발동합니다. ${FEATURES.guild ? '호감도는 길드원은 함께 출전한 수, 공개모집은 이번 판에 내 힐을 받은 양입니다.' : '호감도는 이번 판에 내 힐을 받은 양입니다.'}`), t('twoGuard', '두 겹 수호', '수호 영혼을 2번까지 모아 둘 수 있습니다. 충전 시간은 120초입니다.'), t('firmWill', '굳은 의지', '내가 받는 피해가 20% 줄어듭니다.')] },
  { lv: 35, theme: '위기 대응', picks: [t('calmHymn', '고요한 찬가', '천상의 찬가 동안 파티원이 겁먹고 도망가지 않고, 장판 회피가 15% 늘어납니다.'), t('shelter', '쉼터', '빈 칸 1개를 20초 동안 쉼터로 만듭니다. 체력이 낮아 도망가는 파티원이 그리로 가고 초당 {30}씩 회복합니다. 재사용 대기시간은 60초입니다.', { cd: 60, dur: 20, cell: true, short: '쉼터' }), t('grief', '슬픔의 힘', '파티원이 쓰러지면 5초 동안 모든 힐이 30% 늘어납니다.')] },
  { lv: 40, theme: '범위 운영', picks: [t('doublePoh', '두 번 퍼지는 기원', '치유의 기원이 2초 뒤 50% 위력으로 한 번 더 퍼집니다.'), t('shareRenew', '나눠 주는 소생', '소생이 옆 아군 1명에게도 함께 걸립니다.'), t('quickHymn', '빨라진 찬가', '천상의 찬가 재사용 대기시간이 60초 줄어듭니다.')] },
  { lv: 45, theme: '대규모 운영', picks: [t('twoShields', '두 방패의 끈', '탱커 2명을 이어, 한쪽에 한 직접 힐의 30%가 다른 쪽에도 들어갑니다.'), t('focusOne', '한 사람만 본다', '같은 대상을 이어서 치유하면 한 번마다 10%씩, 최대 50%까지 늘어납니다.'), t('hymnTail', '찬가의 끝자락', '천상의 찬가가 끝나면 전원에게 6초 동안 {120} 회복하는 지속 힐을 겁니다.')] },
  { lv: 50, theme: '궁극', picks: [t('zenith', '기도의 정점', '20초 동안 모든 시전이 즉시 끝나지만 마나 소모가 1.5배가 됩니다. 재사용 대기시간은 180초입니다.', { cd: 180, dur: 20, short: '정점' }), t('scatter', '흩날리는 빛', '30초 동안 모든 직접 힐이 옆 2칸에 40%씩 튑니다. 재사용 대기시간은 180초입니다.', { cd: 180, dur: 30, short: '흩빛' }), t('endless', '끊이지 않는 말씀', '게이지 50%에서도 위력 50%의 약한 성언을 쓸 수 있습니다.')] },
];

export const TALENT_DEF = Object.fromEntries(TALENTS.flatMap(x => x.picks.map(p => [p.key, p]))) as Record<TalentKey, TalentDef>;
export const TALENT_TIER = Object.fromEntries(TALENTS.flatMap((x, i) => x.picks.map(p => [p.key, i]))) as Record<TalentKey, number>;

/** 고른 칸 번호(단마다 0~2, 없으면 null) → 그 레벨에서 켜지는 특성 */
export function talentKeys(picks: (number | null)[] | undefined, level: number): TalentKey[] {
  if (!picks) return [];
  return TALENTS.flatMap((x, i) => (x.lv <= level && picks[i] != null && x.picks[picks[i]!] ? [x.picks[picks[i]!].key] : []));
}
