/** 장비 탭 (09 S10은 P2). P1은 보기·장착만: 6부위 착용 칸, 능력치 합계, 가방 */
import { GRADE_STYLE, gearStatsOf, ITEM_GRADES, itemScore, SLOTS, slotName, type GearItem } from '../data/equipment';
import { equip, G } from '../game/state';
import { esc, screen, topBar } from './kit';

const s = screen('s-gear', '장비', { tab: 'gear', enter() { render(); } });

const tile = (it: GearItem | undefined, label: string) => it
  ? `<div class="gtile" style="--g:${GRADE_STYLE[it.grade].color}"><small>${label}</small><b>${esc(it.name)}</b><span>${it.grade}${it.plus ? ` +${it.plus}` : ''}</span></div>`
  : `<div class="gtile empty"><small>${label}</small><b>빈칸</b></div>`;

function render(): void {
  const eq = G.save.gear.equipped;
  const st = gearStatsOf(eq);
  const bag = [...G.save.gear.bag].sort((a, b) => ITEM_GRADES.indexOf(b.grade) - ITEM_GRADES.indexOf(a.grade) || a.slot.localeCompare(b.slot));
  s.el.innerHTML = `${topBar({ settings: true })}
    <div class="ns-body gear">
      <h2 class="h">장비 <small>강화·분해·세트는 P2</small></h2>
      <div class="gslots">${SLOTS.map(x => tile(eq[x.key], x.name)).join('')}</div>
      <p class="note">힐량 ×${st.heal.toFixed(2)} · 치명타 ${Math.round(st.crit * 100)}% · 가속 ${Math.round(st.haste * 100)}% · 마나 재생 ×${st.regen.toFixed(2)}</p>
      <h3 class="sec">가방 <small>${bag.length}개</small></h3>
      ${bag.length ? `<ul class="bag">${bag.map(it => {
        const cur = eq[it.slot];
        const up = itemScore(it) > itemScore(cur);
        return `<li style="--g:${GRADE_STYLE[it.grade].color}"><span class="gdot">${it.grade[0]}</span><div><b>${esc(it.name)}</b><small>${slotName(it.slot)} · ${it.grade}${up ? ' · <em>더 좋음</em>' : ''}</small></div><button class="btn" type="button" data-equip="${it.id}">장착</button></li>`;
      }).join('')}</ul>` : '<p class="note">던전을 클리어하면 장비가 1개씩 나와요.</p>'}
    </div>`;
}

s.el.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-equip]');
  if (b) { equip(Number(b.dataset.equip)); render(); }
});
