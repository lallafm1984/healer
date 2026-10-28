import { describe, expect, it } from 'vitest';
import { create, use, setBeacon } from '../src/engine';
import { classGaugeState, beaconLabel } from '../src/battle/class-gauge-state';
import { judgeCount, putSeal, warderApply } from '../src/engine/warder';
import { heroApply } from '../src/engine/heroes';
import { castOf } from '../src/engine/talents';
import { LEAF, WARDER } from '../src/data/heroConst';

describe('직업 게이지의 실제 전투 상태',()=>{
  it('봉화 이름은 실제 지정 대상을 따라 바뀌고 미지정·없는 ID도 처리한다',()=>{
    const f=create({encounter:'warden',diff:'보통',seed:7,level:100,hero:'paladin'});
    const target=f.party.find(u=>u.id!==f.beacon)!;target.nick='말없는수호기사';
    expect(setBeacon(f,target)).toBe(true);
    expect(classGaugeState(f)).toMatchObject({beaconName:'말없는수호기사'});
    expect(classGaugeState(f).description).toContain('봉화 말없는수호기사');
    f.beaconCd=0;expect(setBeacon(f,f.me)).toBe(true);
    expect(classGaugeState(f).beaconName).toBe(f.me.nick);
    f.beacon=null;expect(classGaugeState(f).beaconName).toBeNull();
    f.beacon=-999;expect(classGaugeState(f).beaconName).toBeNull();
  });
  it('봉화 이름은 최대 5글자이며 결합문자·이모지를 분리하거나 말줄임표를 붙이지 않는다',()=>{
    for(const [name,expected] of [[null,'미지정'],['','미지정'],['이슬','이슬'],['빛방패','빛방패'],['끝까지지킴','끝까지지킴'],['말없는수호기사','말없는수호'],['Alexander','Alexa'],['힐러A12호','힐러A12'],['ÁBCDEZ','ÁBCDE'],['🛡️힐러ABC','🛡️힐러AB']])expect(beaconLabel(name)).toBe(expected);
  });
  it('사제의 200% 저장량을 보존하고 광휘 채움은 100%에서 멈춘다',()=>{
    const f=create({encounter:'warden',diff:'보통',seed:7,level:100,hero:'priest'});
    f.g.p=175;expect(classGaugeState(f)).toMatchObject({count:175,percent:100});
  });
  it('평온 후광은 100 금빛·저장 특성 200 청백색이며 소모 시 하향 전환한다',()=>{
    const f=create({encounter:'warden',diff:'보통',seed:7,level:100,hero:'priest'});
    for(const saved of [false,true]){
      if(saved)f.tx.on.savedWord=true;else delete f.tx.on.savedWord;
      for(const [value,stage] of [[99,'off'],[99.999,'off'],[100,'gold'],[199,'gold'],[199.999,'gold'],[200,saved?'blue':'gold'],[150,'gold'],[99,'off'],[200,saved?'blue':'gold']] as const){
        f.g.p=value;expect(classGaugeState(f).priestAura).toBe(stage);
      }
    }
  });
  it('주술사: 샘 · 대지 토템 남은 시간 (재사용 대기는 스킬 버튼에, 2026-10-18 Lim), 긴 시간도 자르지 않는다',()=>{
    const f=create({encounter:'warden',diff:'보통',seed:7,level:100,hero:'shaman'});
    f.totems=[{kind:'spring',cell:0,until:f.t+20,tick:1,at:f.t},{kind:'earth',cell:1,until:f.t+3,tick:1,at:f.t}];
    f.cd.springTotem=24;
    expect(classGaugeState(f)).toMatchObject({remaining:20,earthRemaining:3,earthMax:10,earth:true});
    expect(classGaugeState(f).description).toBe('샘 토템 20.0초, 대지 토템 3.0초');
    f.t+=21;expect(classGaugeState(f)).toMatchObject({remaining:0,earthRemaining:0,earth:false});
  });
  it('특성으로 증가한 별 조각과 기 리듬의 최대치를 따른다',()=>{
    const f=create({encounter:'warden',diff:'보통',seed:7,level:100,hero:'astrologer'});
    f.tx.on.fifthStar=true;f.shards=3;expect(classGaugeState(f)).toMatchObject({max:4,percent:75});
    f.hero='monk';f.tx.on.sevenBeat=true;f.beat=6;f.beatUntil=f.t+3.5;
    expect(classGaugeState(f)).toMatchObject({count:6,max:7,remaining:3.5});
  });
  it('드루이드 잎: 직접 심은 새싹마다 1장 (최대 5), 들꽃 군락이 모두 써서 잎마다 +15%, 5장이면 바로 시전 + 새싹 (2026-10-28 Lim 1안)',()=>{
    const f=create({encounter:'warden',diff:'보통',seed:7,level:100,hero:'druid'});
    const [a,b]=f.party;
    expect(classGaugeState(f)).toMatchObject({count:0,max:LEAF.max,lit:0});
    for(let i=0;i<7;i++)heroApply(f,'sprout',a);
    expect(f.leaves).toBe(LEAF.max);expect(classGaugeState(f)).toMatchObject({count:5,lit:5,percent:100});
    expect(castOf(f,'wildflower')).toBe(0);
    b.hots=b.hots.filter(h=>h.key!=='sprout');
    heroApply(f,'wildflower',a);
    expect(f.leaves).toBe(0);expect(castOf(f,'wildflower')).toBeGreaterThan(0);
    const wild=(u:typeof a)=>u.hots.find(h=>h.key==='wildflower')!;
    const full=wild(a).rest;
    expect(b.hots.some(h=>h.key==='sprout')).toBe(true); // 5장: 새싹 없던 아군에게 새싹
    a.hots=[];heroApply(f,'wildflower',a);
    expect(full/wild(a).rest).toBeCloseTo(1+LEAF.heal*LEAF.max,5);
  });
  it('드루이드 잎 20인 레이드: 잎마다 big.heal, 5장이어도 새싹을 뿌리지 않음 (2026-10-28 통합 점검)',()=>{
    const f=create({encounter:'choir',diff:'보통',seed:7,level:100,hero:'druid'});
    const [a,b]=f.party;
    for(let i=0;i<LEAF.max;i++)heroApply(f,'sprout',a);
    expect(castOf(f,'wildflower')).toBe(0);
    b.hots=b.hots.filter(h=>h.key!=='sprout');
    heroApply(f,'wildflower',a);
    const wild=(u:typeof a)=>u.hots.find(h=>h.key==='wildflower')!;
    const full=wild(a).rest;
    expect(b.hots.some(h=>h.key==='sprout')).toBe(false);
    a.hots=[];heroApply(f,'wildflower',a);
    expect(full/wild(a).rest).toBeCloseTo(1+LEAF.big.heal*LEAF.max,5);
    expect(LEAF.big.heal).toBeLessThan(LEAF.heal);
  });
  it('결계사 결계력: 인장이 없던 아군에게 붙일 때마다 1칸 (최대 5), 심판이 모두 써서 칸마다 +15%, 5칸이면 인원 제한 없이 (2026-10-28 Lim 2안)',()=>{
    const f=create({encounter:'warden',diff:'보통',seed:7,level:100,hero:'warder'});
    const [a,b]=f.party;
    putSeal(f,a);putSeal(f,a);expect(f.warder!.ward).toBe(1); // 다시 붙이면 시간만 새로
    putSeal(f,b);expect(classGaugeState(f)).toMatchObject({count:2,lit:2,max:WARDER.ward.max});
    const judge=()=>{const live=f.party.filter(u=>u.alive);for(const v of live){v.hp=v.max*0.3;v.seal=f.t+1;}const before=live.map(v=>v.hp);warderApply(f,'judgment',a);return live.map((v,i)=>v.hp-before[i]);};
    f.warder!.ward=WARDER.ward.max;
    expect(judgeCount(f)).toBe(f.party.length);expect(classGaugeState(f)).toMatchObject({percent:100,targetMax:f.party.length});
    const big=judge();
    expect(f.warder!.ward).toBe(0);expect(judgeCount(f)).toBeLessThan(f.party.length);
    expect(big.filter(x=>x>0).length).toBe(f.party.filter(u=>u.alive).length); // 5칸: 인원 제한 없이 모두
    const small=judge();
    expect(small.filter(x=>x>0).length).toBe(judgeCount(f));
    const i=small.findIndex(x=>x>0);
    expect(big[i]/small[i]).toBeCloseTo(1+WARDER.ward.heal*WARDER.ward.max,5);
    f.hero='priest';expect(classGaugeState(f).lit).toBeNull();
  });
  it('신성한 힘 칸 수는 실제 최대치: 넘치는 신성한 힘이면 4칸 (2026-10-28 Lim)',()=>{
    const f=create({encounter:'warden',diff:'보통',seed:7,level:100,hero:'paladin'});
    f.power3=3;expect(classGaugeState(f)).toMatchObject({count:3,max:3,percent:100});
    const g=create({encounter:'warden',diff:'보통',seed:7,level:100,hero:'paladin',specs:{morePower:1}});
    g.power3=3;expect(classGaugeState(g)).toMatchObject({count:3,max:4,percent:75});
    expect(classGaugeState(g).description).toContain('신성한 힘 3/4');
    g.power3=4;expect(classGaugeState(g).percent).toBe(100);
  });
  it('파도 후광은 실제 힘 소모와 끝없는 빛·가벼운 파도 조건을 따른다',()=>{
    for(const endless of [false,true])for(const free of [false,true]){
      const f=create({encounter:'warden',diff:'보통',seed:7,level:100,hero:'paladin'});
      if(endless)f.tx.on.endlessLight=true;if(free)f.tx.on.freeWave=true;f.tx.any=endless||free;
      const ready=()=>classGaugeState(f).paladinWaveReady,need=endless?2:3;
      f.power3=need-1;expect(ready()).toBe(false);
      f.power3=need;f.mana=free?0:100;expect(ready()).toBe(true);
      expect(use(f,'lightWave',f.party[0].cell).ok).toBe(true);
      expect(f.power3).toBe(0);expect(ready()).toBe(false);
      f.power3=need;expect(ready()).toBe(false); // 실제 소비 후 공통 대기
      f.gcd=0;f.mana=100;expect(ready()).toBe(true);
    }
  });
  it('파도 잠김·마나·대상·레벨·전투 종료 제한과 시전 취소 규칙을 표시한다',()=>{
    const f=create({encounter:'warden',diff:'보통',seed:7,level:100,hero:'paladin'});
    const ready=()=>classGaugeState(f).paladinWaveReady;
    f.power3=3;expect(ready()).toBe(true);
    f.mana=0;expect(ready()).toBe(false);f.mana=100;
    f.lock.lightWave={left:2,total:2};expect(ready()).toBe(false);delete f.lock.lightWave;
    f.level=4;expect(ready()).toBe(false);f.level=100;
    f.gcd=1;expect(ready()).toBe(false);
    f.cast={key:'holyLight',cell:f.party[0].cell,uid:f.party[0].id,left:1,total:2};
    expect(ready()).toBe(true); // 기존 시전을 취소하면 즉시 사용 가능
    f.cast=null;f.gcd=0;
    f.party.forEach(u=>u.alive=false);expect(ready()).toBe(false);
    f.party[0].alive=true;expect(ready()).toBe(true);
    f.party[0].lift={until:10,fall:1,aim:'party'};expect(ready()).toBe(false);f.party[0].lift=null;
    f.over='lose';expect(ready()).toBe(false);
  });
});
