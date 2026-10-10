/**
 * 콘텐츠 선택 화면(09 S03)에 나오는 탐험·던전·레이드. 열림 레벨은 34 5-2 (출시 70곳, 탐험 ①~⑧ · 던전 5레벨마다 · 10인 Lv 35부터),
 * 장소 · 보스는 묶음 A 장소표 (39). 만든 곳 (ready)만 들어가고, 나머지는 잠긴 카드로 보여 준다.
 */
import type { DiffName } from './difficulty';
import { DUNGEONS } from './dungeons';
import { ENCOUNTERS, type EncounterKey } from './encounters';
import { CONTENT_PLACE, FACTIONS, PLACES } from './places';

export type ContentKind = 'explore' | 'dungeon' | 'raid';
export type ContentKey = 'tutorial' | 'plateau' | 'rustfort' | 'abyss1' | 'cathedral1' | 'crypt' | 'swamp' | 'manor' | 'frost' | 'temple'
  | 'watchtower' | 'archive' | 'ossuary' | 'sewer'
  | 'cemetery' | 'marsh' | 'lily' | 'snowpass' | 'hillpath' | 'pilgrim' | 'abyssedge'
  | 'bookfield' | 'rosemaze' | 'shellbeach' | 'wreck'
  | 'gull1' | 'gull2' | 'gull3' | 'queen1' | 'queen2' | 'queen3' | 'isle1' | 'isle2' | 'isle3'
  | 'lampway' | 'emberfoot' | 'teaparty' | 'mossroot' | 'rainbow'
  | 'fest1' | 'fest2' | 'fest3' | 'cave1' | 'cave2' | 'cave3' | 'palace1' | 'palace2' | 'palace3'
  | 'ashpass' | 'hotspring' | 'forge' | 'den1' | 'den2' | 'den3'
  | 'lakeshore' | 'nest1' | 'nest2' | 'nest3' | 'cathedral2' | 'cathedral3' | 'cathedral4'
  | 'abyss2' | 'abyss3' | 'abyss4' | 'abyss5';

export const ALL_DIFFS: DiffName[] = ['쉬움', '보통', '어려움', '악몽'];

export interface ContentDef {
  key: ContentKey;
  kind: ContentKind;
  name: string;
  /** 지역 · 세력 (11 4장) */
  place: string;
  /** 최소 적 레벨 (= 열림 레벨). 들어가면 적은 내 레벨로 맞춰짐 (32), 이건 개발 빌드로 레벨 전에 들어갈 때·튜토리얼 판만 씀 */
  stageLv: number;
  /** 이 레벨부터 열림 */
  unlockLv: number;
  /** 아직 만들지 않은 콘텐츠 (카드만) */
  ready: boolean;
  /** 보스 (마지막 = 최종 보스, 11 4장) */
  bosses: string[];
  /** 난이도별 이어서 하는 전투 목록 */
  fights: (d: DiffName) => EncounterKey[];
  /** 난이도별 인원 (나 포함) */
  size: (d: DiffName) => number;
  /** 이 난이도만 따로 잠금 (10인 악몽 Lv 50, 20인 악몽 Lv 80) */
  diffUnlock?: Partial<Record<DiffName, number>>;
  /** 콘텐츠 목록에 안 보임 (튜토리얼 첫 전투) */
  hidden?: boolean;
}

const three = () => 3;
const five = () => 5;

