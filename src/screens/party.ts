/** S05 파티 편성 (09): 공개모집 · 길드파티(Lv 15, 02 9-2), 시작 위치 미리보기, 파티원 카드(능력·자질), 다시 뽑기(광고 하루 2번 무료), 궁합 힌트, 단축칸 고르기. 지면 광고 이어하기 (15) */
import { CLASSES } from '../data/classes';
import { contentOf } from '../data/content';
import { AD_LIMIT } from '../data/economy';
import { gearStatsOf } from '../data/equipment';
import { setFxOf } from '../data/sets';
import { ENCOUNTERS } from '../data/encounters';
import { ITEMS, type ItemKey } from '../data/items';
import { PERS } from '../data/personalities';
import { aptOf } from '../data/guild';
import { create, recruitParty } from '../engine';
import { Flow, newSeed, rerollCost } from '../game/flow';
import { autoPick, guildOpen, guildRoster, powerOf, slotsOf, togglePick } from '../game/guild';
import { isMember, needsShard, spendShard } from '../game/economy';
import { runMode } from '../game/runmode';
import { askModal, showRewarded } from '../platform/ads';
import type { BattleResult } from '../game/settle';
import { settle } from '../game/settle';
import { commit, G, healerLevel, heroNow, itemsNow, talentsNow, toggleItem } from '../game/state';
import { TUT } from '../game/tutorial';
import { cardHtml } from './members';
import { battle, esc, fmt, go, itemChipsHtml, ROLE, screen, topBar } from './kit';
import { LOCK } from './art';

const s = screen('s-party', '파티 편성', {
  enter() {
    if (!Flow.party) {
      roll();
      // 길드원이 있으면 지난번 길드파티 편성으로 시작 (09 S05)
      Flow.mode = guildReady() && G.save.guild.pick.length ? 'guild' : 'public';
      Flow.gpick = guildReady() ? autoPick(G.save, firstEnc()) : [];
      compose();
    }
    render();
  },
});
let msg = '', gmsg = '';

const firstEnc = () => ENCOUNTERS[contentOf(Flow.content).fights(Flow.diff)[0]];
/** 이번 판 단계 레벨·어픽스 (던전 레벨 단계, 주간 도전) */
const modeNow = () => runMode(G.save, contentOf(Flow.content), Flow.diff, { tier: Flow.tier, chal: Flow.chal });
const guildReady = () => guildOpen(G.save).ok && G.save.guild.members.length > 0;

function roll(): void {
  const segs = contentOf(Flow.content).fights(Flow.diff);
  Flow.seed = newSeed();
  // 공개모집 파티원도 능력 1개 (17 3장). 튜토리얼 파티는 능력 없음
  Flow.pub = recruitParty(segs[0], Flow.seed, { abilities: G.save.tut >= TUT.done });
}

/** 전투에 넘길 파티: 공개모집 그대로, 또는 고른 길드원 + 빈자리는 공개모집 */
function compose(): void {
  Flow.party = Flow.mode === 'guild' && guildReady() ? guildRoster(G.save, Flow.gpick, Flow.pub!, firstEnc()) : Flow.pub!.slice();
}

