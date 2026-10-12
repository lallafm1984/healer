import { chromium } from 'playwright';
import { chooseContent, pastTitle } from './nav.mjs';

/** CSS viewport 기준. 실기기 설치·펼침 센서 검증과는 별도의 브라우저 회귀 검사다. */
export const DEPARTURE_DEVICES = [
  ['small', '작은 화면', 320, 640],
  ['s25', 'Galaxy S25', 360, 780],
  ['flip-open', 'Z Flip 펼침', 360, 880],
  ['flip-cover', 'Z Flip 커버/짧은 화면', 360, 360],
  ['fold-cover', 'Z Fold 커버', 344, 882],
  ['fold-open', 'Z Fold 펼침', 690, 829],
  ['fold-open-wide', 'Z Fold 펼침 넓은 비율', 768, 884],
];

/** overflow:hidden으로 잘린 경우도 실패: 크기뿐 아니라 핵심 요소의 실제 경계를 함께 확인한다. */
export async function departureLayout(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#s-content');
    const q = s => root.querySelector(s);
    const box = el => { const r = el.getBoundingClientRect(); return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height }; };
    const visible = el => !!el && !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
    const within = (a,b) => a.left >= b.left-1 && a.top >= b.top-1 && a.right <= b.right+1 && a.bottom <= b.bottom+1;
    const apart = (a,b) => a.right <= b.left+1 || a.left >= b.right-1 || a.bottom <= b.top+1 || a.top >= b.bottom-1;
    const viewport = { left:0, top:0, right:innerWidth, bottom:innerHeight };
    const body = q('.b-body'), list = q('.b-plr'), modal=q('.b-place-modal'), section=q('.b-place-section');
    const scrollSelectors = ['#viewport','#app','#s-content','#s-content .b-body',
      ...(modal ? ['#s-content .b-place-modalwrap','#s-content .b-place-modal','#s-content .b-plr'] : [])];
    const scroll = scrollSelectors.map(selector => {
      const el = document.querySelector(selector);
      return { selector, height:el.clientHeight, scrollHeight:el.scrollHeight, top:el.scrollTop,
        width:el.clientWidth, scrollWidth:el.scrollWidth };
    });
    const coreSelectors = [...(innerHeight>520?['.topbar']:[]),'.b-cats','.b-region-section','.b-difficulty','#contentGo'];
    const missing = coreSelectors.filter(selector => !visible(q(selector)));
    const blocks = [...new Set([...coreSelectors,'.topbar','.b-gate','.b-chal'])].map(selector => ({selector,el:q(selector)}))
      .filter(x => visible(x.el)).map(x=>({selector:x.selector,rect:box(x.el)}));
    blocks.push({selector:'#tabs',rect:box(document.querySelector('#tabs'))});
    const outside = blocks.filter(x => !within(x.rect,viewport)).map(x=>x.selector);
    const chal=q('.b-chal'), header=q('.topbar');
    const headerChallenge=innerHeight<=520 && visible(chal) && within(box(chal),box(header));
    const overlaps = blocks.flatMap((x,i)=>blocks.slice(i+1)
      .filter(y=>!(headerChallenge && [x.selector,y.selector].includes('.topbar') && [x.selector,y.selector].includes('.b-chal')))
      .filter(y=>!apart(x.rect,y.rect)).map(y=>`${x.selector}/${y.selector}`));
    if(headerChallenge) for(const el of header.querySelectorAll('.tb-pf,.tb-nm,.tb-wal,.tb-set'))
      if(visible(el) && !apart(box(chal),box(el))) overlaps.push(`.b-chal/${el.className}`);
    const bodyBox=box(body), listBox=list ? box(list) : null;
    const clipped = ['.b-cats','.b-region-section','.b-difficulty','.b-chal']
      .filter(selector=>visible(q(selector)) && !(selector==='.b-chal' && headerChallenge) && !within(box(q(selector)),bodyBox));
    const cards=list ? [...list.querySelectorAll('[data-content]')] : [];
    const clippedCardText=[];
    for(const card of cards) for(const text of card.querySelectorAll('.b-place-copy,.b-place-copy b,.b-place-copy small,.b-place-progress,.b-place-result,.b-place-result small,.b-place-result-stars')) {
      if(!visible(text)) continue;
      const cardBox=box(card), textBox=box(text), range=document.createRange();range.selectNodeContents(text);
      const glyphRects=[...range.getClientRects()].filter(r=>r.width>0 && r.height>0);
      if(!within(textBox,cardBox) || glyphRects.some(r=>!within(r,cardBox)))
        clippedCardText.push({key:card.dataset.content,element:text.className || text.tagName,text:text.textContent,card:cardBox,textBox,
          glyphs:glyphRects.map(r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom}))});
      const cell=text.closest('.b-place-result');
      if(cell && text!==cell && (!within(textBox,box(cell)) || glyphRects.some(r=>!within(r,box(cell)))))
        clippedCardText.push({key:card.dataset.content,element:text.className || text.tagName,text:text.textContent,cell:cell.dataset.clearDiff,issue:'progress text outside difficulty cell'});
      const visual=text.closest('.b-place-visual');
      if(visual && (!within(textBox,box(visual)) || glyphRects.some(r=>!within(r,box(visual)))))
        clippedCardText.push({key:card.dataset.content,element:text.className || text.tagName,text:text.textContent,issue:'title or level text outside scene preview'});
    }
    for(const card of cards) {
      const visual=card.querySelector('.b-place-visual'),progress=card.querySelector('.b-place-progress');
      const title=card.querySelector('.b-place-copy b'),placeLevel=card.querySelector('.b-place-copy small');
      if(visible(visual) && !within(box(visual),box(card)))
        clippedCardText.push({key:card.dataset.content,issue:'scene preview outside place card'});
      if(visible(title) && visible(placeLevel) && !apart(box(title),box(placeLevel)))
        clippedCardText.push({key:card.dataset.content,issue:'place title and recommended-level labels overlap',title:box(title),level:box(placeLevel)});
      if(visible(visual) && visible(progress) && !apart(box(visual),box(progress)))
        clippedCardText.push({key:card.dataset.content,issue:'scene preview overlaps difficulty progress'});
    }
    const controls=[...root.querySelectorAll('[data-ctab],[data-diff],[data-place-page],[data-reward-close],#contentGo')].filter(visible);
    const unsafeControls=controls.filter(el=>!within(box(el),viewport) || box(el).width<1 || box(el).height<1).map(el=>el.outerHTML.slice(0,100));
    const gate=q('.b-gate'), name=q('.b-gt'), level=q('.b-level');
    const titleOverlap=visible(gate) && visible(name) && visible(level) && !apart(box(name),box(level));
    const tabBar=box(document.querySelector('#tabs'));
    const modalClipped=modal ? [...modal.querySelectorAll('.b-place-section,[data-place-close],[data-place-page],[data-content]')]
      .filter(visible).filter(el=>!within(box(el),box(modal)) || !within(box(el),viewport) || box(el).bottom>tabBar.top+1).map(el=>el.dataset.content || el.className) : [];
    const modalOutside=modal && (!within(box(modal),viewport) || box(modal).bottom>tabBar.top+1);
    const rewardIssues=[],arrowIssues=[],levelIssues=[],nameIssues=[];
    if(visible(gate) && visible(name)) {
      const n=box(name),g=box(gate);
      if(!within(n,g))nameIssues.push('main place title outside scene');
      if(Math.abs((n.left+n.right)/2-(g.left+g.right)/2)>1)nameIssues.push('main place title not horizontal center');
      if(innerHeight>520 && Math.abs((n.top+n.bottom)/2-(g.top+g.bottom)/2)>1)nameIssues.push('main place title not vertical center');
      const titleGlyphs=[];
      for(const text of name.querySelectorAll('b'))if(visible(text)) {
        const range=document.createRange();range.selectNodeContents(text);
        const glyphs=[...range.getClientRects()].filter(r=>r.width>0 && r.height>0);
        titleGlyphs.push(...glyphs);
        // 글꼴 glyph는 overflow:visible line box보다 높을 수 있다. 실제 clip 조상과 장면 경계를 검사한다.
        const clips=[];
        for(let el=text;el && el!==gate;el=el.parentElement) {
          const s=getComputedStyle(el);
          if(['hidden','clip','auto','scroll'].includes(s.overflowX) || ['hidden','clip','auto','scroll'].includes(s.overflowY))clips.push(el);
        }
        if(glyphs.some(r=>!within(r,g) || r.left<n.left-1 || r.right>n.right+1 || clips.some(el=>!within(r,box(el)))))
          nameIssues.push(`main place title clipped: ${text.textContent}`);
        if(getComputedStyle(text).textOverflow==='ellipsis')nameIssues.push('main place title ellipsis');
      }
      for(const selector of ['.b-current-places','.b-st','.b-arw.prev','.b-arw.next','.b-level','.b-scene-rewards-heading','.b-scene-reward-list']) {
        const el=q(selector);
        if(visible(el) && (!apart(n,box(el)) || titleGlyphs.some(r=>!apart(r,box(el)))))nameIssues.push(`main place title/${selector} overlap`);
      }
    }
    if(visible(gate) && visible(level)) {
      if(!within(box(level),box(gate)))levelIssues.push('recommended level outside scene');
      if(box(level).top>box(gate).top+12 || box(level).right<box(gate).right-12)levelIssues.push('recommended level not top-right corner');
    }
    const rewards=q('.b-scene-rewards'),rewardList=q('.b-scene-reward-list');
    if(visible(rewards)) {
      if(!visible(gate) || !within(box(rewards),box(gate)))rewardIssues.push('rewards outside scene');
      if(!within(box(rewardList),viewport) || rewardList.scrollHeight>rewardList.clientHeight+1)rewardIssues.push('reward strip outside viewport or vertical scroll');
      const icons=[...rewards.querySelectorAll('[data-reward]')].filter(visible);
      if(!icons.length)rewardIssues.push('no reward icons');
      for(const [i,icon] of icons.entries()) {
        if(box(icon).top<box(rewardList).top-1 || box(icon).bottom>box(rewardList).bottom+1)rewardIssues.push(`${icon.dataset.reward} vertically clipped`);
        for(const other of icons.slice(i+1))if(!apart(box(icon),box(other)))rewardIssues.push(`${icon.dataset.reward}/${other.dataset.reward} overlap`);
      }
      for(const part of [...rewards.querySelectorAll('.b-scene-rewards-heading,.b-scene-reward-list,.b-lootrow')].filter(visible)) {
        if(!within(box(part),box(gate)))rewardIssues.push(`${part.className} outside scene`);
        for(const selector of ['.b-gt','.b-level','.b-current-places','.b-st','.b-arw.prev','.b-arw.next']) {
          const el=q(selector);
          if(visible(el) && !apart(box(part),box(el)))rewardIssues.push(`${part.className}/${selector} overlap`);
        }
      }
    }
    for(const arrow of [...root.querySelectorAll('.b-arw')].filter(visible)) {
      if(!within(box(arrow),box(gate)))arrowIssues.push(`${arrow.dataset.step} outside scene`);
      if(box(arrow).width<44-1 || box(arrow).height<44-1)arrowIssues.push(`${arrow.dataset.step} smaller than 44px`);
      if(Math.abs((box(arrow).top+box(arrow).bottom)/2-(box(gate).top+box(gate).bottom)/2)>1)arrowIssues.push(`${arrow.dataset.step} not scene center`);
    }
    return {
      scroll, missing, outside, overlaps, clipped, unsafeControls, titleOverlap, modalClipped, modalOutside, clippedCardText,rewardIssues,arrowIssues,levelIssues,nameIssues,
      clippedCards:cards.filter(el=>!within(box(el),listBox)).map(el=>el.dataset.content),
      page:section ? Number(section.dataset.page) : null, pages:section ? Number(section.dataset.pages) : null,
      pageSize:section ? Number(section.dataset.pageSize) : null, total:section ? Number(section.dataset.total) : null,
      cards:cards.map(el=>el.dataset.content), body:bodyBox, list:listBox,
      diff:box(q('.b-difficulty')), cta:box(q('#contentGo')), tabs:box(document.querySelector('#tabs')),
    };
  });
}

