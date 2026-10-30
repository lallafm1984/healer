/**
 * S21 설정 (09). 바꾸면 바로 저장하고 전투 화면에도 넘김. 칸 탭 기본 힐·스킬 배치(S17)는 캐릭터 → 스킬로 옮김.
 * 2026-10-27 (마무리 목록 7번): 상점 · 행상인 · 임무와 같은 그림 머리 (ui-settings, Codex) + 길드 판 · 줄 (guild-hall.css). 개발 빌드 칸은 출시 때 정리하므로 옛 점선 판 그대로
 */
import { setBgmOn, setBgmVolume } from '../bgm';
import { setSfxVolume } from '../sfx';
import { MAX_LEVEL } from '../data/progression';
import { Flow } from '../game/flow';
import { commit, G, heroNow, resetSave, setTestLevelUp, setTestMaxLevel, TEST_LEVEL_STEP } from '../game/state';
import { TUT } from '../game/tutorial';
import { uiIcon } from './art';
import { battle, current, go, previous, refreshTabs, screen, topBar } from './kit';
import { noticeModal } from '../platform/ads';
import { noticeList } from '../platform/server';
import { noticesHtml } from './server-notice';
import { accountView, deleteFlow, kstText, linkGoogle, maskEmail, onAccountChange, signOutFlow } from './account';
import { lang, LANGS, setLang, t, type Lang } from '../i18n';
import './settings.css';

let back = 's-lobby';
let confirmReset = false;