/** 시작 위치 미리보기: 첫 전투를 같은 시드로 만들어 칸 배치를 그림 (실제 전투도 이 시드로 시작) */
function boardSvg(): string {
  const segs = contentOf(Flow.content).fights(Flow.diff);
  const f = create({ encounter: segs[0], diff: Flow.diff, seed: Flow.seed, party: Flow.party! });
  const xs = f.cells.map(c => c.px), ys = f.cells.map(c => c.py);
  const minX = Math.min(...xs) - 1, minY = Math.min(...ys) - 1.2, w = Math.max(...xs) - minX + 1, h = Math.max(...ys) - minY + 1.2;
  const hex = (x: number, y: number) => Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 180) * (60 * k - 90); return `${(x + 0.94 * Math.cos(a)).toFixed(3)},${(y + 0.94 * Math.sin(a)).toFixed(3)}`; }).join(' ');
  const cells = f.cells.map(c => {
    const u = c.unit;
    const fill = u ? ROLE[u.role].color : '#201A14';
    const label = u ? (u.me ? '나' : u.cls ? CLASSES[u.cls].short : `${ROLE[u.role].short}${u.pers ? PERS[u.pers].ch : ''}`) : '';
    return `<g><polygon points="${hex(c.px, c.py)}" fill="${fill}" stroke="#080605" stroke-width="0.12"/>${label ? `<text x="${c.px}" y="${c.py + 0.22}" text-anchor="middle" font-size="${label.length > 1 ? 0.62 : 0.8}">${label}</text>` : ''}</g>`;
  }).join('');
  return `<svg class="pboard" viewBox="${minX} ${minY} ${w} ${h}" role="img" aria-label="시작 위치 미리보기">${cells}</svg>`;
}

function hints(): string[] {
  const out: string[] = [];
  const segs = contentOf(Flow.content).fights(Flow.diff);
  const boss = ENCOUNTERS[segs[segs.length - 1]];
  const hard = Flow.party!.filter(m => PERS[m.pers].star === 3);
  for (const m of hard) out.push(`${m.nick}(${m.pers}): ${PERS[m.pers].desc}`);
  const ih = battle().itemHint(boss.script).replace(/^💡\s*/, '');
  if (ih) out.push(ih);
  return out;
}

/** 직업 없는 옛 파티 카드 (시뮬·옛 테스트용 파티) */
function plainCard(m: { role: string; nick: string; pers: keyof typeof PERS }): string {
  return `<li class="pcard"><span class="prole" style="background:${ROLE[m.role].color}">${ROLE[m.role].short}</span><div><b class="pnick">${esc(m.nick)}</b><small>${ROLE[m.role].name}</small><p>${esc(m.pers)}</p></div></li>`;
}

/** 길드파티 편성 (02 9-2): 길드원 눌러서 넣고 빼기, 빈자리는 공개모집으로 채움 */
function guildPickHtml(stage: number): string {
  const enc = firstEnc(), sl = slotsOf(enc), ms = G.save.guild.members;
  const picked = Flow.gpick.map(id => ms.find(m => m.id === id)).filter(Boolean);
  const tanks = picked.filter(m => CLASSES[m!.cls].role === 'tank').length;
  const fill = Flow.party!.filter(e => e.gid == null);
  const list = ms.slice().sort((a, b) => (Flow.gpick.includes(b.id) ? 1 : 0) - (Flow.gpick.includes(a.id) ? 1 : 0) || powerOf(b) - powerOf(a));
  const under = picked.filter(m => m!.lv < stage).length;
  return `<p class="pickhead"><b>길드원 ${picked.length}/${sl.tank + sl.dps}</b><small>탱커 ${tanks}/${sl.tank} · 딜러 ${picked.length - tanks}/${sl.dps}${fill.length ? ` · 빈자리 ${fill.length} = 공개모집` : ''}</small><button class="btn mini" type="button" id="autoPick">자동 편성</button></p>
    ${gmsg ? `<p class="warnbox">${esc(gmsg)}</p>` : ''}
    ${under ? `<p class="warnbox">권장 레벨(Lv ${stage})보다 낮은 길드원 ${under}명: 체력·딜이 낮음</p>` : ''}
    <ul class="pcards">${list.map(m => {
      const on = Flow.gpick.includes(m.id);
      return cardHtml({ ...m, apt: aptOf(m), power: powerOf(m) }, { attrs: `data-gpick="${m.id}" role="button" tabindex="0"`, cls: `withbtn tap${on ? ' picked' : ''}`, desc: false, extra: `<span class="pick${on ? ' on' : ''}">${on ? '✓' : ''}</span>` });
    }).join('')}
    ${fill.map(m => (m.cls ? cardHtml({ ...m, cls: m.cls, lv: stage }, { cls: 'fill', desc: false }).replace('</small>', ' · 공개모집 보충</small>') : plainCard(m))).join('')}</ul>`;
}

