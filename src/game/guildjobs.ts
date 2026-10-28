/**
 * 길드 할 일 (93 8장, 업데이트 묶음): 부탁 쪽지 (매일 2장) · 주간 원정 (매주 3곳). 놓쳐도 손해 없음: 날 · 주가 바뀌면 새로 오고 쌓이지 않음.
 * 장소는 길잡이 (game/guide) 추천 범위 안에서: 화면이 추천 칸 · 열림 판정을 넘겨 새로 고치고 (이 파일은 화면 상태를 안 읽음), 판 뒤 (settle)에서 채움.
 */
import { ALL_DIFFS, CONTENT, stageOf, type ContentDef } from '../data/content';
import type { DiffName } from '../data/difficulty';
import { EXPED, REQ } from '../data/guild';
import { topLevel, type SaveData } from '../platform/storage';
import { dayKey, weekKey } from './clock';
import { guildPartyFits, isGuildParty } from './guild';
import { ENCOUNTERS } from '../data/encounters';
import type { RosterEntry } from '../engine/types';


/** 부탁 쪽지: 날이 바뀌면 길드원 2명이 새로 (길잡이 추천 8곳 가운데 앞 3곳에서 하나) */
export function refreshReqs(save: SaveData, stagesAll: readonly { content: string; diff: DiffName }[], r: () => number, now = Date.now()): void {
  const g = save.guild, day = dayKey(now);
  if (!g.founded || g.reqs.day >= day) return; // 더 늦은 날만 (103)
  if (!g.members.length) { g.reqs = { day: '', list: [] }; return; } // 길드원이 없으면 그날을 쓰지 않음: 첫 영입 뒤 바로 부탁 (Lim 10-21 자동 영입 없앰)
  g.reqs = { day, list: [] };
  const stages = stagesAll.slice(0, 8);
  const pool = g.members.slice();
  for (let i = 0; i < REQ.perDay && pool.length && stages.length; i++) {
    const m = pool.splice(Math.floor(r() * pool.length), 1)[0];
    const s = stages[Math.floor(r() * Math.min(3, stages.length))];
    g.reqs.list.push({ nick: m.nick, content: s.content, diff: s.diff, done: false });
  }
}

/** 주간 원정: 주가 바뀌면 내 레벨에 맞는 3곳 (5인 던전 · 10인 · 20인 레이드, 안 열렸으면 던전), 보통 이상 */
export function refreshExped(save: SaveData, open: (c: ContentDef, d: DiffName) => boolean, now = Date.now()): void {
  const g = save.guild, week = weekKey(now);
  if (!g.founded || g.exped.week > week) return; // 시계를 뒤로 돌린 주는 그대로 (103)
  if (g.exped.week < week && expedReady(save)) return; // 다 끝냈는데 못 받은 원정 상자는 주가 바뀌어도 받게 둠 (받은 뒤 새 주 목록, 105 QA 2)
  const my = topLevel(save), ok = (c: ContentDef) => c.ready && !c.hidden && !c.anchor && open(c, '보통') && stageOf(c, '보통') <= my; // 보충 장소 (113 4-3)는 원정 후보 아님
  const best = (xs: ContentDef[]) => xs.filter(ok).sort((a, b) => stageOf(b, '보통') - stageOf(a, '보통'));
  const dungeons = best(CONTENT.filter(c => c.kind === 'dungeon' && c.size('보통') === 5));
  // 원정은 길드파티로만 (103 다른 문제점 5 · 105 QA): 지금 길드원으로 그 레이드 자리를 다 못 채우면 (역할 자리로 셈, 2026-10-28 길드파티는 길드원만) 그 칸은 던전으로
  const fits = (c: ContentDef) => c.kind !== 'raid' || guildPartyFits(save, ENCOUNTERS[c.fights('보통')[0]]);
  if (g.exped.week === week) {
    // 같은 주: 주 중에 길드원이 줄어 못 깨게 된 안 깬 레이드 칸만 던전으로 다시 뽑음
    const used = new Set(g.exped.list.map(x => x.content));
    g.exped.list = g.exped.list.map(x => {
      const c = CONTENT.find(k => k.key === x.content);
      if (x.done || !c || fits(c)) return x;
      const d = dungeons.find(k => !used.has(k.key));
      if (!d) return x;
      used.add(d.key);
      return { content: d.key, done: false };
    });
    return;
  }
  const raid = (n: number) => best(CONTENT.filter(c => c.kind === 'raid' && c.size('보통') === n)).find(fits);
  const picks = [dungeons[0], raid(10) ?? dungeons[1], raid(20) ?? dungeons[2]].filter((c, i, a): c is ContentDef => !!c && a.indexOf(c) === i);
  g.exped = { week, list: picks.slice(0, EXPED.n).map(c => ({ content: c.key, done: false })), got: false };
}

export interface JobsDone {
  /** 이번 판에 끝낸 부탁 (경험치 2배를 받을 길드원) */
  reqs: string[];
  /** 끝낸 원정 칸 (콘텐츠 키) · 셋 다 끝남 */
  exped: string[];
  expedAll: boolean;
  fame: number;
}

/** 판 뒤 (이긴 판): 부탁 = 그 사람을 넣고 그 장소를 그 난이도 이상으로 · 원정 = 길드파티로 그 장소 보통 이상. 부탁 대상은 길드 정산에서 경험치 2배, 원정은 명성을 바로 줌 */
export function jobsAfter(save: SaveData, o: { win: boolean; quit: boolean; content: string; diff: DiffName; roster: RosterEntry[] }, now = Date.now()): JobsDone {
  const out: JobsDone = { reqs: [], exped: [], expedAll: false, fame: 0 };
  const g = save.guild;
  if (!g.founded || !o.win || o.quit) return out;
  const di = ALL_DIFFS.indexOf(o.diff), went = new Set(o.roster.filter(e => e.gid != null).map(e => e.nick));
  // 지난 날 부탁 · 지난 주 원정은 건너뜀 (105 QA 2: 주가 바뀐 뒤 길드 탭을 안 거치면 지난주 원정이 이어져 「원정 상자 열림」이 뜨고 받지는 못했음)
  const today = g.reqs.day === dayKey(now), thisWeek = g.exped.week === weekKey(now);
  for (const q of today ? g.reqs.list : []) {
    if (q.done || q.content !== o.content || di < ALL_DIFFS.indexOf(q.diff) || !went.has(q.nick)) continue;
    q.done = true; out.reqs.push(q.nick);
  }
  if (thisWeek && isGuildParty(o.roster) && di >= ALL_DIFFS.indexOf('보통')) for (const x of g.exped.list) {
    if (x.done || x.content !== o.content) continue;
    x.done = true; out.exped.push(x.content); out.fame += EXPED.fame;
  }
  out.expedAll = out.exped.length > 0 && g.exped.list.length > 0 && g.exped.list.every(x => x.done);
  g.fame += out.fame;
  return out;
}

/** 원정 상자를 받을 수 있나 (셋 다 끝내고 아직 안 받음) */
export const expedReady = (save: SaveData) => save.guild.exped.list.length > 0 && save.guild.exped.list.every(x => x.done) && !save.guild.exped.got;
/** 길드 탭 빨간 점: 안 끝낸 부탁 · 받을 원정 상자 */
export const jobsDot = (save: SaveData) => save.guild.reqs.list.some(q => !q.done) || expedReady(save);
