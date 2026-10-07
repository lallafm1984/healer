/** S02 로비 (09): 레벨·골드, 다음 목표(18 3-3), 힐러, 지난 판 한마디, 「전투 시작」 */
import { contentOf } from '../data/content';
import { gearSummary } from '../data/equipment';
import { nextMilestone } from '../data/progression';
import { Flow } from '../game/flow';
import { G } from '../game/state';
import { TUT } from '../game/tutorial';
import { esc, go, screen, topBar } from './kit';
import { bellSvg } from './art';

/** 다음 목표 줄: 녹슨 요새 아직 안 깬 난이도 → 다음 레벨 마일스톤 (이 빌드에 있는 것) */
function goals(): string[] {
  const out: string[] = [];
  const rec = G.save.clears.rustfort || {};
  if (G.save.tut < TUT.done) out.push('녹슨 요새 「쉬움」 클리어 (첫 던전)');
  const diff = G.save.tut < TUT.done ? null : (['보통', '어려움', '악몽'] as const).find(d => !rec[d]);
  if (diff) out.push(`녹슨 요새 「${diff}」 클리어${diff === '어려움' ? ' (권장 장비 고급)' : diff === '악몽' ? ' (권장 장비 희귀 +5)' : ''}`);
  let lv = G.save.player.level;
  for (let i = 0; i < 20; i++) {
    const m = nextMilestone(lv);
    if (!m) break;
    const live = m.items.filter(x => x.live);
    if (live.length) { out.push(`Lv ${m.level}: ${live.map(x => x.text).join(', ')} (지금 Lv ${G.save.player.level})`); break; }
    lv = m.level;
  }
  return out;
}

const s = screen('s-lobby', '로비', {
  tab: 'battle',
  enter() {
    const p = G.save.player, last = G.save.last;
    s.el.innerHTML = `${topBar({ settings: true })}
      <div class="ns-body lobby">
        <section class="panel goal"><h2>다음 목표</h2><ul>${goals().map(g => `<li>${esc(g)}</li>`).join('')}</ul></section>
        <div class="hero">
          <div class="hero-art">${bellSvg}</div>
          <b>성기사단 사제 · Lv ${p.level}</b>
          <small>장비 ${esc(gearSummary(G.save.gear.equipped))}</small>
        </div>
        ${last ? `<p class="lastline"><span>지난 판</span> ${esc(contentOf(last.content as never).name)} ${esc(last.diff)} · ${last.win ? `클리어 ${last.grade || ''}` : '실패'}</p>` : '<p class="lastline"><span>아직 깬 던전이 없어요</span></p>'}
        ${G.save.tut === TUT.dungeon ? '<p class="coachtip">이제 첫 던전 <b>녹슨 요새</b>에 갈 차례예요. 「전투 시작」을 눌러요.</p>' : ''}
        <button class="btn primary big${G.save.tut === TUT.dungeon ? ' hi-pulse' : ''}" type="button" id="lobbyStart">전투 시작</button>
      </div>`;
    s.el.querySelector('#lobbyStart')!.addEventListener('click', () => go('s-content', Flow.content));
  },
});
