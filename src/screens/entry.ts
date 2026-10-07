/** S04 난이도·입장 (09): 난이도 4단, 권장 레벨·장비(미달이면 경고만), 진행·보스 공략, 드롭·보상 미리보기 */
import { ALL_DIFFS, contentOf, isRaid } from '../data/content';
import { DIFFS, MYTHIC, type DiffName } from '../data/difficulty';
import { ENCOUNTERS } from '../data/encounters';
import { avgScore, DROP_TABLE, gearSummary, GRADE_STYLE, ITEM_GRADES, LEGEND_LEVEL, RECOMMENDED } from '../data/equipment';
import { clearGold, clearXp } from '../data/progression';
import { Flow } from '../game/flow';
import { G, lockOf } from '../game/state';
import { battle, esc, fmt, go, screen, topBar } from './kit';

const s = screen('s-entry', '난이도·입장', { enter() { render(); } });

function diffNote(d: DiffName, raid: boolean): string {
  const x = DIFFS[d];
  let t = `받는 피해 ×${x.dmg} · 파티원 회피 ${Math.round(x.dodge * 100)}%`;
  if (d === '악몽') t += raid ? ' · 레이드 악몽은 20인' : ` · 파티원 체력·딜 ×${MYTHIC.party} · 보스 체력 ×${MYTHIC.bossHp}`;
  return t;
}

function render(): void {
  const c = contentOf(Flow.content);
  const raid = isRaid(c);
  if (lockOf(c, Flow.diff).locked) Flow.diff = '보통';
  const d = Flow.diff;
  const segs = c.fights(d);
  const rec = RECOMMENDED[d];
  const mine = avgScore(G.save.gear.equipped);
  const warn = rec && mine < rec.score;
  const lvWarn = G.save.player.level < c.stageLv;
  const table = DROP_TABLE[d].map((p, i) => [ITEM_GRADES[i], p] as const).filter(([, p]) => p > 0);
  const legendCut = G.save.player.level < LEGEND_LEVEL && table.some(([g]) => g === '전설');
  const goldA = clearGold(c.stageLv, d, 'A', raid ? 1 : 0), goldS = clearGold(c.stageLv, d, 'S', raid ? 1 : 0);
  const xpA = clearXp(G.save.player.level, c.stageLv, d, 'A', { raid, win: true });

  s.el.innerHTML = `${topBar({ back: 's-content', title: `${c.name} · 단계 Lv ${c.stageLv}` })}
    <div class="ns-body entry">
      <div class="chips diffs" role="radiogroup" aria-label="난이도">${ALL_DIFFS.map(x => {
        const lk = lockOf(c, x);
        const tag = raid && x === '악몽' ? '<small>20인</small>' : '';
        return `<button class="chip" type="button" role="radio" data-diff="${x}" aria-checked="${x === d}" aria-pressed="${x === d}"${lk.locked ? ' disabled' : ''}>${lk.locked ? '🔒 ' : ''}${x}${tag}</button>`;
      }).join('')}</div>
      <p class="note">${esc(diffNote(d, raid))}${lockOf(c, d).dev ? ` · Lv ${lockOf(c, d).lv} 해금, 개발 빌드라 열림` : ''}</p>

      <section class="panel">
        <dl class="kv">
          <div><dt>권장 레벨</dt><dd>Lv ${c.stageLv}${lvWarn ? ` <em class="warn">지금 Lv ${G.save.player.level}</em>` : ''}</dd></div>
          <div><dt>인원</dt><dd>${c.size(d)}인 (나 포함)</dd></div>
          <div><dt>권장 장비</dt><dd>${rec ? rec.label : '없음'}</dd></div>
          <div><dt>내 장비</dt><dd>${esc(gearSummary(G.save.gear.equipped))}</dd></div>
        </dl>
        ${warn ? `<p class="warnbox">⚠ 권장 장비(${rec!.label})보다 낮아요. 입장은 할 수 있어요.</p>` : ''}
      </section>

      <h3 class="sec">진행 <small>${segs.length > 1 ? '구간 사이에 휴식' : '보스 1'}</small></h3>
      <ol class="segs">${segs.map(k => `<li class="${ENCOUNTERS[k].script === 'trash' ? 'trash' : 'boss'}">${esc(ENCOUNTERS[k].name)}<small>${ENCOUNTERS[k].script === 'trash' ? '잡몹' : '보스'}</small></li>`).join('')}</ol>
      <div class="guides">${segs.map((k, i) => `<details class="gdet"${i === segs.length - 1 && segs.length === 1 ? ' open' : ''}><summary>${i + 1}. ${esc(ENCOUNTERS[k].name)} 공략</summary>${battle().guide(k, d)}</details>`).join('')}</div>

      <h3 class="sec">보상 <small>클리어하면</small></h3>
      <section class="panel reward-pre">
        <p>장비 1개 · ${table.map(([g, p]) => `<span class="gr" style="--g:${GRADE_STYLE[g].color}">${g} ${Math.round(p * 100)}%</span>`).join(' ')}</p>
        ${legendCut ? `<p class="note">전설은 Lv ${LEGEND_LEVEL}부터 나와요 (그 전엔 영웅).</p>` : ''}
        ${c.set ? `<p class="note">드롭 세트 「${esc(c.set)}」와 세트 효과는 P2에서 넣어요.</p>` : ''}
        <p>골드 ${fmt(goldA)} (S 등급 ${fmt(goldS)}) · 경험치 약 ${fmt(xpA)}</p>
      </section>
    </div>
    <footer class="ns-foot"><button class="btn primary" type="button" id="entryGo">입장 (편성으로)</button></footer>`;
}

s.el.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-diff]');
  if (b && !b.disabled) { Flow.diff = b.dataset.diff as DiffName; render(); return; }
  if ((e.target as HTMLElement).closest('#entryGo')) { Flow.party = null; Flow.rerolls = 0; go('s-party'); }
});
