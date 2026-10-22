/**
 * 보스 재미 QA 표 (2026-10-23 「힐러로 플레이하면 재미있는가」): 장소 × 난이도 칸마다 보스 · 기믹 부품 · 힐러가 할 일을 뽑는다.
 * 실행: npm run bossfun -- [--out .sim/bossfun.json]
 * 숫자는 데이터만 읽는다 (전투를 돌리지 않음). 악몽 변화 (when.mythic)는 악몽 칸에만 셈.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { BOSSES, type AddDef, type DebuffDef, type SkillDef, type SkillEffect } from '../src/data/bosses';
import { CONTENT, ALL_DIFFS } from '../src/data/content';
import { ENCOUNTERS, type MobAttack } from '../src/data/encounters';
import type { DiffName } from '../src/data/difficulty';

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const out = opt('--out') || '.sim/bossfun.json';

/** 힐러가 할 일 갈래 (35 3장 갈래를 힐러 손 기준으로 다시 묶음) */
export const TASKS = {
  tank: '탱커 강타',
  aoe: '광역',
  dispel: '해제 판단',
  dodge: '장판 (파티원이 피함)',
  prefill: '못 피하는 피해 미리 채우기',
  focus: '찍힌 사람 단일',
  line: '체력 선 퍼즐',
  target: '힐 대상 퍼즐',
  cast: '시전 · 마나',
  adds: '판 위 적',
  dps: '딜 연계',
  phase: '구간 변화',
} as const;
type Task = keyof typeof TASKS;

const DISPEL = new Set(['질병', '독', '저주', '마법']);

interface Hit { part: string; task: Task; skill: string }

function debuffParts(d: DebuffDef, skill: string): Hit[] {
  const h: Hit[] = [];
  if (DISPEL.has(d.type) && !d.lock) h.push({ part: d.trap ? '함정 디버프' : `해제 ${d.type}`, task: 'dispel', skill });
  if (d.cureAt != null) h.push({ part: d.cureAt >= 1 ? '완치 표식' : '쇠약', task: 'line', skill });
  if (d.grow) h.push({ part: '쇠약', task: 'line', skill });
  if (d.cap != null) h.push({ part: '치유 상한', task: 'line', skill });
  if (d.invert) h.push({ part: '뒤집힌 축복', task: 'line', skill });
  if (d.over) h.push({ part: '넘치는 빛 과부하', task: 'line', skill });
  if (d.absorb) h.push({ part: d.end?.p === 'pass' ? '넘어가는 포자' : '치유 흡수', task: 'line', skill });
  if (d.debt) h.push({ part: '빌린 생명', task: 'line', skill });
  if (d.swell) h.push({ part: '부풀기', task: 'line', skill });
  if (d.charm) h.push({ part: '매혹', task: 'line', skill });
  if (d.count) h.push({ part: '역류', task: 'cast', skill });
  if (d.drain) h.push({ part: '마나 갈취', task: 'cast', skill });
  if (d.swap) h.push({ part: '탱커 교대', task: 'tank', skill });
  if (d.maxCut) h.push({ part: '최대 체력 깎기', task: 'line', skill });
  if (d.noDps && !d.charm) h.push({ part: '딜 멈춤 디버프', task: 'dps', skill });
  if (d.healCut && !DISPEL.has(d.type)) h.push({ part: '받는 치유 감소 (못 지움)', task: 'line', skill });
  const e = d.end;
  if (e?.p === 'flip') h.push({ part: '뒤집힘 저주', task: 'line', skill });
  if (e?.p === 'jump') h.push({ part: '옮겨붙음', task: 'dispel', skill });
  if (e?.p === 'trapHit' || e?.p === 'blast' || e?.p === 'trapLoan') h.push({ part: '터지는 함정', task: 'dispel', skill });
  if (e?.p === 'colDmg' || e?.p === 'spread') h.push({ part: '퍼지는 디버프', task: 'dispel', skill });
  if (e?.p === 'stackHit') h.push({ part: '중첩 터짐', task: 'cast', skill });
  return h;
}

