/**
 * 출시판에서 잠시 빼 둔 기능 (Lim 2026-10-09 「일단 초기 길드 컨텐츠를 빼자」).
 * false면 탭·로비 건물·편성 「길드파티」·임무·판 뒤 정산이 안 보이고 안 돈다. 길드 코드(screens/guild.ts, game/guild.ts, data/guild.ts)와
 * 저장의 길드 데이터는 그대로 두므로 true로 바꾸면 돌아온다. 되살릴 때 tests/e2e/guild.mjs를 scripts/e2e.mjs에 다시 넣을 것.
 * 테스트는 이 값을 바꿔 가며 쓴다 (tests/guild.test.ts).
 */
export const FEATURES = { guild: false };