function render(): void {
  const c = contentOf(Flow.content);
  const { slots, items } = itemsNow();
  const cost = rerollCost(Flow.rerolls);
  const go2 = guildOpen(G.save);
  const guildTab = !go2.ok ? `${LOCK}${go2.why.replace('에 열림', '')}` : !G.save.guild.members.length ? '· 길드원 없음' : '';
  const isGuild = Flow.mode === 'guild' && guildReady();
  const stage = modeNow().stage;
  const hs = hints();
  const tutDone = G.save.tut >= TUT.done, adLeft = AD_LIMIT.reroll - G.save.daily.ads.reroll;
  const title = Flow.chal ? `편성 · 주간 도전 ${Flow.chal}단계` : `편성 · ${c.name} ${Flow.diff}${Flow.tier ? ` Lv ${Flow.tier}` : ''}`;
  s.el.innerHTML = `${topBar({ back: 's-entry', title })}
    <nav class="subtabs" role="tablist"><button type="button" role="tab" data-mode="public" aria-selected="${!isGuild}">공개모집</button><button type="button" role="tab" data-mode="guild" aria-selected="${isGuild}"${guildReady() ? '' : ' disabled'}>길드파티 ${guildTab}</button></nav>
    <div class="ns-body pty">
      ${G.save.tut === TUT.dungeon ? '<p class="coachtip">파티는 파티 찾기로 무작위로 들어옴. 마음에 안 들면 <b>다시 뽑기</b> (처음 한 번 무료). 준비되면 「출발」.</p>' : ''}
      ${boardSvg()}
      <p class="note center">시작 위치는 자동 배치 (옮길 수 없음)</p>
      ${isGuild ? guildPickHtml(stage) : `<ul class="pcards">${Flow.party!.map(m => (m.cls ? cardHtml({ ...m, cls: m.cls, lv: stage }, { attrs: `data-cls="${m.cls}"` }) : plainCard(m))).join('')}</ul>`}
      ${hs.length ? `<section class="panel hint"><h4>💡 이번 파티</h4><ul>${hs.map(h => `<li>${esc(h)}</li>`).join('')}</ul></section>` : ''}
      <h3 class="sec">소비 아이템 <small>단축칸 ${slots}칸${slots < 4 ? ` · Lv ${slots === 2 ? 20 : 40}에 1칸 더` : ''}</small></h3>
      ${itemChipsHtml(items)}
      <p class="note${msg ? ' warn' : ''}">${msg || items.map(k => `<b>${ITEMS[k].short}</b> ${ITEMS[k].desc}`).join('<br>') || '빈 칸'}</p>
      ${tutDone && !isGuild && cost && adLeft > 0 ? `<button class="btn mini adroll" type="button" id="adReroll">📺 광고 보고 무료로 다시 뽑기 (오늘 ${adLeft}번)</button>` : ''}
    </div>
    <footer class="ns-foot row2">
      <button class="btn" type="button" id="reroll">다시 뽑기 ${cost ? `🪙 ${fmt(cost)}` : '(무료)'}</button>
      <button class="btn primary" type="button" id="depart">출발</button>
    </footer>`;
  msg = '';
}

