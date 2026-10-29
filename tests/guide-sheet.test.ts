// 공략 한눈에 (2026-10-12): 기술 대상 칩 · 피해 없이 디버프만 거는 잡몹 기술 · 새 공략 카드 모양
import { describe, expect, it } from 'vitest';
import { guideHtml, guideModel } from '../src/battle/guide';
import { secT } from '../src/battle/core';
import { CONTENT } from '../src/data/content';
import { pacePeriod } from '../src/data/pace';

describe('공략 대상 칩', () => {
  // 기술마다 정해 둔 대상 (예전엔 한국어 기술 글 첫머리를 읽었음, 3단계 ⑤-b). 감옥은 탱커 · 나 아닌 N명 (예전 「탱커」 칩은 글 첫머리 「탱커 · 나 아닌」을 잘못 읽은 것)
  const who = (key: Parameters<typeof guideModel>[0], diff: Parameters<typeof guideModel>[1], name: string) => guideModel(key, diff, 30, 30).skills.find(s => s.name === name)!.who;
  it('강타 = 탱커 · 광역 = 전원 · N명 · 장판 · 줄', () => {
    expect(who('warden', '보통', '내려찍기')).toEqual({ k: 'tank', t: '탱커' });
    expect(who('warden', '보통', '증기 분출')).toEqual({ k: 'all', t: '전원' });
    expect(who('warden', '보통', '녹물 웅덩이')).toEqual({ k: 'zone', t: '장판' });
    expect(guideModel('gate', '보통', 30, 30).skills.some(s => s.who?.k === 'some' && s.who.t === '1명')).toBe(true); // 잔해 투척병 (탱커 아닌 1명)
    expect(who('plague', '악몽', '독침')).toEqual({ k: 'some', t: '2명' });
    expect(who('plague', '악몽', '역병 폭풍')).toEqual({ k: 'zone', t: '장판' });
    expect(who('octo', '보통', '꼭 껴안기')).toEqual({ k: 'some', t: '1명' });
    expect(who('octo', '악몽', '꼭 껴안기')).toEqual({ k: 'some', t: '2명' });
  });
  it('대상이 없는 기술은 칩 없음', () => {
    for (const s of guideModel('warden', '보통', 30, 30).skills) if (s.enr) expect(s.who).toEqual({ k: 'enr', t: '전원' });
    expect(guideModel('hydra', '보통', 30, 30).skills.some(s => s.who == null)).toBe(true);
  });
});

describe('공략 카드', () => {
  const frog = CONTENT.find(c => c.key === 'frogpond')!;
  it('독만 거는 잡몹 기술은 「0 피해」 대신 디버프와 대처', () => {
    const g = guideModel(frog.fights('쉬움')[0], '쉬움', frog.stageLv, 20);
    const sting = g.skills.find(s => s.name === '독침')!;
    expect(sting.what).toMatch(/「독침」 \(독/);
    expect(sting.what).not.toMatch(/\b0<\/b> 피해|>0</);
    expect(sting.how).toBeTruthy();
  });
  it('보스 카드: 진행 · 기술마다 주기 · 대상 칩 · 굵은 피해 숫자 (대처 줄 · 위쪽 안내 글은 뺌)', () => {
    const html = guideHtml(guideModel(frog.fights('쉬움')[1], '쉬움', frog.stageLv, 20), null);
    expect(html).toContain('<h4 class="gd-h">진행</h4>');
    expect(html).toMatch(/<span class="gs-who tank">탱커<\/span>/);
    expect(html).toMatch(/<span class="gs-who all">전원<\/span>/);
    expect(html).toMatch(/<b>\d+<\/b> 피해/);
    expect(html).not.toMatch(/class="gs-how"/);
    expect(html).toContain('<h4 class="gd-h">보스 기술</h4>');
    expect(html).toContain(`class="gs-every">${secT(pacePeriod(16))}마다`); // 16초 × 보스 빠르기 (data/pace)
  });
  it('잡몹 구간은 잡는 순서 · 적 기술', () => {
    const html = guideHtml(guideModel(frog.fights('쉬움')[0], '쉬움', frog.stageLv, 20), null);
    expect(html).toContain('잡는 순서');
    expect(html).toContain('적 기술');
    expect(html).not.toContain('보스 기술');
  });
});

// 2026-10-27 Lim 「역병사슬이 걸리면 어떻게 되는지, 퍼지는 역병이 걸리면 어떤 효과인지 설명이 없어서 … 공략에서는 상세히 (다른 모든 보스 스킬 해당)」
describe('공략 기술 글 = 걸리면 무엇이 되는지', () => {
  it('역병 사슬 · 퍼지는 역병: 나눔 · 번짐을 숫자까지', () => {
    const g = guideModel('malos', '보통', 30, 30);
    const chain = g.skills.find(s => s.name === '역병 사슬')!.tip(null)[0];
    const spread = g.skills.find(s => s.name === '질병 퍼뜨리기')!.tip(null)[0];
    expect(chain).toMatch(/「역병 사슬」로 14초 이음 \(해제 안 됨\): 이어진 둘이 받는 피해 · 치유를 반씩 나눔/);
    expect(spread).toMatch(/「퍼지는 역병」 \(질병, 8초 · 끝나면 터져 이웃 칸 아군 \d+ \+ 「독침」 \(독, 12초 · 초당 \d+\), 지우면 그 자리에서 바로 터짐\)/);
  });
  it('모든 보스 · 구간: 쫄은 하는 일, 차례 디버프는 디버프마다 효과', () => {
    for (const c of CONTENT) for (const k of new Set(c.fights('악몽'))) {
      for (const s of guideModel(k, '악몽', c.stageLv, 60).skills) {
        const t = s.tip(null)[0];
        expect(t.length, `${k} ${s.name}`).toBeGreaterThan(8);
        expect(t, `${k} ${s.name}`).not.toMatch(/마리 등장$|디버프를 차례로 \(/);
        expect(t, `${k} ${s.name}`).not.toMatch(/「[^」]+」 \([^,()]+, [\d.]+초\)/); // 효과 없는 디버프 글
      }
    }
  });
});
