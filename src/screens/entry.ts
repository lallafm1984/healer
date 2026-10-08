/** S04 난이도·입장 (09): 난이도 4단, 던전 레벨 단계 (07 3장), 권장 레벨·장비(미달이면 경고만), 진행·보스 공략, 드롭·보상 미리보기. 주간 도전은 단계·어픽스·제한시간 (13 3-2) */
import { ALL_DIFFS, contentOf, isRaid, raidSize, stageOf } from '../data/content';
import { DIFFS, MYTHIC, type DiffName } from '../data/difficulty';
import { ENCOUNTERS, segGrade, type EncounterKey } from '../data/encounters';
import { avgScore, DROP_TABLE, gearSummary, GRADE_STYLE, ITEM_GRADES, LEGEND_LEVEL, RECOMMENDED } from '../data/equipment';
import { canDispel, DEB_COLOR, HEROES } from '../data/heroes';
import { setOf } from '../data/sets';
import { clearGold, clearXp } from '../data/progression';
import { MERIT, MERIT_WEEK_CAP, SHARD_MAX } from '../data/economy';
import { Flow } from '../game/flow';
import { chalChestOf, needsShard, raidLootOpen } from '../game/economy';
import { AFFIXES, type AffixKey } from '../data/affixes';
import { CHAL } from '../data/challenge';
import { runMode, tierGate } from '../game/runmode';
import { G, heroNow, lockOf, switchOpen } from '../game/state';
import { TUT } from '../game/tutorial';
import { battle, esc, fmt, go, mmss, screen, topBar } from './kit';
import { destinationArt, LOCK } from './art';

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

/** 어픽스 목록 (07 3장, 13 3-3) */
function affixPanel(keys: AffixKey[], title: string, sub = ''): string {
  if (!keys.length) return '';
  return `<section class="panel afxlist"><h4>${title}${sub ? ` <small>${sub}</small>` : ''}</h4><ul>${keys.map(k => `<li${AFFIXES[k].good ? ' class="good"' : ''}><b>${AFFIXES[k].name}</b> ${esc(AFFIXES[k].desc)}<small>💡 ${esc(AFFIXES[k].tip)}</small></li>`).join('')}</ul></section>`;
}

