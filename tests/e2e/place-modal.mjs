/** 열린 장소 팝업의 모든 페이지를 실제 버튼으로 탐색한다. 호출자는 팝업을 닫는다. */
export async function modalContentKeys(page) {
  const popup=page.locator('#s-content .b-place-modal');
  const previous=popup.locator('[data-place-page="-1"]'), next=popup.locator('[data-place-page="1"]');
  for(let guard=0;guard<100 && !await previous.isDisabled();guard++) {
    await previous.click(); await page.clock.runFor(10);
  }
  const keys=[];
  for(let guard=0;guard<100;guard++) {
    keys.push(...await popup.locator('[data-content]').evaluateAll(els=>els.map(el=>el.dataset.content)));
    if(await next.isDisabled()) return keys;
    await next.click(); await page.clock.runFor(10);
  }
  throw new Error('장소 팝업 페이지가 100회 안에 끝나지 않음');
}