const s = screen('s-settings', t('설정'), {
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
  const st = G.save.settings;
  setSfxVolume(st.sfxVol ?? 1);
  setBgmVolume(st.musicVol ?? 1);
  setBgmOn(st.music !== false);
  b.onSetting = (k, v) => { (G.save.settings as unknown as Record<string, unknown>)[k] = v; commit(); };
}

/**
 * 「계정」 판 (기획 120 9-2, Lim 「구글 계정 연결(사용자 선택)」 · 「설정에만」): 서버가 있을 때만.
 * 게스트 = 연결 버튼 + 안내, 로그인 = 계정 · 마지막 백업 · 로그아웃 · 계정 삭제. 백업 · 불러오기 버튼은 없다 (앱을 내릴 때 자동)
 */
function accountRows(): string[] {
  const a = accountView();
  if (!a.user) {
    return [`<span class="st-label">${t('구글 계정')}</span><button class="btn st-open" type="button" id="acctLink"${a.ready ? '' : ' disabled'}>${a.ready ? t('연결') : t('준비 중')}</button>`,
      `<p class="g-sub wrap st-note">${t('연결하면 앱을 끄거나 내릴 때 진행이 자동으로 백업됩니다. 연결하지 않으면 앱을 지울 때 진행도 함께 사라집니다.')}</p>`];
  }
  return [`<span class="st-label">${maskEmail(a.user.email)}</span><button class="btn st-open" type="button" id="acctOut">${t('로그아웃')}</button>`,
    `<span class="st-label">${t('마지막 백업')}</span><span class="st-value">${a.lastAt ? kstText(a.lastAt) : t('아직 없음')}</span>`,
    `<span class="st-label">${t('계정 삭제')}</span><button class="btn st-open" type="button" id="acctDel">${t('삭제')}</button>`];
}

function render(): void {
  const st = G.save.settings;
  const chip = (name: string, val: string, cur: string, label: string) => `<button class="chip" type="button" data-set="${name}" data-val="${val}" aria-pressed="${cur === val}">${label}</button>`;
  const lvLock = Flow.running || G.save.player.level >= MAX_LEVEL;
  // 크기 막대: 0이면 꺼짐 (sound · music false), 올리면 켜짐. 움직이는 동안 바로 들리고, 손을 떼면 저장
  const vol = (k: 'sfx' | 'music', label: string) => {
    const v = (k === 'sfx' ? st.sound : st.music) ? Math.round(((k === 'sfx' ? st.sfxVol : st.musicVol) ?? 1) * 100) : 0;
    return `<div class="vol-row"><label for="vol-${k}">${label}</label><input type="range" id="vol-${k}" data-vol="${k}" min="0" max="100" step="5" value="${v}" aria-valuetext="${v ? `${v}%` : t('끔')}"><output for="vol-${k}">${v ? `${v}%` : t('끔')}</output></div>`;
  };
  const tog = (name: string, label: string) => `<label class="toggle"><input type="checkbox" data-tog="${name}"${(st as unknown as Record<string, boolean>)[name] ? ' checked' : ''}> ${label}</label>`;
  // 길드 판 (guild-hall.css .g-card): 머리 = 기호 · 제목, 줄 = 그 설정 하나
  const card = (key: string, icon: Parameters<typeof uiIcon>[0], title: string, rows: string[]) =>
    `<section class="g-card st-card" data-sec="${key}"><header class="g-hd"><span class="g-hi">${uiIcon(icon)}</span><h3>${title}</h3></header><ul class="g-rows">${rows.map(r => `<li class="g-row st-row">${r}</li>`).join('')}</ul></section>`;
  // 언어 (기획 121, 2026-10-29 Lim): 칩 글은 늘 그 말로 (한국어 · English · 日本語), 고르면 바로 바뀜. 맨 위 (다른 말을 쓰는 사람이 먼저 찾는 것)
  const langChips = LANGS.map(l => `<button class="chip" type="button" data-lang="${l.key}" aria-pressed="${l.key === lang()}" lang="${l.key}">${l.name}</button>`).join('');
  s.el.innerHTML = `${topBar({ back, title: t('설정') })}
    <div class="ns-body settings">
      <header class="art-hero st-hero"><div class="ah-copy"><p class="eyebrow">${t('모험가의 책상')}</p><h2>${t('게임 설정')}</h2></div></header>
      ${card('lang', 'lang', t('언어'), [`<div class="chips st-lang">${langChips}</div>`])}
      ${card('sound', 'sound', t('소리 · 진동'), [vol('sfx', t('효과음')), vol('music', t('배경음')), tog('vibrate', t('진동'))])}
      ${card('hand', 'wheel', t('스킬 휠 위치'), [`<div class="chips st-hand">${chip('hand', 'left', st.hand, t('왼쪽 (왼손)'))}${chip('hand', 'right', st.hand, t('오른쪽 (오른손)'))}</div>`])}
      ${card('screen', 'eye', t('전투 화면'), [`<div class="st-col">${tog('reducedEffects', t('시각 효과 줄이기'))}<p class="g-sub wrap">${t('피해 숫자·흔들림·반짝임을 줄입니다. 위험·체력·해제 정보는 유지합니다.')}</p></div>`])}
      ${accountView().on ? card('account', 'char', t('계정'), accountRows()) : ''}
      ${card('info', 'info', t('공지'), [`<span class="st-label">${t('운영 공지')}</span><button class="btn st-open" type="button" id="noticeOpen">${t('보기')}</button>`])}
      <section class="group dev"><h2>${t('개발 빌드')}</h2>
        ${tog('auto', t('자동 치유 (일시정지에서도 켜고 끔)'))}
        ${tog('autoNovice', t('자동 치유를 초보처럼'))}<p>${t('처음 하는 사람처럼 늦게 고르고 가끔 옆 칸을 누르며 기믹 공략을 모릅니다. 초반 난이도를 볼 때 씁니다.')}</p>
        ${tog('devUnlock', t('레벨 잠금 무시 (던전·레이드)'))}
        ${tog('allSkills', t('스킬 전부 열기 (레벨 무관)'))}
        ${tog('devJobs', t('전 직업 선택'))}<p>${t('구매 · 레벨 조건 없이 모든 직업으로 바꿀 수 있습니다. 끄면 원래 잠금으로 돌아갑니다.')}</p>
        ${tog('devGold', t('골드 무제한'))}<p>${t('골드가 보유량과 관계없이 쓰이며 차감되지 않습니다. 끄면 실제 보유량으로 돌아옵니다.')}</p>
        ${tog('devStamina', t('휴식 무제한'))}<p>${t('클리어해도 휴식이 줄지 않고 휴식 보너스가 늘 붙습니다.')}</p>
        <div class="row dev-level">
          <button class="btn" type="button" id="devLevelUp"${lvLock ? ' disabled' : ''}>${t('레벨 +{n}', { n: TEST_LEVEL_STEP })}</button>
          <button class="btn" type="button" id="devMaxLevel"${lvLock ? ' disabled' : ''}>${G.save.player.level >= MAX_LEVEL ? t('{n}레벨 적용됨', { n: MAX_LEVEL }) : t('{n}레벨로 변경', { n: MAX_LEVEL })}</button>
        </div>
        <p id="devLevelStatus" role="status">${t('현재 Lv. {n}', { n: G.save.player.level })}${Flow.running ? ` · ${t('정산 후 변경 가능')}` : ` · ${t('장비·재화 유지')}`}</p>
        <button class="btn" type="button" id="tutAgain">${G.save.tut < TUT.done ? t('튜토리얼 건너뛰기') : t('튜토리얼 다시 보기 (레벨·장비는 그대로)')}</button>
        <button class="btn" type="button" id="resetSave">${confirmReset ? t('한 번 더 누르면 삭제') : t('저장 지우고 처음부터')}</button>
      </section>
    </div>`;
}

function saveSettings(): void { commit(); pushSettings(); render(); }

/** 크기 막대 값 → 설정 (0 = 끔) */
function applyVol(el: HTMLInputElement): void {
  const st = G.save.settings, v = Number(el.value) / 100, on = v > 0;
  if (el.dataset.vol === 'sfx') { st.sound = on; if (on) st.sfxVol = v; setSfxVolume(on ? v : 0); }
  else { st.music = on; if (on) st.musicVol = v; setBgmVolume(on ? v : 0); setBgmOn(on); }
  const text = on ? `${Math.round(v * 100)}%` : t('끔');
  el.setAttribute('aria-valuetext', text);
  const out = el.parentElement?.querySelector('output');
  if (out) out.textContent = text;
}
s.el.addEventListener('input', e => {
  const el = (e.target as HTMLElement).closest<HTMLInputElement>('input[data-vol]');
  if (el) applyVol(el);
});
s.el.addEventListener('change', e => {
  const el = (e.target as HTMLElement).closest<HTMLInputElement>('input[data-vol]');
  if (!el) return;
  applyVol(el);
  commit(); pushSettings(); // 다시 그리지 않음: 끌던 막대가 그대로 있게
});

s.el.addEventListener('click', e => {
  const el = e.target as HTMLElement;
  const c = el.closest<HTMLElement>('[data-set]');
  if (c) { (G.save.settings as unknown as Record<string, string>)[c.dataset.set!] = c.dataset.val!; saveSettings(); return; }
  const l = el.closest<HTMLElement>('[data-lang]');
  if (l) { void setLang(l.dataset.lang as Lang).then(() => { render(); refreshTabs(); }); return; }
  const lvBtn = el.closest<HTMLButtonElement>('#devLevelUp, #devMaxLevel');
  if (lvBtn) {
    const scrollTop = s.el.querySelector('.settings')?.scrollTop ?? 0;
    if (lvBtn.id === 'devLevelUp') setTestLevelUp(); else setTestMaxLevel();
    pushSettings(); render();
    s.el.querySelector('.settings')!.scrollTop = scrollTop;
    s.el.querySelector<HTMLButtonElement>(`#${lvBtn.id}:not(:disabled)`)?.focus({ preventScroll: true });
    return;
  }
  if (el.closest('#acctLink')) { void linkGoogle(); return; }
  if (el.closest('#acctOut')) { void signOutFlow(); return; }
  if (el.closest('#acctDel')) { void deleteFlow(); return; }
  if (el.closest('#noticeOpen')) { void noticeModal(t('공지'), noticesHtml(noticeList())); return; }
  if (el.closest('#tutAgain')) {
    const again = G.save.tut >= TUT.done;
    G.save.tut = again ? TUT.intro : TUT.done; commit();
    go(again ? 's-story' : 's-lobby'); return;
  }
  if (el.closest('#resetSave')) {
    if (!confirmReset) { confirmReset = true; render(); return; }
    resetSave(); pushSettings(); go('s-title');
  }
});

s.el.addEventListener('change', e => {
  const i = (e.target as HTMLElement).closest<HTMLInputElement>('[data-tog]');
  if (i) { (G.save.settings as unknown as Record<string, boolean>)[i.dataset.tog!] = i.checked; saveSettings(); }
});

onAccountChange(() => { if (current === 's-settings') render(); });