function render(): void {
  if (Flow.chal) { renderChal(); return; }
  const c = contentOf(Flow.content);
  const raid = isRaid(c);
  if (lockOf(c, Flow.diff).locked) Flow.diff = '보통';
  const d = Flow.diff;
  const tutDone0 = G.save.tut >= TUT.done;
  // 던전 레벨 단계 (07 3장): 튜토리얼 뒤, 레벨이 되면 (개발 빌드는 전부)
  if (!tutDone0 || !c.tiers?.includes(Flow.tier) || !tierGate(G.save, Flow.tier).ok) Flow.tier = 0;
  const mode = runMode(G.save, c, d, { tier: Flow.tier, chal: 0 });
  const segs = c.fights(d);
  const rec = RECOMMENDED[d];
  const mine = avgScore(G.save.gear.equipped);
  const warn = rec && mine < rec.score;
  const lvWarn = G.save.player.level < mode.stage;
  const table = DROP_TABLE[d].map((p, i) => [ITEM_GRADES[i], p] as const).filter(([, p]) => p > 0);
  const legendCut = G.save.player.level < LEGEND_LEVEL && table.some(([g]) => g === '전설');
  const rs = raidSize(c), stage = mode.stage;
  const tierRow = tutDone0 && c.tiers ? `<div class="chips tiers" role="radiogroup" aria-label="레벨 단계"><button class="chip" type="button" role="radio" data-tier="0" aria-checked="${!Flow.tier}" aria-pressed="${!Flow.tier}">기본 Lv ${stageOf(c, d)}</button>${c.tiers.map(t => {
    const g = tierGate(G.save, t);
    return `<button class="chip" type="button" role="radio" data-tier="${t}" aria-checked="${t === Flow.tier}" aria-pressed="${t === Flow.tier}"${g.ok ? '' : ' disabled'}>${g.ok ? '' : LOCK}Lv ${t}</button>`;
  }).join('')}</div>` : '';
  const goldA = clearGold(stage, d, 'A', rs), goldS = clearGold(stage, d, 'S', rs);
  const xpA = clearXp(G.save.player.level, stage, d, 'A', { raid: rs, win: true });
  const tutDone = G.save.tut >= TUT.done;
  const shardOn = tutDone && needsShard(d);
  const lootDone = tutDone && !!rs && !raidLootOpen(G.save, c.key, d);

  s.el.innerHTML = `${topBar({ back: 's-content', title: `${c.name} · 단계 Lv ${stage}` })}
    <div class="ns-body entry">
      ${destinationArt(c.key) ? `<div class="entry-cover"><img src="${destinationArt(c.key)}" alt="녹슨 요새 입구" width="1536" height="1024"><div><p class="eyebrow">${esc(c.place)}</p><h2>${esc(c.name)}</h2><span>${c.size(d)}인 파티 · 보스 ${c.bosses.length}</span></div></div>` : ''}
      <div class="chips diffs" role="radiogroup" aria-label="난이도">${ALL_DIFFS.map(x => {
        const lk = lockOf(c, x);
        return `<button class="chip" type="button" role="radio" data-diff="${x}" aria-checked="${x === d}" aria-pressed="${x === d}"${lk.locked ? ' disabled' : ''}>${lk.locked ? LOCK : ''}${x}</button>`;
      }).join('')}</div>
      ${G.save.tut === TUT.dungeon && c.key === 'rustfort' ? '<p class="coachtip">처음엔 <b>쉬움</b> 추천. 깨고 나면 보통 도전. 아래 공략은 눌러서 펼침</p>' : ''}
      <p class="note">${esc(diffNote(d, raid))}${lockOf(c, d).dev ? ` · Lv ${lockOf(c, d).lv} 해금, 개발 빌드라 열림` : ''}</p>
      ${tierRow}
      ${Flow.tier ? `<p class="note">레벨 단계 Lv ${Flow.tier}: 적 체력·피해·보상이 Lv ${Flow.tier} 기준${tierGate(G.save, Flow.tier).dev ? ' · 개발 빌드라 열림' : ''}</p>` : ''}
      ${affixPanel(mode.affixes, '어픽스')}

      <section class="panel">
        <dl class="kv">
          <div><dt>권장 레벨</dt><dd>Lv ${stage}${lvWarn ? ` <em class="warn">지금 Lv ${G.save.player.level}</em>` : ''}</dd></div>
          <div><dt>인원</dt><dd>${c.size(d)}인 (나 포함)</dd></div>
          <div><dt>권장 장비</dt><dd>${rec ? rec.label : '없음'}</dd></div>
          <div><dt>내 장비</dt><dd>${esc(gearSummary(G.save.gear.equipped))}</dd></div>
          ${dispelRow(segs)}
        </dl>
        ${warn ? `<p class="warnbox${shardOn ? ' strong' : ''}">⚠ 권장 장비(${rec!.label})보다 낮음. 입장은 가능</p>` : ''}
        ${shardOn ? `<p class="warnbox">🔔 출발할 때 종 조각 1개 소모 · 보유 ${G.save.wallet.shards}/${SHARD_MAX}${G.save.wallet.shards ? ' (져도 안 돌아옴)' : ' · 없음: 상점에서 제작 또는 주간 임무'}</p>` : ''}
        ${lootDone ? '<p class="note">이번 주 이 보스·난이도 장비는 이미 받음 · 골드·공훈만 (월요일 오전 6시에 다시)</p>' : ''}
      </section>

      <h3 class="sec">진행 <small>${segs.length > 1 ? '구간 사이에 휴식' : '보스 1'}</small></h3>
      <ol class="segs">${segs.map(k => `<li class="${ENCOUNTERS[k].script === 'trash' ? 'trash' : 'boss'}${segGrade(ENCOUNTERS[k]) === '정예' ? ' elite' : ''}">${esc(ENCOUNTERS[k].name)}<small>${segGrade(ENCOUNTERS[k])}</small></li>`).join('')}</ol>
      <div class="guides">${segs.map((k, i) => `<details class="gdet"${i === segs.length - 1 && segs.length === 1 ? ' open' : ''}><summary>${i + 1}. ${esc(ENCOUNTERS[k].name)} 공략</summary>${battle().guide(k, d, stage, G.save.player.level)}</details>`).join('')}</div>

      <h3 class="sec">보상 <small>클리어하면</small></h3>
      <section class="panel reward-pre">
        <p>장비 1개 · ${table.map(([g, p]) => `<span class="gr" style="--g:${GRADE_STYLE[g].color}">${g} ${Math.round(p * 100)}%</span>`).join(' ')}</p>
        ${legendCut ? `<p class="note">전설은 Lv ${LEGEND_LEVEL}부터 (그 전엔 영웅)</p>` : ''}
        ${setLine(c.key, c.set)}
        <p>골드 ${fmt(goldA)} (S 등급 ${fmt(goldS)}) · 경험치 약 ${fmt(xpA)}${rs && tutDone ? ` · 공훈 ${MERIT[rs][d]} (이번 주 ${G.save.weekly.merit[rs]}/${MERIT_WEEK_CAP})` : ''}</p>
      </section>
    </div>
    <footer class="ns-foot"><button class="btn primary" type="button" id="entryGo">입장 (편성으로)</button></footer>`;
}

