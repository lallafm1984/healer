import { describe, expect, it } from 'vitest';
import { create } from '../src/engine';
import { classGaugeState } from '../src/battle/class-gauge-state';
import { putHot } from '../src/engine/heroes';

describe('직업 게이지의 실제 전투 상태',()=>{
  it('사제의 200% 저장량을 보존하고 광휘 채움은 100%에서 멈춘다',()=>{
    const f=create({encounter:'warden',diff:'보통',seed:7,level:100,hero:'priest'});
    f.g.p=175;expect(classGaugeState(f)).toMatchObject({count:175,percent:100});
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
});
