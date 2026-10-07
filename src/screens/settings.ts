/** S21 설정 + S17 스킬 배치 (09). 바꾸면 바로 저장하고 전투 화면에도 넘김 */
import { PASSIVE_LEVEL, SKILL_LEVEL, SKILLS, type SkillKey } from '../data/skills';
import { commit, G, healerLevel, resetSave } from '../game/state';
import { TUT } from '../game/tutorial';
import type { TapKey } from '../platform/storage';
import { battle, esc, go, josa, previous, screen, topBar } from './kit';

let back = 's-lobby';
let pick: string | null = null;
let confirmReset = false;

const s = screen('s-settings', '설정', {
  enter() {
    if (previous && previous !== 's-settings') back = previous;
    pick = null; confirmReset = false;
    render();
  },
});

/** 지금 설정을 전투 화면에 넘김 (처음 켤 때도) */
export function pushSettings(): void { battle().settings(G.save.settings); }

function layoutNow(): Record<string, string | null> {
  const L = battle().layout;
  return L.valid(G.save.settings.layout) ? { ...G.save.settings.layout! } : { ...L.DEFAULT_LAYOUT };
}

function render(): void {
  const st = G.save.settings, L = battle().layout, lay = layoutNow(), lv = healerLevel();
  const chip = (name: string, val: string, cur: string, label: string, lock = 0) => `<button class="chip" type="button" data-set="${name}" data-val="${val}" aria-pressed="${cur === val}"${lock ? ' disabled' : ''}>${label}${lock ? ` <small>🔒 Lv ${lock}</small>` : ''}</button>`;
  const lockLv = (k: string) => (SKILL_LEVEL[k as SkillKey] > lv ? SKILL_LEVEL[k as SkillKey] : 0);
  const tapLock = lockLv(st.tapKey);
  const tog = (name: string, label: string) => `<label class="toggle"><input type="checkbox" data-tog="${name}"${(st as unknown as Record<string, boolean>)[name] ? ' checked' : ''}> ${label}</label>`;
  const changed = JSON.stringify(L.READ_ORDER.map(d => lay[d] || null)) !== JSON.stringify(L.READ_ORDER.map(d => L.DEFAULT_LAYOUT[d] || null));
  const pw = pick ? (lay[pick] ? L.label(lay[pick]!) : '빈자리') : '';
  s.el.innerHTML = `${topBar({ back, title: '설정' })}
    <div class="ns-body settings">
      <section class="group"><h2>소리·진동</h2><div class="row">${tog('sound', '소리')}${tog('vibrate', '진동')}</div></section>
      <section class="group"><h2>칸 탭 기본 힐</h2><div class="chips">${(Object.keys(battle().tapKeys) as TapKey[]).map(k => chip('tapKey', k, st.tapKey, SKILLS[k].name, lockLv(k))).join('')}</div><p class="note">${esc(battle().tapKeys[st.tapKey])}${tapLock ? ` · Lv ${tapLock} 전까진 치유로 탭해요` : ''}</p></section>
      <section class="group"><h2>스킬 휠 위치</h2><div class="chips">${chip('hand', 'right', st.hand, '오른쪽 (오른손)')}${chip('hand', 'left', st.hand, '왼쪽 (왼손)')}</div></section>
      <section class="group"><h2>스킬 배치 <small>휠 자리 = 칸에서 쓸 방향</small></h2>
        <div class="lwrap"><div class="lgrid">${L.GRID.map(d => {
          if (!d) return '<div class="lcore" aria-hidden="true">마나</div>';
          const k = lay[d];
          const lock = k ? lockLv(k) : 0;
          const sub = lock ? `🔒 Lv ${lock}` : lv < PASSIVE_LEVEL.words ? '' : k === 'heal' ? '평온' : k === 'poh' ? '신성화' : '';
          return `<button class="lslot${k ? '' : ' empty'}${lock ? ' locked' : ''}" type="button" data-ldir="${d}" aria-pressed="${pick === d}" aria-label="${L.ARROW[d]} ${k ? L.label(k) : '비어 있음'}"><span class="dir">${L.ARROW[d]}</span><b>${k ? SKILLS[k as keyof typeof SKILLS].short : '비어 있음'}</b>${sub ? `<small>${sub}</small>` : ''}</button>`;
        }).join('')}</div>
        <div class="lside"><p class="note">${pick ? `${L.ARROW[pick]} ${esc(pw)}${josa(pw, '과', '와')} 바꿀 자리를 누르세요.` : '두 자리를 차례로 누르면 서로 바뀌어요.'}</p><button class="btn" type="button" id="layReset"${changed ? '' : ' disabled'}>기본 배치로</button></div></div>
        <p class="note">${esc(L.text(lay))}</p></section>
      <section class="group"><h2>20인 판</h2>${tog('zoom', '탭한 칸 확대해 보여주기 (0.3초)')}</section>
      <section class="group dev"><h2>개발 빌드</h2>
        ${tog('auto', '자동 힐러로 구경하기')}
        ${tog('devUnlock', '레벨 잠금 무시 (던전·레이드)')}
        ${tog('allSkills', '스킬 전부 열기 (레벨 무관)')}
        <button class="btn" type="button" id="tutAgain">${G.save.tut < TUT.done ? '튜토리얼 건너뛰기' : '튜토리얼 다시 보기 (레벨·장비는 그대로)'}</button>
        <button class="btn" type="button" id="resetSave">${confirmReset ? '정말 지울까요? 한 번 더 누르면 지워요' : '저장 지우고 처음부터'}</button>
      </section>
    </div>`;
}

function saveSettings(): void { commit(); pushSettings(); render(); }

s.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const c = t.closest<HTMLElement>('[data-set]');
  if (c) { (G.save.settings as unknown as Record<string, string>)[c.dataset.set!] = c.dataset.val!; saveSettings(); return; }
  const l = t.closest<HTMLElement>('[data-ldir]');
  if (l) {
    const d = l.dataset.ldir!;
    if (!pick) pick = d;
    else if (pick === d) pick = null;
    else { const lay = layoutNow(); [lay[pick], lay[d]] = [lay[d], lay[pick]]; G.save.settings.layout = lay; pick = null; commit(); pushSettings(); }
    render(); return;
  }
  if (t.closest('#layReset')) { G.save.settings.layout = null; pick = null; saveSettings(); return; }
  if (t.closest('#tutAgain')) {
    const again = G.save.tut >= TUT.done;
    G.save.tut = again ? TUT.intro : TUT.done; commit();
    go(again ? 's-story' : 's-lobby'); return;
  }
  if (t.closest('#resetSave')) {
    if (!confirmReset) { confirmReset = true; render(); return; }
    resetSave(); pushSettings(); go('s-title');
  }
});

s.el.addEventListener('change', e => {
  const i = (e.target as HTMLElement).closest<HTMLInputElement>('[data-tog]');
  if (i) { (G.save.settings as unknown as Record<string, boolean>)[i.dataset.tog!] = i.checked; saveSettings(); }
});
