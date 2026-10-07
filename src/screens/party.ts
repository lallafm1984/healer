/** S05 파티 편성 (09): 공개모집(길드파티는 Lv 15·P2), 시작 위치 미리보기, 파티원 카드, 다시 뽑기, 궁합 힌트, 단축칸 고르기 */
import { CLASSES } from '../data/classes';
import { TRAITS } from '../data/traits';
import { contentOf, stageOf } from '../data/content';
import { gearStatsOf } from '../data/equipment';
import { setFxOf } from '../data/sets';
import { ENCOUNTERS } from '../data/encounters';
import { ITEMS, type ItemKey } from '../data/items';
import { CATS, PERS } from '../data/personalities';
import { GUILD_LEVEL } from '../data/progression';
import { create, recruitParty } from '../engine';
import { Flow, newSeed, rerollCost } from '../game/flow';
import { settle } from '../game/settle';
import { commit, G, healerLevel, heroNow, itemsNow, talentsNow, toggleItem } from '../game/state';
import { TUT } from '../game/tutorial';
import { battle, esc, fmt, go, ROLE, screen, topBar } from './kit';

const s = screen('s-party', '파티 편성', { enter() { if (!Flow.party) roll(); render(); } });
let msg = '';

function roll(): void {
  const segs = contentOf(Flow.content).fights(Flow.diff);
  Flow.seed = newSeed();
  Flow.party = recruitParty(segs[0], Flow.seed);
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
    const fill = u ? ROLE[u.role].color : '#1C1E33';
    const label = u ? (u.me ? '나' : u.cls ? CLASSES[u.cls].short : `${ROLE[u.role].short}${u.pers ? PERS[u.pers].ch : ''}`) : '';
    return `<g><polygon points="${hex(c.px, c.py)}" fill="${fill}" stroke="#0B0B12" stroke-width="0.12"/>${label ? `<text x="${c.px}" y="${c.py + 0.22}" text-anchor="middle" font-size="${label.length > 1 ? 0.62 : 0.8}">${label}</text>` : ''}</g>`;
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

function render(): void {
  const c = contentOf(Flow.content);
  const { slots, items } = itemsNow();
  const cost = rerollCost(Flow.rerolls);
  const guildLocked = G.save.player.level < GUILD_LEVEL;
  const hs = hints();
  s.el.innerHTML = `${topBar({ back: 's-entry', title: `편성 · ${c.name} ${Flow.diff}` })}
    <nav class="subtabs" role="tablist"><button type="button" role="tab" aria-selected="true">공개모집</button><button type="button" role="tab" aria-selected="false" disabled>길드파티 ${guildLocked ? `🔒 Lv ${GUILD_LEVEL}` : '· P2'}</button></nav>
    <div class="ns-body pty">
      ${G.save.tut === TUT.dungeon ? '<p class="coachtip">파티는 파티 찾기로 무작위로 들어옴. 마음에 안 들면 <b>다시 뽑기</b> (처음 한 번 무료). 준비되면 「출발」.</p>' : ''}
      ${boardSvg()}
      <p class="note center">시작 위치는 자동 배치 (옮길 수 없음)</p>
      <ul class="pcards">${Flow.party!.map(m => {
        const p = PERS[m.pers], c = m.cls ? CLASSES[m.cls] : null;
        return `<li class="pcard" data-cls="${c ? c.key : ''}"><span class="prole${c ? ' two' : ''}" style="background:${ROLE[m.role].color}">${c ? c.short : ROLE[m.role].short}</span>
          <div><b class="pnick">${esc(m.nick)}</b><small>${c ? `${c.name} · ` : ''}${ROLE[m.role].name} · Lv 1</small>${c ? `<p class="ppas"><b>${c.passive}</b> ${esc(c.passiveDesc)}</p>` : ''}${(m.traits || []).map(k => `<p class="ppas ptrait"><b>특성 ${TRAITS[k].name}</b> ${esc(TRAITS[k].desc)}</p>`).join('')}<p><i class="pcat" style="background:${CATS[p.cat]}">${p.ch}</i>${esc(m.pers)} <span class="star">${'★'.repeat(p.star)}</span> · ${esc(p.desc)}</p></div></li>`;
      }).join('')}</ul>
      ${hs.length ? `<section class="panel hint"><h4>💡 이번 파티</h4><ul>${hs.map(h => `<li>${esc(h)}</li>`).join('')}</ul></section>` : ''}
      <h3 class="sec">소비 아이템 <small>단축칸 ${slots}칸${slots < 4 ? ` · Lv ${slots === 2 ? 20 : 40}에 1칸 더` : ''}</small></h3>
      <div class="chips items">${(Object.keys(ITEMS) as ItemKey[]).map(k => `<button class="chip ichip" type="button" data-item="${k}" aria-pressed="${items.includes(k)}">${battle().itemIcon(k)}${ITEMS[k].name}</button>`).join('')}</div>
      <p class="note${msg ? ' warn' : ''}">${msg || items.map(k => `<b>${ITEMS[k].short}</b> ${ITEMS[k].desc}`).join('<br>') || '빈 칸'}</p>
    </div>
    <footer class="ns-foot row2">
      <button class="btn" type="button" id="reroll">다시 뽑기 ${cost ? `🪙 ${fmt(cost)}` : '(무료)'}</button>
      <button class="btn primary" type="button" id="depart">출발</button>
    </footer>`;
  msg = '';
}

s.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const it = t.closest<HTMLElement>('[data-item]');
  if (it) {
    msg = toggleItem(it.dataset.item as ItemKey);
    render(); return;
  }
  if (t.closest('#reroll')) {
    const cost = rerollCost(Flow.rerolls);
    if (G.save.player.gold < cost) { msg = `골드 부족 (🪙 ${fmt(cost)} 필요)`; render(); return; }
    G.save.player.gold -= cost; Flow.rerolls++; commit();
    roll(); render(); return;
  }
  if (t.closest('#depart')) depart();
});

export function depart(): void {
  const c = contentOf(Flow.content);
  // 튜토리얼 첫 던전이면 전투 중 안내 (02 11장 4·5번)
  const coach = Flow.coach ?? (G.save.tut === TUT.dungeon && c.key === 'rustfort' ? 'dungeon' : null);
  Flow.coach = null;
  const { slots, items } = itemsNow();
  battle().start({
    content: c.key, name: c.name, segs: c.fights(Flow.diff), diff: Flow.diff, level: healerLevel(), heroLv: G.save.player.level, stageLv: stageOf(c, Flow.diff), gearStats: gearStatsOf(G.save.gear.equipped),
    party: Flow.party!, items, slots, seed: Flow.seed, coach, hero: heroNow(), talents: talentsNow(), setFx: setFxOf(Object.values(G.save.gear.equipped)),
    onEnd(r) {
      Flow.result = r;
      Flow.settle = settle(G.save, r, Math.random);
      commit();
      go('s-settle');
    },
  });
}

