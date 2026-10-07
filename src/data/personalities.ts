/** 파티원 성격 (04 6장 중 10종). 순서가 파티 뽑기 결과를 정하므로 바꾸지 말 것 */
export type PersCat = '회피' | '위치' | '관계' | '감정';

export const CATS: Record<PersCat, string> = { '회피': '#7FA3BD', '위치': '#A3B46A', '관계': '#D68FA6', '감정': '#DB9B57' };

export interface Personality {
  /** 난이도 ★1~3 */
  star: 1 | 2 | 3;
  cat: PersCat;
  /** 칸에 쓰던 한 글자 약칭 */
  ch: string;
  desc: string;
  barks: string[];
  /** 반응 시간 배율 */
  react?: number;
  /** 회피 확률 보정 */
  dodge?: number;
  /** 딜 배율 */
  dps?: number;
  /** 예고가 끝나기 직전까지 버팀 */
  greedy?: boolean;
  /** 최대 체력 대비 이 비율 미만 피해면 장판 무시 */
  stubborn?: number;
  /** 엉뚱한 칸으로 갈 확률 */
  wrongWay?: number;
  /** 탱커로 뽑히지 않음 */
  noTank?: boolean;
  /** 체력이 이 비율 이상이면 장판 무시 */
  brave?: number;
  /** +1 아군 옆, -1 아군에게서 떨어짐 */
  dist?: number;
  /** 이 초 동안 힐을 못 받으면 삐짐 */
  attention?: number;
  thanks?: boolean;
  /** 체력이 이 비율 아래면 도망 */
  flee?: number;
}

export const PERS = {
  '신중파': { star: 1, cat: '회피', ch: '신', react: 0.5, dodge: 0.10, dps: 0.9, desc: '가장 먼저 피함. 딜은 조금 약함', barks: ['조심!', '다음 패턴 피해'] },
  '딜 욕심쟁이': { star: 2, cat: '회피', ch: '딜', react: 1.8, dodge: -0.15, dps: 1.2, greedy: true, desc: '예고가 끝나기 직전까지 딜하다 늦게 피함', barks: ['한 대만 더!', '딜 1등 찍었다 ㅋ'] },
  '고집불통': { star: 2, cat: '회피', ch: '고', stubborn: 0.4, desc: '최대 체력 40% 이상 피해가 아니면 장판을 안 피함', barks: ['안 움직여', '원래 이렇게 하는 거임'] },
  '덜렁이': { star: 3, cat: '회피', ch: '덜', dodge: -0.10, wrongWay: 0.10, noTank: true, desc: '가끔 장판 안으로 들어감', barks: ['어? 여기 아니야?', '어 이거 밟으면 안 되는 거였음?'] },
  '허세꾼': { star: 3, cat: '회피', ch: '허', brave: 0.7, desc: '체력 70% 이상이면 장판을 안 피함', barks: ['안 아파!', '이 정도쯤이야'] },
  '외톨이': { star: 1, cat: '위치', ch: '외', dist: -1, desc: '아군과 떨어진 칸에 섬. 광역 힐 범위 밖', barks: ['…'] },
  '사교형': { star: 1, cat: '위치', ch: '사', dist: 1, desc: '아군 옆에 붙음. 광역 힐 효율 좋음', barks: ['같이 가자!', '다들 모여~'] },
  '관심종자': { star: 3, cat: '관계', ch: '관', attention: 12, desc: '12초 동안 힐을 못 받으면 삐져서 딜 -25%', barks: ['힐러님 나 안 보여?', '나도 좀 봐줘…'] },
  '감사형': { star: 1, cat: '관계', ch: '감', thanks: true, desc: '힐을 받으면 3초간 딜 +10%', barks: ['ㄱㅅㄱㅅ', '덕분에 살았다!'] },
  '겁쟁이': { star: 3, cat: '감정', ch: '겁', flee: 0.5, noTank: true, desc: '체력 50% 아래면 뒷줄로 도망가 딜 중단, 80%면 복귀', barks: ['으악 도망!', '나 빠질게 무서워'] },
} as const satisfies Record<string, Personality>;

export type PersName = keyof typeof PERS;
export const PERS_NAMES = Object.keys(PERS) as PersName[];

/** 공개모집 파티원 닉네임 풀 */
export const NICKS: readonly string[] = ['장판요정', '딜미터1등', '말없는탱', '칼날', '감자도적', '새벽세시', '고인물', '버스기사', '닉값함', '퇴근각', '만렙꿈나무', '냥냥펀치', '불꽃남자', '얼음공주', '컨트롤장인', '딜뽕', '오늘만산다', '회피의신', '맞고보자', '탱하기싫다', '원딜장인', '활쏘는곰', '초코우유', '늦잠왕', '야근요정', '방패든양', '도끼든토끼', '별빛궁수'];
