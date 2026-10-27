import { chromium } from 'playwright';
import { chooseContent, pastTitle, rowContentKeys, shownImagesReady } from './nav.mjs';

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
    const body = q('.b-body'), row = q('.b-regions');
    const scrollSelectors = ['#viewport','#app','#s-content','#s-content .b-body'];
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
    const bodyBox=box(body), rowBox=row ? box(row) : null;
    const clipped = ['.b-cats','.b-region-section','.b-difficulty','.b-chal']
      .filter(selector=>visible(q(selector)) && !(selector==='.b-chal' && headerChallenge) && !within(box(q(selector)),bodyBox));
    // 장소 줄 카드 (예전 지역 카드 모양): 이름·Lv 글자가 카드 안, 서로 안 겹침. 줄은 가로로 넘기니 카드 자체는 줄 밖일 수 있음
    const cards=row ? [...row.querySelectorAll('[data-content]')] : [];
    const glyphsOf=el=>{const range=document.createRange();range.selectNodeContents(el);return [...range.getClientRects()].filter(r=>r.width>0 && r.height>0);};
    const clippedCardText=[];
    for(const card of cards) {
      const cardBox=box(card), name=card.querySelector('.b-region-name'), tag=card.querySelector('small');
      for(const text of [name,tag]) {
        if(!visible(text)) continue;
        if(!within(box(text),cardBox) || glyphsOf(text).some(r=>!within(r,cardBox)))
          clippedCardText.push({key:card.dataset.content,element:text.className || text.tagName,text:text.textContent,card:cardBox,textBox:box(text)});
      }
      if(visible(name) && visible(tag) && glyphsOf(name).some(r=>!apart(r,box(tag))))
        clippedCardText.push({key:card.dataset.content,issue:'place name and level tag overlap',name:name.textContent});
    }
    const selectedCard=row?.querySelector('.b-region.on');
    const selectedShown=!!selectedCard && within(box(selectedCard),rowBox);
    const controls=[...root.querySelectorAll('[data-ctab],[data-diff],[data-reward-close],#contentGo')].filter(visible);
    const unsafeControls=controls.filter(el=>!within(box(el),viewport) || box(el).width<1 || box(el).height<1).map(el=>el.outerHTML.slice(0,100));
    const gate=q('.b-gate'), name=q('.b-gt'), level=q('.b-level');
    const titleOverlap=visible(gate) && visible(name) && visible(level) && !apart(box(name),box(level));
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
      scroll, missing, outside, overlaps, clipped, unsafeControls, titleOverlap, clippedCardText,rewardIssues,arrowIssues,levelIssues,nameIssues,
      cards:cards.map(el=>el.dataset.content), lvs:cards.map(el=>Number(el.querySelector('small')?.textContent.replace(/\D/g,''))),
      selected:selectedCard?.dataset.content ?? null, selectedShown, body:bodyBox, row:rowBox,
      diff:box(q('.b-difficulty')), cta:box(q('#contentGo')), tabs:box(document.querySelector('#tabs')),
    };
  });
}

export const layoutIssues = g => [
  ...g.scroll.filter(x=>x.scrollHeight>x.height+1 || x.scrollWidth>x.width+1 || Math.abs(x.top)>1).map(x=>`scroll ${x.selector} ${x.scrollWidth}x${x.scrollHeight}/${x.width}x${x.height} top=${x.top}`),
  ...g.missing.map(x=>`missing ${x}`), ...g.outside.map(x=>`outside ${x}`), ...g.overlaps.map(x=>`overlap ${x}`),
  ...g.clipped.map(x=>`clipped ${x}`), ...(g.cards.length && !g.selectedShown ? [`selected place card not shown in row (${g.selected})`] : []),
  ...g.unsafeControls.map(x=>`control ${x}`), ...(g.titleOverlap ? ['place title/level overlap'] : []),
  ...g.clippedCardText.map(x=>`card text clipped ${JSON.stringify(x)}`),
  ...g.rewardIssues, ...g.arrowIssues, ...g.levelIssues, ...g.nameIssues,
];

