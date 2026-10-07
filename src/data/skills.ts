/** 사제 스킬 (06 3장). cost = 최대 마나 대비 %, gp/gs = 성언 게이지(평온/신성화) 충전량 */
export type SkillKey = 'heal' | 'flash' | 'renew' | 'poh' | 'purify' | 'guardian' | 'hymn' | 'serenity' | 'sanctify';
export type SkillTarget = 'ally' | 'area' | 'none';

export interface SkillDef {
  name: string;
  short: string;
  cast: number;
  cost: number;
  amt?: number;
  cd?: number;
  channel?: number;
  target: SkillTarget;
  gp?: number;
  gs?: number;
}

export const SKILLS: Record<SkillKey, SkillDef> = {
  heal: { name: '치유', short: '치유', cast: 1.8, cost: 3, amt: 300, target: 'ally', gp: 20 },
  flash: { name: '순간 치유', short: '순간', cast: 1.0, cost: 6, amt: 250, target: 'ally', gp: 15 },
  renew: { name: '소생', short: '소생', cast: 0, cost: 3, target: 'ally', gp: 5, gs: 5 },
  poh: { name: '치유의 기원', short: '기원', cast: 2.0, cost: 10, amt: 180, target: 'area', gs: 35 },
  purify: { name: '정화', short: '정화', cast: 0, cost: 4, cd: 8, target: 'ally' },
  guardian: { name: '수호 영혼', short: '수호', cast: 0, cost: 2, cd: 90, target: 'ally' },
  hymn: { name: '천상의 찬가', short: '찬가', cast: 0, channel: 4, cost: 15, cd: 180, target: 'none' },
  serenity: { name: '성언: 평온', short: '평온', cast: 0, cost: 0, amt: 600, target: 'ally' },
  sanctify: { name: '성언: 신성화', short: '신성화', cast: 0, cost: 0, amt: 300, target: 'area' },
};

/** 배우는 레벨 (06 7장). 성언은 게이지가 Lv 6에 열리고, 신성화는 기원(Lv 5)도 있어야 함 */
export const SKILL_LEVEL: Record<SkillKey, number> = { heal: 1, flash: 1, renew: 2, purify: 3, poh: 5, guardian: 8, hymn: 12, serenity: 6, sanctify: 6 };
/** 패시브 (06 5장): 메아리 치유 Lv 1, 빛의 은총 Lv 4, 성언 게이지 Lv 6, 상징 Lv 10 */
export const PASSIVE_LEVEL = { echo: 1, grace: 4, words: 6, symbol: 10 } as const;
export type PassiveKey = keyof typeof PASSIVE_LEVEL;
export const PASSIVE_NAME: Record<PassiveKey, string> = { echo: '메아리 치유', grace: '빛의 은총', words: '성언 게이지', symbol: '상징' };

/** 사제 정화로 지울 수 있는 디버프 종류 (독은 안 됨) */
export const DISPELLABLE: Record<string, boolean> = { '질병': true, '마법': true };

/** 캐릭터 → 스킬 설명 (06 3·4장). kind = 휠 조각 종류 */
export const SKILL_INFO: Record<SkillKey, { kind: string; desc: string }> = {
  heal: { kind: '기본 힐', desc: '300 회복. 평온 게이지 +20%' },
  flash: { kind: '빠른 힐', desc: '250 회복. 평온 게이지 +15%' },
  renew: { kind: '지속 힐', desc: '9초 동안 3초마다 80 (총 240). 두 게이지 +5%' },
  poh: { kind: '광역 힐', desc: '대상과 붙어 있는 6칸에 180씩. 신성화 게이지 +35%' },
  purify: { kind: '해제', desc: '마법·질병 디버프 1개 제거 (독 제외)' },
  guardian: { kind: '외부 생존기', desc: '10초 동안 대상이 죽을 피해를 받으면 대신 최대 체력 40% 회복 (1회)' },
  hymn: { kind: '공대 쿨기', desc: '4초 동안 1초마다 전원 120 회복 (총 480). 그동안 다른 행동 불가' },
  serenity: { kind: '성언', desc: '즉시 600 회복, 마나 0 (평온 게이지 100%)' },
  sanctify: { kind: '성언', desc: '즉시 대상과 붙어 있는 6칸에 300씩, 마나 0 (신성화 게이지 100%)' },
};

/** 패시브 설명 (06 5장, 성언 게이지는 4장) */
export const PASSIVE_DESC: Record<PassiveKey, string> = {
  echo: '치유·순간 치유·평온 힐량의 15%를 4초에 걸쳐 추가 회복',
  grace: '소생이 걸린 대상에게 직접 힐 +10%',
  words: '힐마다 평온·신성화 게이지 충전. 100%면 휠 조각이 성언으로 바뀜',
  symbol: '전투마다 1회, 마나 30% 아래면 5초 동안 마나 회복 ×4',
};
