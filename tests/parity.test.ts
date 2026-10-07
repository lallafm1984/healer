/**
 * 프로토타입 엔진(tests/fixtures/proto-engine.cjs, prototype/engine.js 사본)과
 * TypeScript 엔진이 같은 시드·같은 입력에서 똑같이 움직이는지 확인한다.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { ENCOUNTERS, type EncounterKey } from '../src/data/encounters';
import type { GearId } from '../src/data/gear';
import type { ItemKey } from '../src/data/items';
import type { SkillKey } from '../src/data/skills';
import * as E from '../src/engine';
import type { Fight } from '../src/engine';

const require = createRequire(import.meta.url);
const P: any = require('./fixtures/proto-engine.cjs');

function snap(f: any) {
  return {
    t: f.t, k: f.k, over: f.over, reason: f.reason, bossHp: f.bossHp, mana: f.mana, gcd: f.gcd,
    phase: f.phase, phaseName: f.phaseName, nextId: f.nextId, g: f.g, cd: f.cd, items: f.items, potCd: f.potCd,
    cast: f.cast, queued: f.queued, stats: f.stats, itemLog: f.itemLog,
    party: f.party.map((u: any) => ({
      id: u.id, role: u.role, pers: u.pers, nick: u.nick, hp: u.hp, max: u.max, alive: u.alive, cell: u.cell,
      hot: u.hot, shield: u.shield || 0, guardian: u.guardian, fleeing: u.fleeing, sulking: u.sulking, moving: u.moving,
      debuffs: u.debuffs.map((d: any) => [d.name, d.left, d.stack ?? null]),
    })),
    cells: f.cells.map((c: any) => (c.unit ? c.unit.id : 0)),
    queue: (f.over ? [] : P.queue(f)).map((q: { name: string; impact: number }) => [q.name, q.impact]),
  };
}
function snapTs(f: Fight) {
  const s = snap(f);
  s.queue = (f.over ? [] : E.queue(f)).map(q => [q.name!, q.impact]) as never;
  return s;
}

const GEARS: GearId[] = ['none', 'adv0', 'rare5', 'epic5'];
const CASES = (Object.keys(ENCOUNTERS) as EncounterKey[]).flatMap(enc => ENCOUNTERS[enc].diffs.map(diff => ({ enc, diff })));

describe('자동 힐러 한 판 결과가 프로토타입과 같음', () => {
  for (const { enc, diff } of CASES) {
    it(`${enc} ${diff}`, () => {
      for (const gear of GEARS) for (const seed of [1, 7, 42, 1234, 99991]) {
        const cfg = { encounter: enc, diff, gear, seed, items: ['mana', 'life', 'cleanse', 'feather'] as ItemKey[] };
        const a = P.simulate(cfg);
        const b = E.simulate(cfg);
        expect(snapTs(b), `${enc} ${diff} ${gear} seed ${seed}`).toEqual(snap(a));
      }
    });
  }
});

describe('사람 입력(탭·휠·아이템)을 섞어도 틱마다 같음', () => {
  const SLOTS: SkillKey[] = ['heal', 'flash', 'renew', 'poh', 'purify', 'guardian', 'hymn'];
  const ITEMS: ItemKey[] = ['mana', 'medit', 'life', 'cleanse', 'shield', 'feather'];
  for (const { enc, diff } of CASES) {
    it(`${enc} ${diff}`, () => {
      for (const seed of [3, 11, 2026]) {
        const items = [ITEMS[seed % 6], ITEMS[(seed + 1) % 6], ITEMS[(seed + 3) % 6], 'feather'] as ItemKey[];
        const cfg = { encounter: enc, diff, gear: 'adv0' as GearId, seed, items };
        const a = P.create(cfg);
        const b = E.create(cfg);
        const input = E.rngFrom(seed * 31 + 5); // 입력용 난수 (전투 난수와 따로)
        while (!a.over && a.t < 600) {
          const r = input();
          if (r < 0.06) {
            const slot = SLOTS[Math.floor(input() * SLOTS.length)];
            const cell = Math.floor(input() * a.cells.length);
            const ka = P.slotKey(a, slot), kb = E.slotKey(b, slot);
            expect(kb).toBe(ka);
            expect(E.use(b, kb, cell)).toEqual(P.use(a, ka, cell));
          } else if (r < 0.065) {
            const key = items[Math.floor(input() * items.length)];
            const cell = Math.floor(input() * a.cells.length);
            expect(E.useItem(b, key, cell)).toEqual(P.useItem(a, key, cell));
          } else if (r < 0.5) {
            P.autoHealer(a); E.autoHealer(b);
          }
          P.step(a); E.step(b);
          expect(JSON.stringify(b.events), `events t=${a.t}`).toBe(JSON.stringify(a.events));
          a.events.length = 0; b.events.length = 0;
          if (a.k % 20 === 0 || a.over) expect(snapTs(b), `${enc} ${diff} seed ${seed} t=${a.t}`).toEqual(snap(a));
        }
        expect(b.over).toBe(a.over);
      }
    });
  }
});

describe('공개모집 파티 뽑기가 같음', () => {
  it('시드 1~200', () => {
    for (const enc of Object.keys(ENCOUNTERS) as EncounterKey[]) for (let s = 1; s <= 200; s++) expect(E.rollParty(enc, s)).toEqual(P.rollParty(enc, s));
  });
});