/** 장소 줄 (지역 팝업 없이 한 단계): 네 분류 모두 장소가 레벨 순으로 한 번씩, 화면 세로 스크롤·잘림·겹침 없음 */
export default async function adventureNoScroll(url, shots) {
  const browser = await chromium.launch();
  let fails=0;
  const errs=[];
  const ok=(value,message,detail) => { console.log(`${value?'PASS':'FAIL'} ${message}`); if (!value) { fails++; if(detail) console.log(JSON.stringify(detail)); } };
  const COUNTS={explore:65,dungeon:57,raid10:47,raid20:31}; // 113 보충 장소 탐험 15 · 던전 17
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
        const tag=`${name} ${width}×${height}`, badLayouts=[], badRows=[], allKeys=[];
        for (const tab of ['explore','dungeon','raid10','raid20']) {
          await page.click(`[data-ctab="${tab}"]`); await page.clock.runFor(30);
          const keys=await rowContentKeys(page);
          let g=await departureLayout(page);
          if(g.lvs.some((lv,i)=>i && g.lvs[i-1]>lv) || keys.length!==COUNTS[tab] || new Set(keys).size!==keys.length)
            badRows.push({tab,count:keys.length,lvs:g.lvs});
          allKeys.push(...keys);
          if(layoutIssues(g).length) badLayouts.push({tab,at:'first',issues:layoutIssues(g)});
          // 줄 끝 장소를 골라도 그 카드가 줄 안에 보이고 화면이 안 밀림
          await chooseContent(page,keys[keys.length-1]);
          g=await departureLayout(page);
          if(layoutIssues(g).length || g.selected!==keys[keys.length-1]) badLayouts.push({tab,at:'last',selected:g.selected,issues:layoutIssues(g)});
        }
        ok(!badLayouts.length,`${tag}: 네 분류 장소 줄 처음·끝에서 화면 세로 스크롤/잘림/겹침 없음`,badLayouts.slice(0,8));
        ok(!badRows.length && new Set(allKeys).size===allKeys.length,`${tag}: 네 분류 모든 장소가 장소 줄에 레벨 순으로 한 번씩 (팝업 없이)`,badRows);
        ok(await page.locator('.b-place-modal,.b-place-section,[data-current-places],[data-region]').count()===0,`${tag}: 장소 팝업·지역 단계·장소 변경 버튼 없음`);

        // 긴 10인 줄의 뒤쪽 장소와 난이도·출전은 같은 첫 화면에 유지한다.
        await page.click('[data-ctab="raid10"]'); await chooseContent(page,'isle3');
        await page.click('[data-diff="어려움"]');
        const before=await departureLayout(page);
        ok(!layoutIssues(before).length && before.selected==='isle3' && before.diff.bottom<=before.cta.top+1 && before.cta.bottom<=before.tabs.top+1,
          `${tag}: 뒤쪽 장소·난이도·출전 버튼까지 첫 화면`,layoutIssues(before));
        await shownImagesReady(page);
        await page.screenshot({path:`${shots}/departure-no-scroll-${id}-${width}x${height}.png`});
        await page.click('[data-ctab="dungeon"]'); await page.click('[data-ctab="raid10"]');
        const back=await departureLayout(page);
        ok(back.selected==='isle3' && back.selectedShown
          && await page.locator('[data-diff="어려움"]').getAttribute('aria-pressed')==='true',`${tag}: 탭 복귀 시 고른 장소가 줄에 보이고 난이도 복원`);
        // resize는 접기/펼치기의 viewport 변화를 재현한다. 실제 기기 센서는 이 범위에 포함하지 않는다.
        const alternate=height<=520?{width:360,height:880}:{width:360,height:360};
        await page.setViewportSize(alternate); await page.clock.runFor(150);
        const resized=await departureLayout(page);
        ok(!layoutIssues(resized).length && resized.selected==='isle3',`${tag}: 짧은 화면/펼침 전환에도 고른 장소 카드 노출·no-scroll`,layoutIssues(resized));
        await shownImagesReady(page);
        await page.screenshot({path:`${shots}/departure-no-scroll-${id}-${alternate.width}x${alternate.height}.png`});
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  return {fails,errs};
}
