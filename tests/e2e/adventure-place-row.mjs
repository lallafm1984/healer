import { chromium } from 'playwright';
import { pastTitle, rowContentKeys, shownImagesReady } from './nav.mjs';
import { DEPARTURE_DEVICES, departureLayout, layoutIssues } from './adventure-no-scroll.mjs';

const DIFFS=['쉬움','보통','어려움','악몽'];

/**
 * 장소 줄 (2026-10-12 Lim: 팝업 없이 레벨 순으로 한 단계): 레벨이 모자란 장소는 숨기고 레벨이 되면 보임.
 * 다 잠긴 분류는 다음에 열릴 한 곳만 잠긴 채로. 개발 빌드 「레벨 잠금 무시」면 전부. 고른 장소의 난이도별 별은 난이도 칸에.
 */
export default async function adventurePlaceRow(url,shots) {
  const browser=await chromium.launch();let fails=0;const errs=[];
  const ok=(value,message,detail)=>{console.log(`${value?'PASS':'FAIL'} ${message}`);if(!value){fails++;if(detail)console.log(JSON.stringify(detail));}};
  const devices=DEPARTURE_DEVICES.filter(([id])=>['small','s25','flip-cover','fold-open'].includes(id));
  try {
    for(const [id,name,width,height] of devices) {
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true});
      try {
        const page=await context.newPage(),tag=`${name} ${width}×${height}`;
        page.on('pageerror',e=>errs.push(`${id}: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errs.push(`${id}: ${m.text()}`);});
        await page.clock.install();await page.goto(url);await page.clock.runFor(300);
        const seed=async(level,devUnlock=false,clears={})=>{
          await page.evaluate(({level,devUnlock,clears})=>{
            const s=JSON.parse(localStorage.getItem('healer.save'));
            s.tut=99;s.player.level=level;s.settings.devUnlock=devUnlock;Object.assign(s.clears,clears);
            localStorage.setItem('healer.save',JSON.stringify(s));
          },{level,devUnlock,clears});
          await page.reload();await page.clock.runFor(300);await pastTitle(page);await page.click('#tabs [data-tab="battle"]');
        };
        const rows=async()=>{
          const out={};
          for(const tab of ['explore','dungeon','raid10','raid20']) {
            await page.click(`[data-ctab="${tab}"]`);await page.clock.runFor(30);
            out[tab]={keys:await rowContentKeys(page),issues:layoutIssues(await departureLayout(page)),go:await page.isEnabled('#contentGo'),
              status:await page.locator('.b-st').count()?await page.locator('.b-st').innerText():''};
          }
          return out;
        };

        // Lv 4: 탐험 두 곳만, 나머지 분류는 다음에 열릴 한 곳만 잠긴 채로 (출전 막힘)
        await seed(4);
        let r=await rows();
        ok(r.explore.keys.join()==='plateau,scrapheap' && r.explore.go,`${tag}: Lv 4 탐험 = 녹슨 고원·고철 더미 언덕만 (Lv 7부터 숨김)`,r.explore);
        ok(r.dungeon.keys.join()==='rustfort' && !r.dungeon.go && /Lv 5에 열림/.test(r.dungeon.status)
          && r.raid10.keys.join()==='abyss1' && !r.raid10.go && r.raid20.keys.join()==='cathedral1' && !r.raid20.go,
        `${tag}: Lv 4 던전·10인·20인 = 다음에 열릴 한 곳만 잠긴 채, 출전 막힘`,{dungeon:r.dungeon,raid10:r.raid10.keys,raid20:r.raid20.keys});
        ok(Object.values(r).every(t=>!t.issues.length),`${tag}: Lv 4 네 분류 화면 경계·겹침·세로 스크롤 없음`,Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v.issues])));
        await page.click('[data-ctab="dungeon"]');await shownImagesReady(page);
        await page.screenshot({path:`${shots}/departure-row-lv4-dungeon-${id}-${width}x${height}.png`});

        // 레벨이 되면 보임: Lv 5 녹슨 요새 열림, Lv 6 녹슨 광산이 줄에 나타남
        await seed(5);r=await rows();
        ok(r.dungeon.keys.join()==='rustfort,brasspress' && r.dungeon.go,`${tag}: Lv 5 녹슨 요새 열림·출전 가능 (보충 장소 황동 압착장이 나란히, 113)`,r.dungeon);
        await seed(6);r=await rows();
        ok(r.dungeon.keys.join()==='rustfort,brasspress,mine,coolant,repairbay' && r.explore.keys.length===2,`${tag}: Lv 6 녹슨 광산이 장소 줄에 나타남 (보충 장소가 원본 옆에, 113)`,{dungeon:r.dungeon.keys,explore:r.explore.keys});

        // 개발 빌드 「레벨 잠금 무시」: 전부 보임
        await seed(4,true);r=await rows();
        ok(r.explore.keys.length===62 && r.dungeon.keys.length===51 && r.raid10.keys.length===47 && r.raid20.keys.length===31,
          `${tag}: 레벨 잠금 무시면 네 분류 장소 전부 (62·51·47·31, 113 보충 장소 1 ~ 3차 포함)`,Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v.keys.length])));

        // 고른 장소의 난이도별 별 (예전 팝업 카드의 진행도는 난이도 칸이 보여 줌)
        await seed(100,false,{rustfort:Object.fromEntries(DIFFS.map((d,stars)=>[d,{stars,grade:'A',best:30,n:1}]))});
        await page.click('[data-ctab="dungeon"]');await page.click('.b-regions [data-content="rustfort"]');await page.clock.runFor(30);
        const stars=await page.locator('[data-diff]').evaluateAll(els=>els.map(el=>el.querySelector('small [aria-hidden]')?.textContent));
        ok(stars.join()===['☆☆☆','★☆☆','★★☆','★★★'].join(),`${tag}: 난이도 칸에 그 장소 난이도별 별 0·1·2·3개`,stars);
      }catch(e){fails++;errs.push(`${id}: ${e.stack||e.message}`);console.log(`FAIL ${name}: ${e.message}`);}
      finally{await context.close();}
    }
  }finally{await browser.close();}
  return {fails,errs};
}