export const CONTENT: ContentDef[] = [
  // 첫 전투 2인 (02 11장 1번). 튜토리얼에서만
  { key: 'tutorial', kind: 'explore', name: '첫 전투', place: '녹슨 고원 입구', stageLv: 1, unlockLv: 1, ready: true, bosses: [], fights: () => ['duo'], size: () => 2, hidden: true },
  // 탐험 ①~⑧ (3인, 39 1-1): 같은 세력 던전 보스를 줄여 빌려 다음 던전의 새 기믹을 먼저 보여 줌 (35 4-8)
  {
    key: 'plateau', kind: 'explore', name: '녹슨 고원', place: '녹슨 고원 · 골렘', stageLv: 1, unlockLv: 1, ready: true, bosses: ['고철 순찰병'],
    fights: () => DUNGEONS.plateau.segments, size: three,
  },
  {
    key: 'cemetery', kind: 'explore', name: '잿빛 공동묘지', place: '왕도 변두리 · 역병 교단', stageLv: 3, unlockLv: 3, ready: true, bosses: ['뼈다귀 수집가'],
    fights: () => DUNGEONS.cemetery.segments, size: three,
  },
  {
    key: 'marsh', kind: 'explore', name: '늪지 어귀', place: '늪지 · 늪의 부족', stageLv: 8, unlockLv: 8, ready: true, bosses: ['늪 주술사'],
    fights: () => DUNGEONS.marsh.segments, size: three,
  },
  {
    key: 'lily', kind: 'explore', name: '백합 정원', place: '백합 영지 · 귀족가', stageLv: 13, unlockLv: 13, ready: true, bosses: ['집사 유령'],
    fights: () => DUNGEONS.lily.segments, size: three,
  },
  {
    key: 'snowpass', kind: 'explore', name: '눈보라 고개', place: '설원 · 마도사', stageLv: 18, unlockLv: 18, ready: true, bosses: ['마력 골렘'],
    fights: () => DUNGEONS.snowpass.segments, size: three,
  },
  {
    key: 'hillpath', kind: 'explore', name: '해바라기 언덕길', place: '해바라기 언덕 · 혼합', stageLv: 23, unlockLv: 23, ready: true, bosses: ['신전 수호상'],
    fights: () => DUNGEONS.hillpath.segments, size: three,
  },
  {
    key: 'pilgrim', kind: 'explore', name: '무너진 순례길', place: '해바라기 언덕 · 혼합', stageLv: 28, unlockLv: 28, ready: true, bosses: ['신전지기 유령'],
    fights: () => DUNGEONS.pilgrim.segments, size: three,
  },
  {
    key: 'abyssedge', kind: 'explore', name: '심연 가장자리', place: '심연의 탑 아래 · 심연', stageLv: 33, unlockLv: 33, ready: true, bosses: ['역병 군주'],
    fights: () => DUNGEONS.abyssedge.segments, size: three,
  },
  // 탐험 ⑨~⑫ (46 1-1, 묶음 B): ⑩ ⑫는 옛 세력 던전 보스를 빌려 다음 던전 예습
  // 묶음 B 탐험 ⑨ ⑪ (46 1-1): 짠물 해적단 10인 레이드 예습
  {
    key: 'shellbeach', kind: 'explore', name: '조개껍데기 해변', place: '산호 해안 · 짠물 해적단', stageLv: 36, unlockLv: 36, ready: true, bosses: ['집게발 갑판장'],
    fights: () => DUNGEONS.shellbeach.segments, size: three,
  },
  {
    key: 'bookfield', kind: 'explore', name: '책갈피 설원', place: '설원 · 마도사', stageLv: 40, unlockLv: 40, ready: true, bosses: ['서고 사서'],
    fights: () => DUNGEONS.bookfield.segments, size: three,
  },
  {
    key: 'wreck', kind: 'explore', name: '난파선 모래톱', place: '산호 해안 · 짠물 해적단', stageLv: 44, unlockLv: 44, ready: true, bosses: ['해적 선장 금빛수염'],
    fights: () => DUNGEONS.wreck.segments, size: three,
  },
  {
    key: 'rosemaze', kind: 'explore', name: '장미 울타리 미로', place: '백합 영지 · 귀족가', stageLv: 48, unlockLv: 48, ready: true, bosses: ['백합 여사제'],
    fights: () => DUNGEONS.rosemaze.segments, size: three,
  },
  // 묶음 C 탐험 ⑬ ⑮ (48 1-1): ⑬은 던전 ⑪ 예습 (넘어가는 포자), ⑮는 다음 지역 붉은 용 일가 첫 얼굴
  {
    key: 'lampway', kind: 'explore', name: '꼬마등 오솔길', place: '반딧불 버섯숲 · 버섯 요정단', stageLv: 52, unlockLv: 52, ready: true, bosses: ['찻잔 요정 홀짝이'],
    fights: () => DUNGEONS.lampway.segments, size: three,
  },
  {
    key: 'rainbow', kind: 'explore', name: '무지개 버섯밭', place: '반딧불 버섯숲 · 버섯 요정단', stageLv: 56, unlockLv: 56, ready: true, bosses: ['버섯 여왕 아마니타'],
    fights: () => DUNGEONS.rainbow.segments, size: three,
  },
  {
    key: 'emberfoot', kind: 'explore', name: '불꽃 봉우리 기슭', place: '불꽃 봉우리 · 붉은 용 일가', stageLv: 60, unlockLv: 60, ready: true, bosses: ['코볼트 보물 지킴이 꼬질'],
    fights: () => DUNGEONS.emberfoot.segments, size: three,
  },
  // 묶음 D 탐험 ⑯ (51 1-1): 던전 ⑬ 예습 (녹는 보호막)
  {
    key: 'ashpass', kind: 'explore', name: '화산재 고갯길', place: '불꽃 봉우리 · 붉은 용 일가', stageLv: 64, unlockLv: 64, ready: true, bosses: ['온천지기 코볼트 뭉실'],
    fights: () => DUNGEONS.ashpass.segments, size: three,
  },
  // 묶음 D 탐험 ⑰ (51 1-1): 20인 대성당 회랑 예습 (생명 사슬 균형형)
  {
    key: 'lakeshore', kind: 'explore', name: '잠긴 호숫가', place: '불꽃 봉우리 아래 호수 · 심연', stageLv: 68, unlockLv: 68, ready: true, bosses: ['물그림자 기사 셋'],
    fights: () => DUNGEONS.lakeshore.segments, size: three,
  },
  // 던전 ①~⑩ (5인, 5레벨마다). ⑧~⑩은 묶음 B
  {
    key: 'rustfort', bosses: ['고철 경비병', '녹슨 문지기'], kind: 'dungeon', name: '녹슨 요새', place: '녹슨 고원 · 골렘', stageLv: 5, unlockLv: 5, ready: true,
    fights: () => DUNGEONS.rustfort.segments, size: five,
  },
  {
    key: 'crypt', bosses: ['뼈다귀 수집가', '역병 사제 말코어'], kind: 'dungeon', name: '역병 지하묘지', place: '왕도 지하 · 역병 교단', stageLv: 10, unlockLv: 10, ready: true,
    fights: () => DUNGEONS.crypt.segments, size: five,
  },
  {
    key: 'swamp', bosses: ['늪 주술사', '거대 두꺼비 부글이', '늪 족장 세레스'], kind: 'dungeon', name: '독안개 늪', place: '늪지 · 늪의 부족', stageLv: 15, unlockLv: 15, ready: true,
    fights: () => DUNGEONS.swamp.segments, size: five,
  },
  {
    key: 'manor', bosses: ['집사 유령', '초상화 속 귀부인', '장원 주인 벨모어 경'], kind: 'dungeon', name: '저주받은 장원', place: '백합 영지 · 귀족가', stageLv: 20, unlockLv: 20, ready: true,
    fights: () => DUNGEONS.manor.segments, size: five,
  },
  {
    key: 'frost', bosses: ['마력 골렘', '불안정한 마법사', '탑주의 그림자'], kind: 'dungeon', name: '서리 마탑', place: '설원 · 마도사', stageLv: 25, unlockLv: 25, ready: true,
    fights: () => DUNGEONS.frost.segments, size: five,
  },
  {
    key: 'temple', bosses: ['신전 수호상', '신전지기 유령'], kind: 'dungeon', name: '깨진 신전', place: '해바라기 언덕 · 혼합', stageLv: 30, unlockLv: 30, ready: true,
    fights: () => DUNGEONS.temple.segments, size: five,
  },
  {
    key: 'watchtower', bosses: ['망루 파수꾼', '금 간 공명 수정'], kind: 'dungeon', name: '무너진 망루', place: '해바라기 언덕 · 혼합', stageLv: 35, unlockLv: 35, ready: true,
    fights: () => DUNGEONS.watchtower.segments, size: five,
  },
  // 던전 ⑧~⑩ (46 1-2, 묶음 B): 옛 세력, 보스 2
  {
    key: 'sewer', bosses: ['수로 쥐왕', '역병 운반자'], kind: 'dungeon', name: '역병 수로', place: '왕도 지하 · 역병 교단', stageLv: 40, unlockLv: 40, ready: true,
    fights: () => DUNGEONS.sewer.segments, size: five,
  },
  {
    key: 'archive', bosses: ['서고 사서', '얼어붙은 대학자'], kind: 'dungeon', name: '얼음 서고', place: '설원 · 마도사', stageLv: 45, unlockLv: 45, ready: true,
    fights: () => DUNGEONS.archive.segments, size: five,
  },
  {
    key: 'ossuary', bosses: ['백합 여사제', '잠든 가주'], kind: 'dungeon', name: '백합 납골당', place: '백합 영지 · 귀족가', stageLv: 50, unlockLv: 50, ready: true,
    fights: () => DUNGEONS.ossuary.segments, size: five,
  },
  // 던전 ⑪ ⑫ (48 1-2, 묶음 C): 버섯 요정단 · 늪의 부족, 보스 2
  {
    key: 'teaparty', bosses: ['찻잔 요정 홀짝이', '모자 장수 해롱'], kind: 'dungeon', name: '끝없는 다과회', place: '반딧불 버섯숲 · 버섯 요정단', stageLv: 55, unlockLv: 55, ready: true,
    fights: () => DUNGEONS.teaparty.segments, size: five,
  },
  {
    key: 'mossroot', bosses: ['버섯 가면 주술사 우가', '늪 거북 신 등딱지'], kind: 'dungeon', name: '이끼 뿌리 사원', place: '독안개 늪 · 늪의 부족', stageLv: 60, unlockLv: 60, ready: true,
    fights: () => DUNGEONS.mossroot.segments, size: five,
  },
  // 던전 ⑬ ⑭ (51 1-2, 묶음 D): 붉은 용 일가 · 버려진 골렘 (해제 없음), 보스 2
  {
    key: 'hotspring', bosses: ['온천지기 코볼트 뭉실', '사춘기 용 불퉁이'], kind: 'dungeon', name: '용암 온천장', place: '불꽃 봉우리 · 붉은 용 일가', stageLv: 65, unlockLv: 65, ready: true,
    fights: () => DUNGEONS.hotspring.segments, size: five,
  },
  {
    key: 'forge', bosses: ['풀무 골렘 후끈이', '모루 골렘 땅땅'], kind: 'dungeon', name: '용암 대장간', place: '불꽃 봉우리 · 버려진 골렘', stageLv: 70, unlockLv: 70, ready: true,
    fights: () => DUNGEONS.forge.segments, size: five,
  },
  {
    // 10인 레이드 (26 3장): 난이도 4개 모두 10인
    key: 'abyss1', bosses: ['역병 군주'], kind: 'raid', name: '심연의 탑 1층', place: '납골당 · 역병 군주', stageLv: 35, unlockLv: 35, ready: true,
    fights: () => ['plague'], size: () => 10, diffUnlock: { '악몽': 50 },
  },
  // 심연의 탑 2층 ~ 꼭대기 (39 1-3): 층마다 보스 1, 1층과 같은 Lv 35 · 악몽 Lv 50
  ...([
    ['abyss2', '심연의 탑 2층', '늪의 정원 · 늪의 어머니 히드라', '늪의 어머니 히드라', 'hydra'],
    ['abyss3', '심연의 탑 3층', '백합 회랑 · 쌍둥이 여군주', '쌍둥이 여군주', 'twins'],
    ['abyss4', '심연의 탑 4층', '서리 전망대 · 대마도사 오르벤', '대마도사 오르벤', 'orben'],
    ['abyss5', '심연의 탑 꼭대기', '첨탑 · 심연의 군주', '심연의 군주', 'abysslord'],
  ] as const).map(([key, name, place, boss, enc]): ContentDef => ({
    key, bosses: [boss], kind: 'raid', name, place, stageLv: 35, unlockLv: 35, ready: true, fights: () => [enc], size: () => 10, diffUnlock: { '악몽': 50 },
  })),
  // 묶음 B 10인 ②~④ (46 1-3): 짠물 해적단 · 묶음 C 10인 ⑤~⑦ (48 1-3): 버섯 요정단, 칸마다 보스 1. 악몽 = 열림 + 15 (34 5-2)
  ...([
    ['gull1', '갈매기 항구 부두', '갈매기 항구 · 집게발 갑판장', '집게발 갑판장', 'crab', 39],
    ['gull2', '갈매기 항구 주방', '생선 시장 주방 · 해적 요리사 왕솥', '해적 요리사 왕솥', 'cook', 39],
    ['gull3', '갈매기 항구 등대', '등대 아래 부두 · 부선장 갈고리 모렐', '부선장 갈고리 모렐', 'morel', 39],
    ['queen1', '짠물 여왕호 갑판', '짠물 여왕호 · 포수장 쾅쾅', '포수장 쾅쾅', 'gunner', 43],
    ['queen2', '짠물 여왕호 창고', '갑판 밑 창고 · 문어 꾸물이', '문어 꾸물이', 'octo', 43],
    ['queen3', '짠물 여왕호 뱃머리', '뱃머리 · 바다 마녀 미역 할멈', '바다 마녀 미역 할멈', 'seawitch', 43],
    ['isle1', '보물섬 요새 동굴', '보물 동굴 · 보물 상자 덥석이', '보물 상자 덥석이', 'mimic', 47],
    ['isle2', '보물섬 요새 망루', '앵무새 망루 · 앵무새 대장 깍깍', '앵무새 대장 깍깍', 'parrot', 47],
    ['isle3', '보물섬 요새 꼭대기', '꼭대기 보물 더미 · 해적 선장 금빛수염', '해적 선장 금빛수염', 'goldbeard', 47],
    // 묶음 C 10인 ⑤~⑦ (48 1-3): 버섯 요정단
    ['fest1', '요정 축제 마당 어귀', '축제 어귀 · 버섯 경비대장 송이', '버섯 경비대장 송이', 'songi', 51],
    ['fest2', '요정 축제 마당 무대', '축제 무대 · 요정 악단장 삘릴리', '요정 악단장 삘릴리', 'pililli', 51],
    ['fest3', '요정 축제 마당 모닥불', '축제 모닥불 · 축제 대장 퐁가', '축제 대장 퐁가', 'ponga', 51],
    ['cave1', '포자 동굴 정원 이끼굴', '이끼 굴 · 이끼 골렘 뭉게', '이끼 골렘 뭉게', 'mungge', 55],
    ['cave2', '포자 동굴 정원 연못', '포자 연못 · 개구리 사공 개굴', '개구리 사공 개굴', 'gaegul', 55],
    ['cave3', '포자 동굴 정원 뿌리방', '뿌리 방 · 포자 정원사 모락 할멈', '포자 정원사 모락 할멈', 'morak', 55],
    ['palace1', '버섯 여왕의 궁전 정원', '궁전 정원 · 꿀벌 근위대장 붕붕', '꿀벌 근위대장 붕붕', 'bungbung', 59],
    ['palace2', '버섯 여왕의 궁전 연회장', '궁전 연회장 · 요정 마술사 뿅뿅', '요정 마술사 뿅뿅', 'ppyong', 59],
    ['palace3', '버섯 여왕의 궁전 왕좌', '광대버섯 왕좌 · 버섯 여왕 아마니타', '버섯 여왕 아마니타', 'amanita', 59],
    // 묶음 D 10인 ⑧ (51 1-3): 붉은 용 일가
    ['den1', '코볼트 보물 굴 갱도', '보물 굴 갱도 · 코볼트 보물 지킴이 꼬질', '코볼트 보물 지킴이 꼬질', 'kkojil', 63],
    ['den2', '코볼트 보물 굴 수레길', '수레길 · 코볼트 수레꾼 덜컹이', '코볼트 수레꾼 덜컹이', 'deolkeong', 63],
    ['den3', '코볼트 보물 굴 보물방', '보물방 · 코볼트 대장 번쩍이', '코볼트 대장 번쩍이', 'beonjjeok', 63],
    // 묶음 D 10인 ⑨ (51 1-3): 붉은 용 일가 수장
    ['nest1', '어미 용의 둥지 알둥지', '알둥지 · 새끼 용 삼남매', '새끼 용 삼남매', 'whelps', 67],
    ['nest2', '어미 용의 둥지 다리', '용암 다리 · 용 비늘 경비대장 단단이', '용 비늘 경비대장 단단이', 'dandani', 67],
    ['nest3', '어미 용의 둥지 보물더미', '보물 더미 · 어미 용 루비나', '어미 용 루비나', 'rubina', 67],
  ] as const).map(([key, name, place, boss, enc, lv]): ContentDef => ({
    key, bosses: [boss], kind: 'raid', name, place, stageLv: lv, unlockLv: lv, ready: true, fights: () => [enc], size: () => 10, diffUnlock: { '악몽': lv + 15 },
  })),
  {
    // 20인 레이드 (26 4장): 따로 된 레이드, 난이도 4개 모두 20인
    key: 'cathedral1', bosses: ['유령 성가대'], kind: 'raid', name: '가라앉은 대성당 1구역', place: '해바라기 언덕 아래 · 호수 밑', stageLv: 70, unlockLv: 70, ready: true,
    fights: () => ['choir'], size: () => 20, diffUnlock: { '악몽': 80 },
  },
  // 묶음 D 20인 ① 2~4구역 (51 1-4): 1구역과 한 레이드, 칸마다 보스 1 · 열림 Lv 70 · 악몽 80
  ...([
    ['cathedral2', '가라앉은 대성당 회랑', '물 빠진 회랑 · 물그림자 기사 셋', '물그림자 기사 셋', 'knights'],
    ['cathedral3', '가라앉은 대성당 오르간', '물오르간 · 물오르간 정령 우웅이', '물오르간 정령 우웅이', 'uwoong'],
    ['cathedral4', '가라앉은 대성당 성소', '성소 · 문지기 그림자 오르말', '문지기 그림자 오르말', 'ormal'],
  ] as const).map(([key, name, place, boss, enc]): ContentDef => ({
    key, bosses: [boss], kind: 'raid', name, place, stageLv: 70, unlockLv: 70, ready: true, fights: () => [enc], size: () => 20, diffUnlock: { '악몽': 80 },
  })),
];

