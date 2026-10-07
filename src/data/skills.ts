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
