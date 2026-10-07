/** S04 난이도·입장 (09): 난이도 4단, 권장 레벨·장비(미달이면 경고만), 진행·보스 공략, 드롭·보상 미리보기 */
import { ALL_DIFFS, contentOf, isRaid, raidSize, stageOf } from '../data/content';
import { DIFFS, MYTHIC, type DiffName } from '../data/difficulty';
import { ENCOUNTERS, segGrade, type EncounterKey } from '../data/encounters';
import { avgScore, DROP_TABLE, gearSummary, GRADE_STYLE, ITEM_GRADES, LEGEND_LEVEL, RECOMMENDED } from '../data/equipment';
import { canDispel, DEB_COLOR, HEROES } from '../data/heroes';
import { setOf } from '../data/sets';
import { clearGold, clearXp } from '../data/progression';
import { Flow } from '../game/flow';
import { G, heroNow, lockOf, switchOpen } from '../game/state';
import { TUT } from '../game/tutorial';
import { battle, esc, fmt, go, screen, topBar } from './kit';

/** 드롭 세트 한 줄 (02 10-3): 효과가 있는 세트는 2·4세트까지 */
function setLine(key: string, name?: string): string {
  if (!name) return '';
  const d = setOf(key);
  if (!d) return `<p class="note">드롭 세트 「${esc(name)}」 (효과는 콘텐츠와 함께 추가)</p>`;
  return `<p class="note">드롭 세트 「${d.name}」 ${d.minGrade} 이상 · 2세트: ${esc(d.two.desc)} 4세트: ${esc(d.four.desc)}</p>`;
}

const s = screen('s-entry', '난이도·입장', { enter() { render(); } });

function diffNote(d: DiffName, raid: boolean): string {
  const x = DIFFS[d];
  let t = `받는 피해 ×${x.dmg} · 파티원 회피 ${Math.round(x.dodge * 100)}%`;
  if (d === '악몽') t += ` · 파티원 체력·딜 ×${MYTHIC.party} · 보스 체력 ×${MYTHIC.bossHp}${raid ? ' · 보스마다 악몽 전용 기술' : ''}`;
  return t;
}

/** 해제 줄 (25 7장): 이 콘텐츠가 거는 디버프를 지금 직업이 지울 수 있는지 */
function dispelRow(segs: EncounterKey[]): string {
  const types = [...new Set(segs.flatMap(k => ENCOUNTERS[k].debuffs || []))];
  if (!types.length) return '';
  const h = heroNow(), miss = types.filter(t => !canDispel(h, t));
  const cell = types.map(t => `<span class="dbt${canDispel(h, t) ? '' : ' no'}" style="--c:${DEB_COLOR[t] || '#888'}">${t} ${canDispel(h, t) ? '✓' : '✕'}</span>`).join(' ');
  const swap = miss.length && switchOpen().ok ? ' <button class="btn mini" type="button" data-go="s-char" data-arg="hero">직업 바꾸기</button>' : '';
  return `<div class="dispel"><dt>해제 <small>${HEROES[h].name}</small></dt><dd>${cell}${swap}</dd></div>`;
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
  const lvWarn = G.save.player.level < stageOf(c, d);
  const table = DROP_TABLE[d].map((p, i) => [ITEM_GRADES[i], p] as const).filter(([, p]) => p > 0);
  const legendCut = G.save.player.level < LEGEND_LEVEL && table.some(([g]) => g === '전설');
  const rs = raidSize(c), stage = stageOf(c, d);
  const goldA = clearGold(stage, d, 'A', rs), goldS = clearGold(stage, d, 'S', rs);
  const xpA = clearXp(G.save.player.level, stage, d, 'A', { raid: rs, win: true });

  s.el.innerHTML = `${topBar({ back: 's-content', title: `${c.name} · 단계 Lv ${stageOf(c, d)}` })}
    <div class="ns-body entry">
      <div class="chips diffs" role="radiogroup" aria-label="난이도">${ALL_DIFFS.map(x => {
        const lk = lockOf(c, x);
        return `<button class="chip" type="button" role="radio" data-diff="${x}" aria-checked="${x === d}" aria-pressed="${x === d}"${lk.locked ? ' disabled' : ''}>${lk.locked ? '🔒 ' : ''}${x}</button>`;
      }).join('')}</div>
      ${G.save.tut === TUT.dungeon && c.key === 'rustfort' ? '<p class="coachtip">처음엔 <b>쉬움</b> 추천. 깨고 나면 보통 도전. 아래 공략은 눌러서 펼침</p>' : ''}
      <p class="note">${esc(diffNote(d, raid))}${lockOf(c, d).dev ? ` · Lv ${lockOf(c, d).lv} 해금, 개발 빌드라 열림` : ''}</p>

      <section class="panel">
        <dl class="kv">
          <div><dt>권장 레벨</dt><dd>Lv ${stageOf(c, d)}${lvWarn ? ` <em class="warn">지금 Lv ${G.save.player.level}</em>` : ''}</dd></div>
          <div><dt>인원</dt><dd>${c.size(d)}인 (나 포함)</dd></div>
          <div><dt>권장 장비</dt><dd>${rec ? rec.label : '없음'}</dd></div>
          <div><dt>내 장비</dt><dd>${esc(gearSummary(G.save.gear.equipped))}</dd></div>
          ${dispelRow(segs)}
        </dl>
        ${warn ? `<p class="warnbox">⚠ 권장 장비(${rec!.label})보다 낮음. 입장은 가능</p>` : ''}
      </section>

      <h3 class="sec">진행 <small>${segs.length > 1 ? '구간 사이에 휴식' : '보스 1'}</small></h3>
      <ol class="segs">${segs.map(k => `<li class="${ENCOUNTERS[k].script === 'trash' ? 'trash' : 'boss'}${segGrade(ENCOUNTERS[k]) === '정예' ? ' elite' : ''}">${esc(ENCOUNTERS[k].name)}<small>${segGrade(ENCOUNTERS[k])}</small></li>`).join('')}</ol>
      <div class="guides">${segs.map((k, i) => `<details class="gdet"${i === segs.length - 1 && segs.length === 1 ? ' open' : ''}><summary>${i + 1}. ${esc(ENCOUNTERS[k].name)} 공략</summary>${battle().guide(k, d, stageOf(c, d), G.save.player.level)}</details>`).join('')}</div>

      <h3 class="sec">보상 <small>클리어하면</small></h3>
      <section class="panel reward-pre">
        <p>장비 1개 · ${table.map(([g, p]) => `<span class="gr" style="--g:${GRADE_STYLE[g].color}">${g} ${Math.round(p * 100)}%</span>`).join(' ')}</p>
        ${legendCut ? `<p class="note">전설은 Lv ${LEGEND_LEVEL}부터 (그 전엔 영웅)</p>` : ''}
        ${setLine(c.key, c.set)}
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
