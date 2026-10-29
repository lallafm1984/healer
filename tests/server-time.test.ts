/**
 * 게임 시각 (기획 120 9-3, platform/time) · 앱이 켜질 때 창 (9-5, screens/server-notice)
 * 시각: 기준 (서버 시각 + 경과 시계)에서만 셈, 기기 시계는 안 씀. 재부팅 뒤 서버를 못 보면 앞서 가지 않는 쪽 (마지막 시각 + 이번 부팅 뒤 흐른 시간)
 */
import { describe, expect, it } from 'vitest';
import { carry, fromServer, now, timeAt, type Anchor } from '../src/platform/time';
import { bootActions, noticeBody } from '../src/screens/server-notice';
import type { Boot } from '../src/platform/server';

const MIN = 60e3, HOUR = 3600e3;

describe('게임 시각 기준', () => {
  const T = Date.UTC(2026, 9, 29, 5);
  it('같은 부팅: 기준 시각 + 경과 시계 차이', () => {
    const a: Anchor = { t: T, e: 10_000, b: 'c3', s: true };
    expect(timeAt(a, 10_000)).toBe(T);
    expect(timeAt(a, 10_000 + 90 * MIN)).toBe(T + 90 * MIN);
    expect(carry(a, 'c3', 99)).toBe(a);
  });

  it('다른 부팅 (재부팅 뒤 아직 서버를 못 봄): 마지막 시각 + 이번 부팅 뒤 흐른 시간, 실제보다 앞서지 않음', () => {
    // 마지막으로 알던 때: T (경과 5시간째). 그 뒤 2시간 지나 재부팅, 재부팅 뒤 30분
    const last: Anchor = { t: T, e: 5 * HOUR, b: 'c3', s: true };
    const realNow = T + 2 * HOUR + 30 * MIN;
    const c = carry(last, 'c4', 30 * MIN);
    expect(c).toEqual({ t: T + 30 * MIN, e: 30 * MIN, b: 'c4', s: true });
    expect(timeAt(c, 30 * MIN)).toBeLessThanOrEqual(realNow);
    // 그 뒤로는 이번 부팅 경과대로 흐름
    expect(timeAt(c, 90 * MIN)).toBe(T + 90 * MIN);
  });

  it('서버 시각을 받으면 요청 앞뒤 경과 시계의 가운데를 그 시각으로', () => {
    const a = fromServer(T, 1000, 1400, 'c4');
    expect(a).toEqual({ t: T, e: 1200, b: 'c4', s: true });
    expect(timeAt(a, 1200 + 5 * MIN)).toBe(T + 5 * MIN);
  });

  it('서버 주소가 없는 빌드 (단위 테스트)는 기기 시계', () => {
    expect(Math.abs(now() - Date.now())).toBeLessThan(1000);
  });
});

describe('앱이 켜질 때 창 (강제 업데이트 · 새 버전 · 점검 · 공지)', () => {
  const boot = (o: Partial<NonNullable<Boot['config']>> = {}, notices: Boot['notices'] = []): Boot => ({
    now: 0,
    config: { min_version: 100, latest_version: 120, store_url: 'https://play.google.com/store/apps/details?id=com.lallafm.healer', update_message: null, maintenance: false, maintenance_message: null, flags: {}, ...o },
    notices,
  });
  const n = (id: number, popup = true) => ({ id, title: `공지 ${id}`, body: '본문', popup, starts_at: 0 });

  it('min_version보다 낮으면 막음 (다른 창은 안 띄움)', () => {
    const a = bootActions(boot({ maintenance: true }, [n(1)]), 99, [], 0);
    expect(a).toEqual({ block: true, update: false, maintenance: null, popups: [] });
  });

  it('latest_version보다 낮으면 새 버전 알림, 그 버전 알림을 봤으면 다시 안 띄움', () => {
    expect(bootActions(boot(), 110, [], 0).update).toBe(true);
    expect(bootActions(boot(), 110, [], 120).update).toBe(false);
    expect(bootActions(boot(), 120, [], 0).update).toBe(false);
  });

  it('웹 · 개발 서버 (버전 0)는 업데이트 창 없음', () => {
    expect(bootActions(boot({ min_version: 999, latest_version: 999 }), 0, [], 0)).toMatchObject({ block: false, update: false });
  });

  it('점검: 글이 없으면 기본 글', () => {
    expect(bootActions(boot({ maintenance: true }), 120, [], 0).maintenance).toBe('서버 점검 중입니다. 게임은 그대로 할 수 있습니다.');
    expect(bootActions(boot({ maintenance: true, maintenance_message: ' 02시까지 ' }), 120, [], 0).maintenance).toBe('02시까지');
  });

  it('팝업 공지는 처음 볼 때만, 팝업이 아닌 공지는 목록에만', () => {
    const b = boot({}, [n(1), n(2, false), n(3)]);
    expect(bootActions(b, 120, [], 0).popups.map(x => x.id)).toEqual([1, 3]);
    expect(bootActions(b, 120, [1], 0).popups.map(x => x.id)).toEqual([3]);
  });

  it('설정이 없는 플랫폼 (config null)은 공지만', () => {
    expect(bootActions({ now: 0, config: null, notices: [n(5)] }, 120, [], 0)).toEqual({ block: false, update: false, maintenance: null, popups: [n(5)] });
  });

  it('공지 본문은 글만 (HTML 막음), 줄바꿈은 줄로', () => {
    expect(noticeBody('<b>a</b>\n둘째 줄')).toBe('&lt;b&gt;a&lt;/b&gt;<br>둘째 줄');
  });
});