function addParts(a: AddDef, skill: string): Hit[] {
  const h: Hit[] = [];
  const j = a.job;
  const name: Record<string, string> = {
    mend: '치유하는 쫄', bomb: '폭탄', pylon: '보호막 수정', drain: '마나 갈취 쫄', jail: '감옥', smash: '큰 쫄', march: '걸어오는 쫄',
    fixate: '자폭 쫄', sting: '쏘는 쫄', hatch: '부화하는 알', hoard: '금화 더미',
  };
  h.push({ part: j ? name[j.p] : a.cleave ? '쫄 떼' : a.aura ? '오라 쫄' : '쫄', task: 'adds', skill });
  if (j?.p === 'fixate' || j?.p === 'sting') h.push({ part: name[j.p], task: 'focus', skill });
  if (j?.p === 'drain') h.push({ part: '마나 갈취', task: 'cast', skill });
  if (j?.p === 'smash') h.push({ part: '큰 쫄 강타', task: 'tank', skill });
  if (j?.p === 'hatch') h.push(...addParts(j.add, skill).filter(x => x.part !== '쫄'));
  if (a.down?.p === 'burst') h.push({ part: '파열', task: 'aoe', skill });
  if (a.down?.p === 'debuff') h.push(...debuffParts(a.down.debuff, skill));
  return h;
}

function effectParts(e: SkillEffect, skill: string): Hit[] {
  const h: Hit[] = [];
  const P = (part: string, task: Task) => h.push({ part, task, skill });
  switch (e.p) {
    case 'auto': break;
    case 'tank': P('탱커 강타', 'tank'); if (e.debuff) h.push(...debuffParts(e.debuff, skill)); if (e.debuff?.healCut) P('썩는 상처', 'tank'); break;
    case 'all': P(e.grow ? '커지는 광역' : '광역', 'aoe'); if (e.debuff) h.push(...debuffParts(e.debuff, skill)); break;
    case 'debuff': h.push(...debuffParts(e.debuff, skill)); if (e.burstAdjacent) P('전염', 'dispel'); if (e.pick === 'lowest') P('사냥', 'focus'); break;
    case 'rot': P('최대 체력 깎기', 'line'); h.push(...debuffParts(e.debuff, skill)); break;
    case 'pull': P('끌어당김', 'focus'); if (e.pad) P('받침', 'dps'); if (e.link) P('생명 사슬 나눔', 'target'); break;
    case 'drag': P('물로 끌어내림', 'focus'); break;
    case 'hunt': P('사냥', 'focus'); break;
    case 'greed': P('보물 욕심', 'focus'); if (e.debuff) h.push(...debuffParts(e.debuff, skill)); break;
    case 'melt': P('녹는 보호막', 'cast'); break;
    case 'adds': h.push(...addParts(e.add, skill)); break;
    case 'hole': P('무너지는 바닥', 'adds'); break;
    case 'order': P(e.fake ? '차례 (신기루)' : '차례', 'target'); break;
    case 'jail': P('감옥', 'adds'); break;
    case 'quake': P('진동', 'cast'); if (e.dmg) P('광역', 'aoe'); break;
    case 'beat': P('크게 뛰기', 'cast'); if (e.dmg) P('광역', 'aoe'); break;
    case 'rest': P('숨 고르기', 'phase'); break;
    case 'clear': break;
    case 'stagger': P('무력화', 'dps'); break;
    case 'counter': P(e.decoy ? '가짜 반격 틈' : '반격 틈', 'dps'); break;
    case 'tower': P('받침', 'dps'); break;
    case 'cycle': for (const d of e.debuffs) h.push(...debuffParts(d, skill)); P(e.random ? '무작위 디버프 (모자)' : e.each ? '네 가지 디버프' : '돌아가는 디버프', 'dispel'); break;
    case 'ring': P('요정 고리', 'target'); break;
    case 'soul': P('헤매는 영혼', 'target'); if (e.type) P(`영혼 해제 ${e.type}`, 'dispel'); break;
    case 'link': P(e.kind === 'balance' ? '생명 사슬 균형' : '생명 사슬 나눔', 'target'); break;
    case 'vessel': P('넘치는 빛 그릇', 'target'); break;
    case 'share': P('집결 분담', 'aoe'); break;
    case 'trade': P('디버프 맞바꿈', 'tank'); break;
    case 'slow': P('깨진 시간 (시전 느림)', 'cast'); break;
    case 'empower': P('강해짐', 'phase'); break;
    case 'strike': P('찍기', 'focus'); if (e.debuff) h.push(...debuffParts(e.debuff, skill)); break;
    case 'glass': P('모래시계', 'cast'); break;
    case 'lift': P('띄워 올리기', 'focus'); if (e.pre) h.push(...debuffParts(e.pre, skill)); if (e.chain) P('연쇄 번개', 'focus'); break;
    case 'chain': P('연쇄 번개', 'focus'); break;
  }
  return h;
}

