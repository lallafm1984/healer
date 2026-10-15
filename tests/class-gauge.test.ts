import { describe, expect, it } from 'vitest';
import { create, use, setBeacon } from '../src/engine';
import { classGaugeState, beaconLabel } from '../src/battle/class-gauge-state';
import { putHot } from '../src/engine/heroes';

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
  it('주술사의 긴 샘과 긴 재사용 대기 숫자를 시안 한계로 자르지 않는다',()=>{
    const f=create({encounter:'warden',diff:'보통',seed:7,level:100,hero:'shaman'});
    f.totems=[{kind:'spring',cell:0,until:f.t+20,tick:1,at:f.t},{kind:'earth',cell:1,until:f.t+3,tick:1,at:f.t}];
    f.cd.springTotem=24;
    expect(classGaugeState(f)).toMatchObject({remaining:20,cooldown:24,earth:true});
    f.t+=21;expect(classGaugeState(f)).toMatchObject({remaining:0,earth:false});
  });
  it('특성으로 증가한 별 조각과 기 리듬의 최대치를 따른다',()=>{
    const f=create({encounter:'warden',diff:'보통',seed:7,level:100,hero:'astrologer'});
    f.tx.on.fifthStar=true;f.shards=3;expect(classGaugeState(f)).toMatchObject({max:4,percent:75});
    f.hero='monk';f.tx.on.sevenBeat=true;f.beat=6;f.beatUntil=f.t+3.5;
    expect(classGaugeState(f)).toMatchObject({count:6,max:7,remaining:3.5});
  });
  it('새싹 비율은 생존 파티원과 유효한 지속 치유만 센다',()=>{
    const f=create({encounter:'warden',diff:'보통',seed:7,level:100,hero:'druid'});
    putHot(f.party[0],'sprout',{sec:12,every:3,total:100});
    f.party[1].alive=false;
    const s=classGaugeState(f);expect(s.count).toBe(1);expect(s.max).toBe(f.party.length-1);
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