export const layoutIssues = g => [
  ...g.scroll.filter(x=>x.scrollHeight>x.height+1 || x.scrollWidth>x.width+1 || Math.abs(x.top)>1).map(x=>`scroll ${x.selector} ${x.scrollWidth}x${x.scrollHeight}/${x.width}x${x.height} top=${x.top}`),
  ...g.missing.map(x=>`missing ${x}`), ...g.outside.map(x=>`outside ${x}`), ...g.overlaps.map(x=>`overlap ${x}`),
  ...g.clipped.map(x=>`clipped ${x}`), ...g.clippedCards.map(x=>`card clipped ${x}`),
  ...g.unsafeControls.map(x=>`control ${x}`), ...(g.titleOverlap ? ['place title/level overlap'] : []),
  ...g.modalClipped.map(x=>`modal clipped ${x}`), ...(g.modalOutside ? ['modal outside viewport'] : []),
  ...g.clippedCardText.map(x=>`card text clipped ${JSON.stringify(x)}`),
  ...g.rewardIssues, ...g.arrowIssues, ...g.levelIssues, ...g.nameIssues,
];

async function openCurrentPlaces(page) {
  const current=page.locator('[data-current-places]');
  if(await current.isVisible()) await current.click();
  else await page.locator('.b-region.on').click();
}