/** 주간 도전 (13 3-2): 단계 고르기, 이번 주 어픽스, 제한시간, 월요일 상자 */
function renderChal(): void {
  const c = contentOf(Flow.content), d = Flow.diff, open = G.save.chalOpen;
  Flow.chal = Math.max(1, Math.min(open, CHAL.max, Flow.chal));
  const m = runMode(G.save, c, d, { tier: 0, chal: Flow.chal });
  const segs = c.fights(d), best = G.save.weekly.chalBest, bm = m.bossMult!;
  const festival = m.affixes.includes('festival');
  const gold = Math.round(clearGold(m.stage, d, 'A') * (festival ? CHAL.festivalGold : 1));
  const xp = clearXp(G.save.player.level, m.stage, d, 'A', { win: true });
  const box = best ? chalChestOf(best) : null;
  s.el.innerHTML = `${topBar({ back: 's-content', title: `주간 도전 · ${CHAL.name}` })}
    <div class="ns-body entry">
      <div class="chalstep"><button class="btn" type="button" data-cstep="-1"${Flow.chal <= 1 ? ' disabled' : ''}>−</button><b>${Flow.chal}단계</b><button class="btn" type="button" data-cstep="1"${Flow.chal >= open ? ' disabled' : ''}>+</button></div>
      <p class="note center">열린 단계 ${open}/${CHAL.max} · 이번 주 최고 ${best ? `${best}단계` : '없음'}</p>
      <section class="panel">
        <dl class="kv">
          <div><dt>던전</dt><dd>${esc(c.name)} ${d} · ${c.size(d)}인</dd></div>
          <div><dt>단계 레벨</dt><dd>Lv ${m.stage} (내 레벨 기준)</dd></div>
          <div><dt>제한시간</dt><dd>${mmss(m.limit!)} <small>(휴식 뺀 전투 시간 합)</small></dd></div>
          <div><dt>보스·적</dt><dd>체력 +${Math.round((bm.hp - 1) * 100)}% · 피해 +${Math.round((bm.dmg - 1) * 100)}%</dd></div>
          <div><dt>내 장비</dt><dd>${esc(gearSummary(G.save.gear.equipped))}</dd></div>
          ${dispelRow(segs)}
        </dl>
      </section>
      ${affixPanel(m.affixes, '이번 주 어픽스', '월요일 오전 6시에 바뀜')}
      <section class="panel"><h4>규칙</h4><ul class="rules"><li>제한시간 안에 깨면 다음 단계 열림</li><li>실패해도 단계 유지 · 종 조각 소모 없음</li><li>광고 이어하기 없음</li></ul></section>
      <h3 class="sec">진행</h3>
      <ol class="segs">${segs.map(k => `<li class="${ENCOUNTERS[k].script === 'trash' ? 'trash' : 'boss'}${segGrade(ENCOUNTERS[k]) === '정예' ? ' elite' : ''}">${esc(ENCOUNTERS[k].name)}<small>${segGrade(ENCOUNTERS[k])}</small></li>`).join('')}</ol>
      <h3 class="sec">보상</h3>
      <section class="panel reward-pre">
        <p>판마다: 장비 1개 · 골드 ${fmt(gold)}${festival ? ' (축제 주간 +20%)' : ''} · 경험치 약 ${fmt(xp)}</p>
        <p>월요일 도전 상자: 이번 주 최고 단계 기준 · 5단계 희귀 · 10단계 영웅 · 15단계 영웅 2개 · 20단계 전설 확률</p>
        ${box ? `<p class="note">지금 기록이면 ${box.grades.join(' · ')}${box.legend ? ' · 전설 확률' : ''}</p>` : ''}
      </section>
    </div>
    <footer class="ns-foot"><button class="btn primary" type="button" id="entryGo">입장 (편성으로)</button></footer>`;
}

s.el.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-diff]');
  if (b && !b.disabled) { Flow.diff = b.dataset.diff as DiffName; render(); return; }
  const tb = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-tier]');
  if (tb && !tb.disabled) { Flow.tier = Number(tb.dataset.tier); render(); return; }
  const cs = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-cstep]');
  if (cs && !cs.disabled) { Flow.chal += Number(cs.dataset.cstep); render(); return; }
  if ((e.target as HTMLElement).closest('#entryGo')) { Flow.party = null; Flow.rerolls = 0; go('s-party'); }
});
