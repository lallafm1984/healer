/** S21 설정 (09). 바꾸면 바로 저장하고 전투 화면에도 넘김. 칸 탭 기본 힐·스킬 배치(S17)는 캐릭터 → 스킬로 옮김 */
import { commit, G, heroNow, resetSave } from '../game/state';
import { TUT } from '../game/tutorial';
import { battle, go, previous, screen, topBar } from './kit';

let back = 's-lobby';
let confirmReset = false;

const s = screen('s-settings', '설정', {
  enter() {
    if (previous && previous !== 's-settings') back = previous;
    confirmReset = false;
    render();
  },
});

/** 지금 설정을 전투 화면에 넘김 (처음 켤 때도). 전투 중 일시정지에서 바꾼 것은 받아서 저장 */
export function pushSettings(): void {
  const b = battle();
  b.settings({ ...G.save.settings, hero: heroNow() });
  b.onSetting = (k, v) => { (G.save.settings as unknown as Record<string, unknown>)[k] = v; commit(); };
}

function render(): void {
  const st = G.save.settings;
  const chip = (name: string, val: string, cur: string, label: string) => `<button class="chip" type="button" data-set="${name}" data-val="${val}" aria-pressed="${cur === val}">${label}</button>`;
  const tog = (name: string, label: string) => `<label class="toggle"><input type="checkbox" data-tog="${name}"${(st as unknown as Record<string, boolean>)[name] ? ' checked' : ''}> ${label}</label>`;
  s.el.innerHTML = `${topBar({ back, title: '설정' })}
    <div class="ns-body settings">
      <section class="group"><h2>소리·진동</h2><div class="row">${tog('sound', '소리')}${tog('vibrate', '진동')}</div></section>
      <section class="group"><h2>스킬 휠 위치</h2><div class="chips">${chip('hand', 'right', st.hand, '오른쪽 (오른손)')}${chip('hand', 'left', st.hand, '왼쪽 (왼손)')}</div>
        <button class="btn" type="button" id="toSkills">칸 탭 기본 힐 · 스킬 배치 · 단축칸 → 캐릭터</button></section>
      <section class="group"><h2>20인 판</h2>${tog('zoom', '탭한 칸 확대해 보여주기 (0.3초)')}</section>
      <section class="group dev"><h2>개발 빌드</h2>
        ${tog('auto', '자동 치유 (일시정지에서도 켜고 끔)')}
        ${tog('devUnlock', '레벨 잠금 무시 (던전·레이드)')}
        ${tog('allSkills', '스킬 전부 열기 (레벨 무관)')}
        <button class="btn" type="button" id="tutAgain">${G.save.tut < TUT.done ? '튜토리얼 건너뛰기' : '튜토리얼 다시 보기 (레벨·장비는 그대로)'}</button>
        <button class="btn" type="button" id="resetSave">${confirmReset ? '한 번 더 누르면 삭제' : '저장 지우고 처음부터'}</button>
      </section>
    </div>`;
}

function saveSettings(): void { commit(); pushSettings(); render(); }

s.el.addEventListener('click', e => {
  const t = e.target as HTMLElement;
  const c = t.closest<HTMLElement>('[data-set]');
  if (c) { (G.save.settings as unknown as Record<string, string>)[c.dataset.set!] = c.dataset.val!; saveSettings(); return; }
  if (t.closest('#toSkills')) { go('s-char', 'skill'); return; }
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