function skillParts(s: SkillDef): Hit[] {
  const h: Hit[] = [];
  const nm = s.name ?? s.key;
  if (s.effect) h.push(...effectParts(s.effect, nm));
  if (s.cells) {
    const z = s.cells;
    if (z.p === 'tide') h.push({ part: '어둠물 밀물', task: 'prefill', skill: nm });
    else if (z.p === 'ring') h.push({ part: '퍼지는 박동', task: 'prefill', skill: nm });
    else if (z.p === 'safe') h.push({ part: z.at === 'side' ? '피난처 (신기루)' : '피난처', task: 'dodge', skill: nm });
    else if (s.fixed) h.push({ part: z.p === 'flow' ? '못 피하는 훑기' : '못 피하는 줄', task: 'prefill', skill: nm });
    else h.push({ part: z.p === 'flow' ? '흐르는 장판' : z.p === 'edge' ? '바깥 줄 장판' : z.p === 'line' ? '줄 장판' : z.p === 'bodyCols' ? '몸통 열 장판' : '장판', task: 'dodge', skill: nm });
  }
  if (s.hitDebuff) h.push(...debuffParts(s.hitDebuff, nm));
  if (s.hitDebt) h.push({ part: '맞으면 빚', task: 'line', skill: nm });
  if (s.mirage) h.push({ part: '신기루', task: 'focus', skill: nm });
  if (s.cut && s.effect?.p !== 'counter') h.push({ part: '끊기 가능', task: 'dps', skill: nm });
  if (s.target === 'offtank') h.push({ part: '부탱커 돌진', task: 'tank', skill: nm });
  return h;
}

function mobParts(a: MobAttack): Hit[] {
  const nm = a.name ?? a.key;
  if (a.effect) return effectParts(a.effect, nm);
  if (a.to === 'all') return [{ part: '광역', task: 'aoe', skill: nm }];
  if (a.to === 'other') return [{ part: '딜러 때림', task: 'focus', skill: nm }];
  return [];
}

const active = (s: SkillDef, mythic: boolean) => s.when?.mythic == null || s.when.mythic === mythic;