/** 모든 지역·모든 장소 페이지가 화면 안에 있고 각 장소가 정확히 한 번 나타나는지 확인한다. */
export default async function adventureNoScroll(url, shots) {
  const browser = await chromium.launch();
  let fails=0;
  const errs=[];
  const ok=(value,message,detail) => { console.log(`${value?'PASS':'FAIL'} ${message}`); if (!value) { fails++; if(detail) console.log(JSON.stringify(detail)); } };
  try {
    for (const [id,name,width,height] of DEPARTURE_DEVICES) {
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true});
      try {
        const page=await context.newPage();
        page.on('pageerror',e=>errs.push(`${id}: ${e.message}`));
        page.on('console',m=>{if(m.type()==='error') errs.push(`${id}: ${m.text()}`);});
        await page.clock.install();
        await page.goto(url); await page.clock.runFor(300);
        await page.evaluate(()=>{
          const s=JSON.parse(localStorage.getItem('healer.save'));
          s.tut=99; s.player.level=100; s.settings.devUnlock=false;
          s.clears.rustfort={'쉬움':{stars:3,grade:'S',best:30,n:1}};
          localStorage.setItem('healer.save',JSON.stringify(s));
        });
        await page.reload(); await page.clock.runFor(300); await pastTitle(page);
        await page.click('#tabs [data-tab="battle"]');
        await page.evaluate(()=>document.fonts.ready);
        const tag=`${name} ${width}×${height}`, badLayouts=[], badPages=[], allKeys=[], tabCounts={}, badPreview=[];
        let regionCount=0, pageCount=0, fullSmallPageCaptured=false;
        for (const tab of ['explore','dungeon','raid10','raid20']) {
          await page.click(`[data-ctab="${tab}"]`); await page.clock.runFor(30);
          const regions=await page.locator('[data-region]').evaluateAll(els=>els.map(el=>el.dataset.region));
          tabCounts[tab]=0;
          for (const region of regions) {
            regionCount++;
            const beforePreview=await page.locator('#contentGo').innerText();
            await page.click(`[data-region="${region}"]`); await page.clock.runFor(30);
            // 지역별 선택 기억 때문에 첫 페이지가 아닐 수도 있으므로 명시적으로 처음으로.
            for(let guard=0;guard<100 && !await page.locator('[data-place-page="-1"]').isDisabled();guard++) {
              await page.click('[data-place-page="-1"]'); await page.clock.runFor(10);
            }
            const seen=[], declared=Number(await page.locator('.b-place-section').getAttribute('data-total'));
            let expectedPage=1;
            for(let guard=0;guard<100;guard++) {
              const g=await departureLayout(page), issues=layoutIssues(g);
              if(width===320 && g.cards.length===g.pageSize && g.cards.length>=4 && !fullSmallPageCaptured) {
                await page.locator('.b-place-modal img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));
                await page.screenshot({path:`${shots}/departure-place-progress-full-page-small-320x640.png`});
                fullSmallPageCaptured=true;
              }
              pageCount++; seen.push(...g.cards);
              if(issues.length) badLayouts.push({tab,region,page:g.page,issues});
              if(g.page!==expectedPage || g.pageSize<1 || !g.cards.length || g.cards.length>g.pageSize
                || g.pages!==Math.ceil(g.total/g.pageSize) || g.total!==declared)
                badPages.push({tab,region,expectedPage,page:g.page,pages:g.pages,pageSize:g.pageSize,total:g.total,cards:g.cards});
              if(await page.locator('[data-place-page="1"]').isDisabled()) break;
              await page.click('[data-place-page="1"]'); await page.clock.runFor(10); expectedPage++;
            }
            if(seen.length!==declared || new Set(seen).size!==declared) badPages.push({tab,region,declared,seen});
            allKeys.push(...seen); tabCounts[tab]+=seen.length;
            await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
            if(!await page.evaluate(()=>!!document.activeElement.closest('.b-place-modal'))) badPreview.push({tab,region,issue:'focus escaped'});
            await page.keyboard.press('Escape'); await page.clock.runFor(10);
            if(await page.locator('.b-place-modal').count() || await page.locator('#contentGo').innerText()!==beforePreview)
              badPreview.push({tab,region,issue:'preview changed main selection or failed to close'});
          }
        }
        ok(!badLayouts.length,`${tag}: 모든 ${pageCount}개 장소 페이지에서 화면·목록 세로 스크롤/잘림/겹침 없음`,badLayouts.slice(0,12));
        ok(!badPages.length && new Set(allKeys).size===allKeys.length && tabCounts.raid10===47 && tabCounts.raid20===31,
          `${tag}: ${regionCount}개 지역의 모든 장소를 페이지로 접근, 중복·누락 없음`,{badPages:badPages.slice(0,6),tabCounts});
        ok(!badPreview.length,`${tag}: 모든 지역 미리보기의 포커스 제한·Esc닫기·기존 출전 선택 유지`,badPreview.slice(0,8));

        // 긴 10인 지역의 마지막 장소와 난이도·출전은 같은 첫 화면에 유지한다.
        await page.click('[data-ctab="raid10"]'); await chooseContent(page,'isle3');
        await page.click('[data-diff="어려움"]');
        ok(await page.locator('.b-place-modal,.b-place-section').count()===0,`${tag}: 장소 선택 즉시 팝업 닫힘·메인에 하위 장소 목록 없음`);
        await openCurrentPlaces(page);
        const rememberedPage=await page.locator('.b-place-section').getAttribute('data-page');
        await page.locator('.b-place-modal img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));
        await page.screenshot({path:`${shots}/departure-place-modal-original-${id}-${width}x${height}.png`});
        await page.keyboard.press('Escape');
        const before=await departureLayout(page);
        ok(!layoutIssues(before).length && before.diff.bottom<=before.cta.top+1 && before.cta.bottom<=before.tabs.top+1,
          `${tag}: 마지막 장소·난이도·출전 버튼까지 첫 화면`,layoutIssues(before));
        await page.locator('#s-content img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));
        await page.screenshot({path:`${shots}/departure-no-scroll-${id}-${width}x${height}.png`});
        await page.click('[data-ctab="dungeon"]'); await page.click('[data-ctab="raid10"]');
        await openCurrentPlaces(page);
        ok(await page.locator('.b-place-section').getAttribute('data-page')===rememberedPage
          && await page.locator('[data-content="isle3"]').getAttribute('aria-pressed')==='true'
          && await page.locator('[data-diff="어려움"]').getAttribute('aria-pressed')==='true',`${tag}: 탭 복귀 시 선택 장소의 페이지·난이도 복원`);
        // resize는 접기/펼치기의 viewport 변화를 재현한다. 실제 기기 센서는 이 범위에 포함하지 않는다.
        const alternate=height<=520?{width:360,height:880}:{width:360,height:360};
        await page.setViewportSize(alternate); await page.clock.runFor(150);
        const resized=await departureLayout(page);
        ok(!layoutIssues(resized).length && resized.cards.includes('isle3')
          && await page.locator('[data-content="isle3"]').getAttribute('aria-pressed')==='true',`${tag}: 짧은 화면/펼침 전환에도 선택 장소 노출·no-scroll`,layoutIssues(resized));
        await page.locator('.b-place-modal img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));
        await page.screenshot({path:`${shots}/departure-place-modal-${id}-${alternate.width}x${alternate.height}.png`});
        await page.keyboard.press('Escape');
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  return {fails,errs};
}
