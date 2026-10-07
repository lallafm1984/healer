/**
 * 프로토타입 화면(protoUi.js)은 전역 `Engine`을 쓴다. 같은 모양으로 TypeScript 엔진과 데이터를 넘겨준다.
 * P1에서 새 화면으로 바꾸면 이 파일과 legacy 폴더를 지운다.
 */
import { BOARDS } from '../data/boards';
import { DIFFS } from '../data/difficulty';
import { ENCOUNTERS } from '../data/encounters';
import { gearStats, GEARS } from '../data/gear';
import { ITEMS, POTION_CD } from '../data/items';
import { CATS, PERS } from '../data/personalities';
import { SKILLS } from '../data/skills';
import * as E from '../engine';

const Engine = {
  DT: E.DT, DIFFS, GEARS, gearStats, PERS, CATS, ENCOUNTERS, SKILLS, BOARDS,
  create: E.create, step: E.step, use: E.use, slotKey: E.slotKey, canTarget: E.canTarget, queue: E.queue, rollParty: E.rollParty,
  ITEMS, POTION_CD, useItem: E.useItem, itemReady: E.itemReady, reviveTarget: E.reviveTarget,
  autoHealer: E.autoHealer, simulate: E.simulate, hexDist: E.hexDist, living: E.living, partyDps: E.partyDps, rngFrom: E.rngFrom,
};

(globalThis as unknown as { Engine: typeof Engine }).Engine = Engine;