interface FightRow { enc: string; name: string; boss: boolean; script?: string; skills: number; perMin: number; phases: number; inter: boolean; bodies: number; hits: Hit[] }
function fightRow(key: string, mythic: boolean): FightRow {
  const e = ENCOUNTERS[key as keyof typeof ENCOUNTERS];
  if (e.mobs) {
    const hits = e.mobs.flatMap(m => [...m.attacks.flatMap(mobParts), ...(m.down ? (m.down.p === 'burst' ? [{ part: '파열', task: 'aoe' as Task, skill: m.name }] : debuffParts(m.down.debuff, m.name)) : [])]);
    if (e.mobs.some(m => m.elite)) hits.push({ part: '정예', task: 'tank', skill: '정예' });
    return { enc: key, name: e.name, boss: false, skills: e.mobs.reduce((n, m) => n + m.attacks.filter(a => a.kind).length, 0), perMin: Math.round(e.mobs.reduce((n, m) => n + m.count * m.attacks.filter(a => a.kind).reduce((x, a) => x + 60 / a.period, 0), 0) * 10) / 10, phases: 1, inter: false, bodies: e.mobs.length, hits };
  }
  const b = BOSSES[e.script as keyof typeof BOSSES];
  const skills = b.skills.filter(s => active(s, mythic));
  const hits = skills.flatMap(skillParts);
  const flowDo = (b.flow ?? []).flatMap(st => (st.p === 'when' && (st.if.mythic == null || st.if.mythic === mythic) ? st.do : []));
  const phaseNums = new Set([b.phase[0], ...flowDo.filter(d => d.p === 'phase').map(d => (d as { n: number }).n)]);
  const inter = flowDo.some(d => d.p === 'inter');
  for (const d of flowDo) {
    if (d.p === 'rats') hits.push({ part: '쥐떼', task: 'focus', skill: '흐름' });
    if (d.p === 'debuffDebuffed') hits.push(...debuffParts(d.debuff, '흐름'));
    if (d.p === 'empower') hits.push({ part: '강해짐', task: 'phase', skill: '흐름' });
    if (d.p === 'cheer') hits.push({ part: '함성', task: 'phase', skill: '흐름' });
    if (d.p === 'dark') hits.push({ part: '영원한 저녁', task: 'line', skill: '흐름' });
  }
  for (const st of b.flow ?? []) if (st.p === 'song') hits.push({ part: '노래 열', task: 'dodge', skill: '흐름' });
  if (b.watch) hits.push({ part: '주시', task: 'cast', skill: '주시' });
  if (phaseNums.size > 1 || inter) hits.push({ part: `구간 ${phaseNums.size}${inter ? ' + 인터미션' : ''}`, task: 'phase', skill: '흐름' });
  if (mythic && b.skills.some(s => s.when?.mythic === true)) hits.push({ part: '악몽 변화', task: 'phase', skill: '악몽' });
  // 분당 기술 수 (평타 빼고, 흐름이 여는 기술은 period로 셈): 밀도
  const perMin = Math.round(skills.filter(s => !s.hidden && s.period > 0 && s.period < 1e9).reduce((x, s) => x + 60 / s.period, 0) * 10) / 10;
  return { enc: key, name: e.name, boss: true, script: e.script, skills: skills.filter(s => !s.hidden).length, perMin, phases: phaseNums.size, inter, bodies: b.bodies?.length ?? 1, hits };
}

const kindName = { explore: '탐험', dungeon: '던전', raid: '레이드' } as const;
const cells = CONTENT.filter(c => !c.hidden && c.ready).flatMap(c => ALL_DIFFS.map((d: DiffName) => {
  const mythic = d === '악몽';
  const fights = c.fights(d).map(k => fightRow(k, mythic));
  const hits = fights.flatMap(f => f.hits.map(h => ({ ...h, enc: f.enc, boss: f.boss })));
  const tasks = [...new Set(hits.map(h => h.task))];
  const parts = [...new Set(hits.map(h => h.part))];
  const bossTasks = [...new Set(hits.filter(h => h.boss).map(h => h.task))];
  return {
    content: c.key, name: c.name, kind: kindName[c.kind], size: c.size(d), lv: c.stageLv, diff: d,
    bosses: fights.filter(f => f.boss).map(f => ({ enc: f.enc, script: f.script, name: f.name, skills: f.skills, perMin: f.perMin, phases: f.phases, inter: f.inter, bodies: f.bodies, parts: [...new Set(f.hits.map(h => h.part))], tasks: [...new Set(f.hits.map(h => h.task))] })),
    trash: fights.filter(f => !f.boss).map(f => ({ enc: f.enc, name: f.name, perMin: f.perMin, parts: [...new Set(f.hits.map(h => h.part))] })),
    tasks, bossTasks, parts,
  };
}));

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ tasks: TASKS, cells }, null, 1));
console.log(`칸 ${cells.length}개 (장소 ${new Set(cells.map(c => c.content)).size}) → ${out}`);