s.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const md = t.closest<HTMLElement>('[data-mode]');
  if (md && !md.hasAttribute('disabled')) { Flow.mode = md.dataset.mode as 'public' | 'guild'; compose(); render(); return; }
  const gp = t.closest<HTMLElement>('[data-gpick]');
  if (gp) { const r = togglePick(G.save, firstEnc(), Flow.gpick, Number(gp.dataset.gpick)); Flow.gpick = r.pick; gmsg = r.msg; compose(); render(); gmsg = ''; return; }
  if (t.closest('#autoPick')) { G.save.guild.pick = []; Flow.gpick = autoPick(G.save, firstEnc()); compose(); render(); return; }
  const it = t.closest<HTMLElement>('[data-item]');
  if (it) {
    msg = toggleItem(it.dataset.item as ItemKey);
    render(); return;
  }
  if (t.closest('#reroll')) {
    const cost = rerollCost(Flow.rerolls);
    if (G.save.player.gold < cost) { msg = `골드 부족 (🪙 ${fmt(cost)} 필요)`; render(); return; }
    G.save.player.gold -= cost; Flow.rerolls++; commit();
    roll(); compose(); render(); return;
  }
  if (t.closest('#adReroll')) { void adReroll(); return; }
  if (t.closest('#depart')) { msg = depart(); if (msg) render(); }
});

/** 광고 다시 뽑기 (15 7장): 하루 2번, 골드 대신 */
async function adReroll(): Promise<void> {
  const save = G.save, mem = isMember(save);
  if (save.daily.ads.reroll >= AD_LIMIT.reroll) return;
  if (!(await showRewarded('파티 다시 뽑기 (무료)', mem))) return;
  save.daily.ads.reroll++; commit();
  roll(); compose(); render();
}

/** 지면 광고 보고 진 구간부터 다시 (15 7장): 하루 3번, 등급 최대 B. 주간 도전·자동 힐러 판·스스로 포기한 판은 안 물어봄 */
async function tryContinue(r: BattleResult): Promise<boolean> {
  const save = G.save;
  if (save.tut < TUT.done || r.win || r.quit || r.giveUp || r.auto || Flow.chal || save.daily.ads.cont >= AD_LIMIT.cont) return false;
  const mem = isMember(save), left = AD_LIMIT.cont - save.daily.ads.cont;
  const yes = await askModal(mem ? '이어하기' : '광고 보고 이어하기', `${esc(r.reason)}<br>진 구간부터 다시 (마나는 그 구간 시작 때로)<br>등급 최대 B · 오늘 ${left}번`, '정산으로', mem ? '이어하기' : '📺 이어하기');
  if (!yes || !(await showRewarded('이어하기', mem))) return false;
  save.daily.ads.cont++; commit();
  battle().resume();
  return true;
}

/** 출발. 악몽은 종 조각 1개 (12 3-4). 못 가면 이유를 돌려줌 */
export function depart(): string {
  const c = contentOf(Flow.content);
  const tutDone = G.save.tut >= TUT.done;
  if (tutDone && !Flow.chal && needsShard(Flow.diff)) { const err = spendShard(G.save); if (err) return err; commit(); }
  if (Flow.mode === 'guild' && guildReady()) { G.save.guild.pick = Flow.gpick.slice(); commit(); }
  // 튜토리얼 첫 던전이면 전투 중 안내 (02 11장 4·5번)
  const coach = Flow.coach ?? (G.save.tut === TUT.dungeon && c.key === 'rustfort' ? 'dungeon' : null);
  Flow.coach = null;
  const { slots, items } = itemsNow();
  const m = modeNow();
  battle().start({
    content: c.key, name: Flow.chal ? `도전 ${Flow.chal}단계` : c.name, segs: c.fights(Flow.diff), diff: Flow.diff, level: healerLevel(), heroLv: G.save.player.level, stageLv: m.stage, gearStats: gearStatsOf(G.save.gear.equipped),
    affixes: m.affixes, bossMult: m.bossMult, limit: m.limit, chal: m.chal || undefined,
    party: Flow.party!, items, slots, seed: Flow.seed, coach, hero: heroNow(), talents: talentsNow(), setFx: setFxOf(Object.values(G.save.gear.equipped)),
    stock: tutDone ? { ...G.save.bag } : undefined,
    async onEnd(r) {
      if (await tryContinue(r)) return;
      Flow.result = r;
      Flow.settle = settle(G.save, r, Math.random, Flow.party!);
      commit();
      go('s-settle');
    },
  });
  return '';
}

