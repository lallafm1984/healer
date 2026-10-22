// Local mission redesign: actual data, tabs, responsive layout and existing actions.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pastTitle } from './nav.mjs';
export default async function missionsUI(url, shots) {
  mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch(), errs = [], checks = [];
  const ok = (pass, message, details) => { checks.push({ pass: !!pass, message, details }); console.log(`${pass ? 'PASS' : 'FAIL'} ${message}`); };
  for (const [width, height] of [[320,640],[360,740],[390,844],[430,932]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if(m.type() === 'error') errs.push(m.text()); });
    await page.clock.install({ time: new Date(2026,9,22,12) });
    await page.goto(url); await page.clock.runFor(300); await pastTitle(page);
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.player.level = 40; s.player.gold = 2000; s.daily.day = ''; s.weekly.week = ''; localStorage.setItem('healer.save', JSON.stringify(s)); });
    await page.reload(); await page.clock.runFor(300); await pastTitle(page);
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('healer.save')); s.daily.missions = [{key:'clear3',n:3,got:false},{key:'dispel10',n:6,got:false},{key:'nodeath',n:1,got:true},{key:'mana20',n:0,got:false},{key:'sell2',n:1,got:false}]; localStorage.setItem('healer.save', JSON.stringify(s)); });
    await page.reload(); await page.clock.runFor(300); await pastTitle(page);
    await page.screenshot({path:`${shots}/local-lobby-${width}.png`});
    await page.click('#s-lobby .lb-missions .lb-main'); await page.clock.runFor(100);
    await page.evaluate(() => document.fonts.ready); await page.locator('#s-missions img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
    ok(await page.isVisible('#mission-daily') && await page.isHidden('#mission-weekly'),`${width}: daily default tab`);
    ok(!/하루\s*1(회|번)\s*무료\s*교체/.test(await page.textContent('#s-missions')),`${width}: unsupported promotional copy absent`);
    const geo = await page.locator('#s-missions').evaluate(s => {
      const rows=[...s.querySelectorAll('#mission-daily .mrow')];
      return {overflow:s.scrollWidth>s.clientWidth+1,rows:rows.map(r=>{const b=r.getBoundingClientRect();const children=[...r.children].map(x=>x.getBoundingClientRect());return {width:b.width,overlap:children.some((x,i)=>i&&x.left<children[i-1].right-1),outside:children.some(x=>x.left<b.left-1||x.right>b.right+1),text:r.querySelector('b').textContent};}),small:[...s.querySelectorAll('#mission-daily button')].filter(b=>b.getClientRects().length).some(b=>{const r=b.getBoundingClientRect();return r.width<44||r.height<44;})};
    });
    ok(!geo.overflow&&!geo.small&&geo.rows.every(r=>!r.overlap&&!r.outside),`${width}: no row overlap/overflow, touch targets >=44px`,geo);
    ok((await page.locator('#mission-daily .mission-reward').allTextContents()).every(s=>s.trim()==='173'),`${width}: live level-40 reward 173 (495 × 0.35), no mockup amount`);
    await page.screenshot({path:`${shots}/mission-daily-${width}.png`});
    await page.locator('#mission-daily .mrow').last().scrollIntoViewIfNeeded();
    ok(await page.locator('#mission-daily [data-swap="4"]').isVisible(),`${width}: bottom row reachable by scrolling`);
    await page.locator('#s-missions .ns-body').evaluate(e=>e.scrollTop=0);
    const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('healer.save')).player.gold);
    await page.click('#mission-daily [data-claim]');await page.clock.runFor(100);
    const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('healer.save')));
    ok(after.player.gold===before+173&&after.daily.missions[0].got,`${width}: claim uses existing economy`);
    await page.click('#mission-tab-weekly');await page.clock.runFor(100);
    ok(await page.isVisible('#mission-weekly')&&await page.isHidden('#mission-daily')&&await page.locator('#mission-weekly .mrow').count()===3,`${width}: weekly tab shows 3 actual missions`);
    ok(await page.locator('#mission-weekly [data-swap]').count()===0,`${width}: no invented weekly swap`);
    await page.screenshot({path:`${shots}/mission-weekly-${width}.png`});
    await page.locator('#mission-tab-weekly').press('ArrowLeft');
    ok(await page.isVisible('#mission-daily'),`${width}: keyboard tabs`);
    await page.click('#s-missions .tb-back');await page.clock.runFor(100);ok(await page.isVisible('#s-lobby'),`${width}: back to lobby`);
    if(width===390){
      await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('healer.save'));s.weekly.guild.n=10;s.weekly.guild.got=false;s.chalChest=5;localStorage.setItem('healer.save',JSON.stringify(s));});
      await page.reload();await page.clock.runFor(300);await pastTitle(page);await page.click('#s-lobby .lb-missions .lb-main');await page.clock.runFor(100);await page.click('#mission-tab-weekly');await page.clock.runFor(100);
      const fame=await page.evaluate(()=>JSON.parse(localStorage.getItem('healer.save')).guild.fame);
      await page.click('#guildGoal');await page.clock.runFor(100);
      const claimedGoal=await page.evaluate(()=>JSON.parse(localStorage.getItem('healer.save')));
      ok(claimedGoal.weekly.guild.got&&claimedGoal.guild.fame===fame+10,'weekly guild goal keeps existing reward and handler');
      await page.click('#chalChest');await page.clock.runFor(100);
      ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('healer.save')).chalChest===0),'weekly challenge chest remains claimable');
      await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('healer.save'));s.player.level=1;s.daily.day='';s.weekly.week='';localStorage.setItem('healer.save',JSON.stringify(s));});
      await page.reload();await page.clock.runFor(300);await pastTitle(page);await page.click('#s-lobby .lb-missions .lb-main');await page.clock.runFor(100);
      ok(await page.locator('#mission-daily .mrow').count()===4&&/0\s*\/\s*4/.test(await page.textContent('#mission-daily [data-sec="chest"] .g-meta')),'Lv1: actual 4 missions, chest 0/4 (not hardcoded 5)');
      await page.click('#mission-tab-weekly');await page.clock.runFor(100);ok(await page.locator('#mission-weekly .mrow').count()===0&&/Lv 10/.test(await page.textContent('#mission-weekly')),'Lv1 weekly locked without invented missions');
      await page.screenshot({path:`${shots}/mission-weekly-locked-390.png`});
    }
    await ctx.close();
  }
  await browser.close();const fails=checks.filter(x=>!x.pass).length;
  writeFileSync(`${shots}/missions-ui-report.json`,JSON.stringify({checks,fails,errs},null,2));return {fails,errs};
}