export const contentOf = (k: ContentKey) => CONTENT.find(c => c.key === k)!;

/** 콘텐츠 최소 레벨 = 열림 레벨 (난이도만 따로 잠긴 건 그 레벨). 실제 적 레벨은 내 레벨과 이것 중 큰 쪽 (runmode, 32) */
export const stageOf = (c: ContentDef, d: DiffName) => c.diffUnlock?.[d] ?? c.stageLv;

/** 레이드는 보스 1마리 처치마다 보상 (12 3-1) → 1층 = 보스 1 */
export const isRaid = (c: ContentDef) => c.kind === 'raid';

/** 레이드 인원 (보상 배율용): 던전·탐험 0, 10인 10, 20인 20 */
export const raidSize = (c: ContentDef): 0 | 10 | 20 => (c.kind !== 'raid' ? 0 : c.size('보통') >= 20 ? 20 : 10);

/**
 * 이 콘텐츠에 나오는 해제 유형 (27 3-1 모험 카드 해제 칩). 만든 전투는 그 전투들이 거는 디버프 (난이도 모두),
 * 아직 전투가 없는 던전은 세력의 대표 디버프 (11 3장: 세력 = 해제 유형). 빈 배열 = 물리만
 */
export function dispelsOf(c: ContentDef): string[] {
  const segs = ALL_DIFFS.flatMap(d => c.fights(d));
  if (segs.length) return [...new Set(segs.flatMap(k => ENCOUNTERS[k].debuffs || []))];
  return FACTIONS[PLACES[CONTENT_PLACE[c.key]].faction].dispel.slice();
}
