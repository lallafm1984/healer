import { describe, expect, it } from 'vitest';
import { ADVENTURE_REGIONS, adventureContents, adventureRegionOf, adventureRegions, adventureTabOf, type AdventureTab } from '../src/data/adventure-regions';
import { CONTENT, contentOf } from '../src/data/content';
import { CONTENT_PLACE, PLACES } from '../src/data/places';

const tabs: AdventureTab[] = ['explore', 'dungeon', 'raid10', 'raid20'];

describe('출전 지역과 장소', () => {
  it('원래 공개된 장소가 네 분류의 지역 목록에 빠짐없이 한 번씩 나온다', () => {
    const all = tabs.flatMap(tab => adventureRegions(tab).flatMap(r => adventureContents(tab, r.key)));
    const original = CONTENT.filter(c => !c.hidden);
    expect(all).toHaveLength(original.length);
    expect(new Set(all.map(c => c.key)).size).toBe(original.length);
    expect(all.map(c => c.key).sort()).toEqual(original.map(c => c.key).sort());
    expect(all.some(c => c.key === 'tutorial')).toBe(false);
  });

  it.each(tabs)('%s: 잠긴 고레벨 장소도 남기고 원본 진입 조건과 장소 순서를 보존한다', tab => {
    const originalOrder = CONTENT.map(c => c.key);
    const list = adventureContents(tab);
    for (const region of adventureRegions(tab)) {
      const places = adventureContents(tab, region.key);
      expect(places.length).toBeGreaterThan(0);
      expect(places).toEqual(list.filter(c => adventureRegionOf(c).key === region.key));
      for (const c of places) {
        expect(c).toBe(contentOf(c.key));
        expect(adventureTabOf(c)).toBe(tab);
      }
      expect(places.map(c => c.unlockLv)).toEqual(places.map(c => c.unlockLv).sort((a, b) => a - b));
    }
    expect(CONTENT.map(c => c.key)).toEqual(originalOrder);
    expect(list.some(c => c.unlockLv >= 90)).toBe(true);
  });

  it('대표 그림은 그 지역의 실제 장소를 가리킨다', () => {
    expect(new Set(ADVENTURE_REGIONS.map(r => r.key)).size).toBe(ADVENTURE_REGIONS.length);
    for (const r of ADVENTURE_REGIONS) {
      expect(r.name).toBeTruthy();
      expect(r.shortName).toBeTruthy();
      expect(PLACES[CONTENT_PLACE[r.representative]]).toBeDefined();
      expect(adventureRegionOf(r.representative).key).toBe(r.key);
    }
  });

  it('방문 지역은 적 세력과 다를 수 있다', () => {
    expect(adventureRegionOf('forge').key).toBe('flame');
    for (const key of ['station', 'school', 'cloudlibrary', 'broomrace'] as const) expect(adventureRegionOf(key).key).toBe('cloud');
    for (const key of ['carriage', 'ballroom', 'sunkrose', 'lotusway'] as const) expect(adventureRegionOf(key).key).toBe('depths');
    expect(adventureRegionOf('sunrisehill').key).toBe('sunflower');
  });

  it('같은 심연 세력이라도 탑과 호수를 구분하고 10인 레이드의 층은 흩어지지 않는다', () => {
    expect(adventureContents('raid10', 'tower').map(c => c.key)).toEqual(['abyss1', 'abyss2', 'abyss3', 'abyss4', 'abyss5']);
    expect(adventureContents('raid20', 'tower')).toEqual([]);
  });

  it('20인 레이드는 원본 시설별 3~4구역으로 나누고 첫 구역을 대표 그림으로 쓴다', () => {
    const expected = [
      ['cathedral', '가라앉은 대성당', ['cathedral1', 'cathedral2', 'cathedral3', 'cathedral4']],
      ['abbey', '물밑 수도원', ['abbey1', 'abbey2', 'abbey3']],
      ['rootwood', '빛뿌리 숲', ['rootwood1', 'rootwood2', 'rootwood3']],
      ['reservoir', '별빛 저수지', ['reservoir1', 'reservoir2', 'reservoir3']],
      ['well', '숨결 우물', ['well1', 'well2', 'well3']],
      ['crystal', '수정 뿌리굴', ['crystal1', 'crystal2', 'crystal3']],
      ['shadow', '그림자 성벽', ['shadow1', 'shadow2', 'shadow3']],
      ['camp', '그림자 진영', ['camp1', 'camp2', 'camp3']],
      ['coast', '어둠물 해안', ['coast1', 'coast2', 'coast3']],
      ['heart', '심연의 심장', ['heart1', 'heart2', 'heart3']],
    ] as const;
    expect(adventureRegions('raid20').map(r => r.key)).toEqual(expected.map(([key]) => key));
    for (const [key, name, contents] of expected) {
      const r = adventureRegions('raid20').find(r => r.key === key)!;
      expect(r.name).toBe(name);
      expect(r.representative).toBe(contents[0]);
      expect(adventureContents('raid20', key).map(c => c.key)).toEqual(contents);
      expect(adventureRegions('explore').some(r => r.key === key)).toBe(false);
      expect(adventureRegions('dungeon').some(r => r.key === key)).toBe(false);
      expect(adventureRegions('raid10').some(r => r.key === key)).toBe(false);
    }
    expect(adventureContents('raid20')).toHaveLength(31);
    expect(adventureContents('raid20', 'lake')).toEqual([]);
    expect(adventureContents('raid20', 'depths')).toEqual([]);
  });

  it('20인 레이드 세분화 뒤에도 탐험·던전의 호수와 바닥은 기존 지역을 유지한다', () => {
    for (const tab of ['explore', 'dungeon'] as const) {
      const lake = CONTENT.filter(c => !c.hidden && c.kind === tab && PLACES[CONTENT_PLACE[c.key]].faction === 'abyss' && c.key !== 'abyssedge');
      expect(adventureContents(tab, 'lake')).toEqual(lake.sort((a, b) => a.unlockLv - b.unlockLv));
      expect(adventureRegions(tab).map(r => r.key)).toContain('lake');
      expect(adventureRegions(tab).map(r => r.key)).toContain('depths');
    }
    expect(adventureRegionOf('lantern').key).toBe('depths');
    expect(adventureRegionOf('heartcrack').key).toBe('depths');
  });
});
