/**
 * 켜고 끄는 기능. 길드: Lim 2026-10-09 「일단 초기 길드 컨텐츠를 빼자」로 꺼 두었다가 2026-10-18 「메뉴의 상점을 빼고 길드를 넣자」 · 「지금 켜기」로 다시 켬.
 * false면 하단 길드 탭 · 편성 「길드파티」 · 길드 임무 · 판 뒤 정산이 안 보이고 안 돈다 (코드 · 저장 데이터는 그대로).
 * 테스트는 이 값을 바꿔 가며 쓴다 (tests/guild.test.ts). 화면 검사는 켜졌을 때 tests/e2e/guild.mjs, 꺼 두면 guild-off.mjs.
 */
export const FEATURES = { guild: true };
