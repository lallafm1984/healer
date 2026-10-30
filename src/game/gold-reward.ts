/** 출전 미리보기와 실제 정산의 공통 골드. 평가에 따라 바뀌지 않는 A 기준, 기본액과 휴식 판 금액. */
import { raidSize, stageOf, type ContentDef } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { clearGold, EXPLORE_REWARD, restRun } from '../data/progression';
import type { SaveData } from '../platform/storage';
import { restBase } from './stamina';
import { TUT, TUT_CONTENT, tutReplay } from './tutorial';

/** 미리보기는 base만 표시하고, 정산은 full에 실제 휴식 몫을 적용한다. 저장을 바꾸지 않는다. */
export function clearGoldReward(save: SaveData, c: ContentDef, diff: DiffName, stage = stageOf(c, diff)): { base: number; full: number } {
  const play = save.tut >= TUT.done || !TUT_CONTENT.includes(c.key);
  const raw = !play && tutReplay(save) ? 0 : clearGold(stage, diff, 'A', raidSize(c)) * (play && c.kind === 'explore' ? EXPLORE_REWARD : 1);
  const full = play ? restRun(raw) : Math.round(raw);
  return { base: play ? restBase(full) : full, full };
}
