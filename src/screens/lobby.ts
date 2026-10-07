/** S02 로비 (09): 레벨·골드, 다음 목표(18 3-3, 레이드 문 앞이면 남은 조건), 오늘의 임무, 힐러, 지난 판 한마디, 「전투 시작」 */
import { contentOf } from '../data/content';
import { gearSummary, ITEM_GRADES, SLOTS, type ItemGrade } from '../data/equipment';
import { guildCap } from '../data/guild';
import { HEROES } from '../data/heroes';
import { nextMilestone } from '../data/progression';
import { Flow } from '../game/flow';
import { G, heroNow, refreshDay } from '../game/state';
import { chestState, missionReady } from '../game/economy';
import { SHARD_MAX } from '../data/economy';
import { TUT } from '../game/tutorial';
import { esc, fmt, go, screen, topBar } from './kit';
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

/**
 * 레이드 문 (18 3-3): 레벨이 가까워지면 남은 조건을 체크 목록으로. 길드원 수는 그 전 레벨에서 둘 수 있는 최대 (6명·12명).
 * 권장 파티 전투력 줄은 17 9-3 식이 정해지면 추가
 */
const GATES: { lv: number; from: number; name: string; grade: ItemGrade }[] = [
  { lv: 35, from: 25, name: '10인 레이드 「심연의 종탑」', grade: '희귀' },
  { lv: 70, from: 55, name: '20인 레이드 「가라앉은 대성당」', grade: '영웅' },
];
function gateCard(): string {
  const lv = G.save.player.level;
  const g = GATES.find(x => lv >= x.from && lv < x.lv);
  if (!g || G.save.tut < TUT.done) return '';
  const need = guildCap(g.lv - 1).cap, have = G.save.guild.members.length;
  const gi = ITEM_GRADES.indexOf(g.grade);
  const gear = SLOTS.filter(sl => { const it = G.save.gear.equipped[sl.key]; return it && ITEM_GRADES.indexOf(it.grade) >= gi; }).length;
  const rows: [boolean, string, string][] = [
    [lv >= g.lv, `레벨 ${g.lv}`, `지금 ${lv}`],
    [have >= need, `길드원 ${need}명`, `${have} / ${need}`],
    [gear >= SLOTS.length, `힐러 장비 ${g.grade} 이상`, `${gear} / ${SLOTS.length} 부위`],
  ];
  return `<section class="panel goal gate"><h2>다음 목표 <small>${g.name} · Lv ${g.lv}</small></h2>
    <ul class="gatelist">${rows.map(([ok, k, v]) => `<li class="${ok ? 'ok' : ''}"><span>${ok ? '✔' : '○'} ${k}</span><small>${v}</small></li>`).join('')}</ul>
    <div class="gbtns"><button class="btn mini" type="button" data-go="s-guild">길드</button><button class="btn mini" type="button" data-go="s-char">장비</button></div></section>`;
}

const s = screen('s-lobby', '로비', {
  tab: 'battle',
  enter() {
    refreshDay();
    const p = G.save.player, last = G.save.last;
    const tutDone = G.save.tut >= TUT.done, d = G.save.daily, w = G.save.wallet;
    const ready = d.missions.filter(m => missionReady(m)).length + (chestState(G.save).today || chestState(G.save).banked ? 1 : 0) + G.save.weekly.missions.filter(m => missionReady(m)).length + (G.save.chalChest ? 1 : 0);
    s.el.innerHTML = `${topBar({ settings: true })}
      <div class="ns-body lobby">
        ${gateCard() || `<section class="panel goal"><h2>다음 목표</h2><ul>${goals().map(g => `<li>${esc(g)}</li>`).join('')}</ul></section>`}
        ${tutDone ? `<button class="panel mission-card" type="button" data-go="s-missions"><b>오늘의 임무 ${d.missions.filter(m => m.got).length}/${d.missions.length}</b>${ready ? `<em class="dot">받을 것 ${ready}</em>` : ''}<span>▸</span></button>
        <p class="wallet"><span>💎 ${fmt(w.crystal)}</span><span>🔔 종 조각 ${w.shards}/${SHARD_MAX}</span><span>공훈 ${fmt(w.merit)}</span></p>` : ''}
        <div class="hero">
          <div class="hero-art">${bellSvg}</div>
          <b>${HEROES[heroNow()].name} · Lv ${p.level}</b>
          <small>장비 ${esc(gearSummary(G.save.gear.equipped))}</small>
        </div>
        ${last ? `<p class="lastline"><span>지난 판</span> ${esc(contentOf(last.content as never).name)} ${esc(last.diff)} · ${last.win ? `클리어 ${last.grade || ''}` : '실패'}</p>` : '<p class="lastline"><span>아직 깬 던전 없음</span></p>'}
        ${G.save.tut === TUT.dungeon ? '<p class="coachtip">이제 첫 던전 <b>녹슨 요새</b> 차례. 「전투 시작」 누르기</p>' : ''}
        <button class="btn primary big${G.save.tut === TUT.dungeon ? ' hi-pulse' : ''}" type="button" id="lobbyStart">전투 시작</button>
      </div>`;
    s.el.querySelector('#lobbyStart')!.addEventListener('click', () => go('s-content', Flow.content));
  },
});
