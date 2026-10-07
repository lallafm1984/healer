/**
 * 보상형 광고 자리 (15 7장, 20 4-1: AdMob). 광고 계정을 붙이기 전이라 「광고 자리」 창을 띄우고 닫으면 보상을 줌.
 * 월정액이면 광고 없이 바로 보상 (15 5장).
 */
export const ADS_READY = false;

/** 광고를 다 보면 true. 지금은 시험 창 */
export function showRewarded(label: string, member: boolean): Promise<boolean> {
  if (member) return Promise.resolve(true);
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.className = 'admodal';
    box.innerHTML = `<div class="panel"><h3>광고 자리</h3><p class="note">AdMob 연결 전 · 시험용. 닫으면 보상</p><p>${label}</p>
      <div class="row2"><button class="btn" type="button" data-ad="no">취소</button><button class="btn primary" type="button" data-ad="ok">광고 끝 · 보상 받기</button></div></div>`;
    box.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ad]');
      if (!b) return;
      box.remove();
      resolve(b.dataset.ad === 'ok');
    });
    (document.getElementById('app') || document.body).appendChild(box);
  });
}

/** 고르기 창 (이어하기 등). 오른쪽 버튼이면 true */
export function askModal(title: string, bodyHtml: string, no: string, ok: string): Promise<boolean> {
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.className = 'admodal ask';
    box.innerHTML = `<div class="panel"><h3>${title}</h3><p>${bodyHtml}</p>
      <div class="row2"><button class="btn" type="button" data-ask="no">${no}</button><button class="btn primary" type="button" data-ask="ok">${ok}</button></div></div>`;
    box.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ask]');
      if (!b) return;
      box.remove();
      resolve(b.dataset.ask === 'ok');
    });
    (document.getElementById('app') || document.body).appendChild(box);
  });
}
