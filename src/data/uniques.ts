/**
 * 고유 무기 · 방어구 (34 6-10 ③, Lim 2026-10-10 「장비 갯수를 매우 다양하게」).
 * 떨어지는 곳 (Lim 2026-10-11 「20인 악몽으로 모음」, 61 3-4): 20인 레이드 31구역에 열림 레벨 순으로 고르게 (구역마다 2~4개, 같은 구역 · 부위는 하나), 그 구역 악몽 전설에서만.
 * 아래 묶음 주석 · 이름 · 효과는 처음 만든 보스에서 온 것 (예전엔 그 던전 · 레이드 칸에서 떨어졌음).
 * 효과 = 그 보스 기믹에 맞는 특수능력 하나를 UNIQUE_MULT배 값으로 고정 (굴림 없음) = 그 전설의 고유 능력 (data/equipment makeItem).
 * 나오는 규칙은 이름 있는 장신구와 같음: 그 장소에서 그 부위 전설이 나오면 NAMED_CHANCE (Lim 2026-10-11 「전설에만 고유 능력」). 그림 = item-unique-<키> (그림 요청 50)
 */
import type { ItemGrade, SlotKey } from './equipment';
import { SPECS, specValue } from './specials';

export interface UniqueDef {
  key: string;
  name: string;
  slot: Exclude<SlotKey, 'ring' | 'neck'>;
  /** 종류 (data/equipment KINDS): 고정 옵션 · 기본 그림이 그 종류 */
  kind: string;
  /** 떨어지는 장소 (콘텐츠 키) */
  place: string;
  placeName: string;
  /** 고정 특수능력 (data/specials SPECS, 그 부위에 나오는 것) */
  spec: string;
}

export const UNIQUE_MULT = 1.5;

export const UNIQUES: UniqueDef[] = [
  // 던전 ①~⑭
  { key: 'boilerGauntlet', name: '증기 보일러 건틀릿', slot: 'hands', kind: 'gauntlet', place: 'cathedral1', placeName: '가라앉은 대성당 1구역', spec: 'shieldFriend' },
  { key: 'malchorRobe', name: '말코어의 향 로브', slot: 'chest', kind: 'robe', place: 'cathedral1', placeName: '가라앉은 대성당 1구역', spec: 'coldMedicine' },
  { key: 'seresBracer', name: '세레스의 깃 팔찌', slot: 'hands', kind: 'bracer', place: 'cathedral2', placeName: '가라앉은 대성당 회랑', spec: 'antidote' },
  { key: 'belmoreWraps', name: '벨모어 경의 손싸개', slot: 'hands', kind: 'wraps', place: 'cathedral3', placeName: '가라앉은 대성당 오르간', spec: 'curseBreak' },
  { key: 'frostVestment', name: '탑주의 서리 법복', slot: 'chest', kind: 'vestment', place: 'cathedral2', placeName: '가라앉은 대성당 회랑', spec: 'spellWard' },
  { key: 'guardianHelm', name: '신전 수호상 투구', slot: 'head', kind: 'helm', place: 'cathedral3', placeName: '가라앉은 대성당 오르간', spec: 'cutBeat' },
  { key: 'sentinelMace', name: '파수꾼의 수정 메이스', slot: 'weapon', kind: 'mace', place: 'cathedral3', placeName: '가라앉은 대성당 오르간', spec: 'crystalBreak' },
  { key: 'ratkingHood', name: '쥐왕의 두건', slot: 'head', kind: 'hood', place: 'abbey2', placeName: '물밑 수도원 서고', spec: 'fadingMiasma' },
  { key: 'scholarStaff', name: '대학자의 얼음 지팡이', slot: 'weapon', kind: 'staff', place: 'abbey3', placeName: '물밑 수도원 제단', spec: 'insight' },
  { key: 'lilyRelic', name: '여사제의 백합 성물', slot: 'weapon', kind: 'relic', place: 'rootwood2', placeName: '빛뿌리 숲 온실', spec: 'edgeTouch' },
  { key: 'hatterPlume', name: '해롱의 깃털 모자', slot: 'head', kind: 'plume', place: 'rootwood3', placeName: '빛뿌리 숲 심장뿌리', spec: 'drumbeat' },
  { key: 'shellMail', name: '등딱지 무늬 사슬 조끼', slot: 'chest', kind: 'mail', place: 'reservoir2', placeName: '별빛 저수지 다리', spec: 'braveSong' },
  // 던전 ⑬ ⑭ (51 6장)
  { key: 'sulkyPlume', name: '불퉁이의 삐친 깃털 모자', slot: 'head', kind: 'plume', place: 'reservoir3', placeName: '별빛 저수지 거울호수', spec: 'hardShell' },
  { key: 'anvilHelm', name: '땅땅의 모루 투구', slot: 'head', kind: 'helm', place: 'well1', placeName: '숨결 우물 도르래', spec: 'cutBeat' },
  // 10인: 심연의 탑 2~4층
  { key: 'hydraCoat', name: '히드라 비늘 외투', slot: 'chest', kind: 'coat', place: 'cathedral4', placeName: '가라앉은 대성당 성소', spec: 'holdTogether' },
  { key: 'twinWraps', name: '쌍둥이 여군주의 손싸개', slot: 'hands', kind: 'wraps', place: 'cathedral4', placeName: '가라앉은 대성당 성소', spec: 'quickAid' },
  { key: 'orbenWand', name: '오르벤의 별 완드', slot: 'weapon', kind: 'wand', place: 'cathedral4', placeName: '가라앉은 대성당 성소', spec: 'constellation' },
  // 10인: 짠물 해적단
  { key: 'clawGauntlet', name: '갑판장의 집게 건틀릿', slot: 'hands', kind: 'gauntlet', place: 'abbey1', placeName: '물밑 수도원 연못', spec: 'hardShell' },
  { key: 'cookHabit', name: '왕솥의 앞치마 수도복', slot: 'chest', kind: 'habit', place: 'abbey1', placeName: '물밑 수도원 연못', spec: 'heartyMeal' },
  { key: 'gunnerPlume', name: '쾅쾅의 깃털 모자', slot: 'head', kind: 'plume', place: 'abbey3', placeName: '물밑 수도원 제단', spec: 'shelterMap' },
  { key: 'inkRobe', name: '꾸물이 먹물 로브', slot: 'chest', kind: 'robe', place: 'abbey3', placeName: '물밑 수도원 제단', spec: 'warmCloak' },
  { key: 'mimicScepter', name: '덥석이 이빨 홀', slot: 'weapon', kind: 'scepter', place: 'rootwood1', placeName: '빛뿌리 숲 입구', spec: 'kindCrit' },
  { key: 'parrotCrown', name: '깍깍 깃 관', slot: 'head', kind: 'crown', place: 'rootwood1', placeName: '빛뿌리 숲 입구', spec: 'starClock' },
  // 10인: 버섯 요정단
  { key: 'songiWreath', name: '송이 경비대 화관', slot: 'head', kind: 'wreath', place: 'rootwood2', placeName: '빛뿌리 숲 온실', spec: 'firstWord' },
  { key: 'bandSleeve', name: '삘릴리 악단 토시', slot: 'hands', kind: 'sleeve', place: 'rootwood2', placeName: '빛뿌리 숲 온실', spec: 'busyHands' },
  { key: 'mossStaff', name: '뭉게 이끼 지팡이', slot: 'weapon', kind: 'staff', place: 'rootwood3', placeName: '빛뿌리 숲 심장뿌리', spec: 'eliteHunter' },
  { key: 'lilypadHabit', name: '개굴 연잎 수도복', slot: 'chest', kind: 'habit', place: 'rootwood3', placeName: '빛뿌리 숲 심장뿌리', spec: 'sturdyBack' },
  { key: 'hiveGloves', name: '붕붕 벌집 장갑', slot: 'hands', kind: 'gloves', place: 'reservoir1', placeName: '별빛 저수지 수문', spec: 'woundClean' },
  { key: 'magicCrown', name: '뿅뿅 마술 관', slot: 'head', kind: 'crown', place: 'reservoir1', placeName: '별빛 저수지 수문', spec: 'numberSense' },
  // 묶음 D1 (51 6장): 폭탄 해체반은 몸통 · 끊기 박자는 머리에만 나와서 꼬질 · 땅땅 것은 51의 메이스 · 건틀릿 대신 외투 · 투구
  { key: 'kkojilCoat', name: '꼬질의 보물 지킴이 외투', slot: 'chest', kind: 'coat', place: 'reservoir3', placeName: '별빛 저수지 거울호수', spec: 'bombSquad' },
  { key: 'cartGloves', name: '덜컹이 바퀴 장갑', slot: 'hands', kind: 'gloves', place: 'reservoir3', placeName: '별빛 저수지 거울호수', spec: 'hardShell' },
  // 묶음 D2 (51 6장): 정예 사냥꾼은 무기에만 나와서 삼남매 것은 51의 수도복 대신 홀
  { key: 'eggScepter', name: '삼남매 알껍데기 홀', slot: 'weapon', kind: 'scepter', place: 'reservoir3', placeName: '별빛 저수지 거울호수', spec: 'eliteHunter' },
  { key: 'scaleBracer', name: '단단이 비늘 토시', slot: 'hands', kind: 'bracer', place: 'well1', placeName: '숨결 우물 도르래', spec: 'shieldFriend' },
  // 묶음 E1 (54 6장): 10인 ⑩ 입구 · 골목, 던전 ⑮ (이름 있는 장신구가 반지라 장갑)
  { key: 'drowsyHelm', name: '꾸벅 · 끄덕 졸음 투구', slot: 'head', kind: 'helm', place: 'crystal1', placeName: '수정 뿌리굴 갈림길', spec: 'drumbeat' },
  { key: 'spiceWraps', name: '혹돌이 향신료 손싸개', slot: 'hands', kind: 'wraps', place: 'well3', placeName: '숨결 우물 바닥', spec: 'coldMedicine' },
  { key: 'bandageGloves', name: '둘둘이의 붕대 장갑', slot: 'hands', kind: 'gloves', place: 'crystal2', placeName: '수정 뿌리굴 수정밭', spec: 'woundClean' },
  // 20인: 가라앉은 대성당 (2 · 3구역은 묶음 D2, 숫자 감각은 머리에만 나와서 우웅이 것은 51의 완드 대신 관)
  { key: 'sunkenVestment', name: '가라앉은 대성당 법복', slot: 'chest', kind: 'vestment', place: 'well2', placeName: '숨결 우물 이끼벽', spec: 'encore' },
  { key: 'knightHelm', name: '물그림자 기사 투구', slot: 'head', kind: 'helm', place: 'well2', placeName: '숨결 우물 이끼벽', spec: 'holdTogether' },
  { key: 'pipeCrown', name: '우웅이 파이프 관', slot: 'head', kind: 'crown', place: 'well3', placeName: '숨결 우물 바닥', spec: 'numberSense' },
  // 20인 ② 물밑 수도원 (묶음 E1): 연못 · 서고
  { key: 'jellyVestment', name: '흐물이 해파리 법복', slot: 'chest', kind: 'vestment', place: 'crystal1', placeName: '수정 뿌리굴 갈림길', spec: 'wideEmbrace' },
  { key: 'mirrorWand', name: '비추미 거울 완드', slot: 'weapon', kind: 'wand', place: 'crystal1', placeName: '수정 뿌리굴 갈림길', spec: 'bounceLight' },
  // 묶음 E2 (54 6장): 10인 ⑪ 분수 · 보물고 (보물고 메달은 장신구라 투구), 20인 ③ 입구 · 온실
  { key: 'sandWreath', name: '솔솔 · 살살 모래 화관', slot: 'head', kind: 'wreath', place: 'crystal2', placeName: '수정 뿌리굴 수정밭', spec: 'stillMoment' },
  { key: 'shellHelm', name: '엉금이 등껍질 투구', slot: 'head', kind: 'helm', place: 'crystal3', placeName: '수정 뿌리굴 거울방', spec: 'hardShell' },
  { key: 'rootGauntlet', name: '뚜벅이 뿌리 건틀릿', slot: 'hands', kind: 'gauntlet', place: 'crystal3', placeName: '수정 뿌리굴 거울방', spec: 'heavyFeet' },
  { key: 'seedHabit', name: '톡톡 씨앗 수도복', slot: 'chest', kind: 'habit', place: 'crystal3', placeName: '수정 뿌리굴 거울방', spec: 'bombSquad' },
  // 묶음 E3 (54 6장): 10인 ⑫ 복도 · 시계방, 20인 ④ 수문 (사슬 끊는 손은 무기에만 나와서 사슬 조끼 대신 메이스) · 다리, 던전 ⑯
  { key: 'pillowHabit', name: '폭신이 베개 수도복', slot: 'chest', kind: 'habit', place: 'shadow1', placeName: '그림자 성벽 성문', spec: 'sturdyBack' },
  { key: 'hourglassBracer', name: '째깍이 모래시계 팔찌', slot: 'hands', kind: 'bracer', place: 'shadow1', placeName: '그림자 성벽 성문', spec: 'busyHands' },
  { key: 'clawMace', name: '딱딱이 집게 메이스', slot: 'weapon', kind: 'mace', place: 'shadow2', placeName: '그림자 성벽 성벽길', spec: 'chainBreaker' },
  { key: 'sparkSleeve', name: '찌릿 번개 토시', slot: 'hands', kind: 'sleeve', place: 'shadow2', placeName: '그림자 성벽 성벽길', spec: 'thrifty' },
  { key: 'sundialCrown', name: '그늘지기의 해시계 관', slot: 'head', kind: 'crown', place: 'shadow3', placeName: '그림자 성벽 망루', spec: 'starClock' },
  // 묶음 F1 (56 6장): 20인 ⑤ 도르래 · 이끼벽 (수도복은 낮잠 피라미드 복도와 겹쳐 로브로), 10인 ⑬ 접수대 · 분류실, 던전 ⑰
  { key: 'bucketHood', name: '출렁이 두레박 두건', slot: 'head', kind: 'hood', place: 'camp1', placeName: '그림자 진영 막사', spec: 'numberSense' },
  { key: 'mossRobe', name: '푸석이 이끼 로브', slot: 'chest', kind: 'robe', place: 'shadow3', placeName: '그림자 성벽 망루', spec: 'fadingMiasma' },
  { key: 'courierPlume', name: '휘리릭 우편 깃털 모자', slot: 'head', kind: 'plume', place: 'camp2', placeName: '그림자 진영 훈련장', spec: 'drumbeat' },
  { key: 'ribbonGloves', name: '꽁꽁이 리본 장갑', slot: 'hands', kind: 'gloves', place: 'camp1', placeName: '그림자 진영 막사', spec: 'layer' },
  { key: 'vaneScepter', name: '돌개의 풍차 날개 홀', slot: 'weapon', kind: 'scepter', place: 'camp2', placeName: '그림자 진영 훈련장', spec: 'bounceLight' },
  // 묶음 F2 (56 6장): 20인 ⑥ 갈림길 · 수정밭, 10인 ⑭ 성문 · 무기고 (56의 땅땅이는 용암 대장간 땅땅과 겹쳐 굴굴이로)
  { key: 'crystalPick', name: '굴굴이 수정 곡괭이', slot: 'weapon', kind: 'mace', place: 'camp3', placeName: '그림자 진영 지휘소', spec: 'insight' },
  { key: 'pinwheelHabit', name: '핑핑이 바람개비 수도복', slot: 'chest', kind: 'habit', place: 'camp3', placeName: '그림자 진영 지휘소', spec: 'woundClean' },
  { key: 'drumHelm', name: '둥둥이 천둥 북 투구', slot: 'head', kind: 'helm', place: 'camp3', placeName: '그림자 진영 지휘소', spec: 'drumbeat' },
  // 묶음 F3 (56 6장): 20인 ⑦ 성문 · 성벽길, 던전 ⑱
  { key: 'shadowHammer', name: '쾅쾅이 그림자 망치', slot: 'weapon', kind: 'mace', place: 'coast1', placeName: '어둠물 해안 선착장', spec: 'bounceLight' },
  { key: 'fletchSleeve', name: '슝슝이 화살깃 토시', slot: 'hands', kind: 'sleeve', place: 'coast1', placeName: '어둠물 해안 선착장', spec: 'evenly' },
  { key: 'upsideVestment', name: '뒤죽박죽의 거꾸로 법복', slot: 'chest', kind: 'vestment', place: 'coast2', placeName: '어둠물 해안 물길', spec: 'lingerLight' },
  { key: 'lanceWraps', name: '쌩쌩이 번개 창 손싸개', slot: 'hands', kind: 'wraps', place: 'camp3', placeName: '그림자 진영 지휘소', spec: 'shieldFriend' },
  // 묶음 G1 (59 6장): 10인 ⑮ 입구 · 회랑, 20인 ⑧ 막사 · 훈련장, 던전 ⑲
  { key: 'tollHelm', name: '그믐 통행세 투구', slot: 'head', kind: 'helm', place: 'coast2', placeName: '어둠물 해안 물길', spec: 'numberSense' },
  { key: 'webGloves', name: '실타래 거미줄 장갑', slot: 'hands', kind: 'gloves', place: 'coast3', placeName: '어둠물 해안 소용돌이', spec: 'layer' },
  { key: 'galeLance', name: '질풍 기병창', slot: 'weapon', kind: 'staff', place: 'coast3', placeName: '어둠물 해안 소용돌이', spec: 'bounceLight' },
  { key: 'hornSleeve', name: '우레발 뿔 토시', slot: 'hands', kind: 'sleeve', place: 'heart1', placeName: '심연의 심장 뿌리다리', spec: 'sturdyBack' },
  { key: 'valenRapier', name: '발렌의 은빛 레이피어', slot: 'weapon', kind: 'scepter', place: 'heart2', placeName: '심연의 심장 심장문', spec: 'bounceLight' },
  // 묶음 G2 (59 6장): 20인 ⑨ 선착장 · 물길
  { key: 'oarStaff', name: '잔물결 뱃사공 노', slot: 'weapon', kind: 'staff', place: 'heart1', placeName: '심연의 심장 뿌리다리', spec: 'insight' },
  { key: 'eelVest', name: '휘감이 비늘 조끼', slot: 'chest', kind: 'mail', place: 'heart1', placeName: '심연의 심장 뿌리다리', spec: 'woundClean' },
  // 묶음 G3 (59 6장): 20인 ⑩ 뿌리다리 · 심장문, 던전 ⑳ (뿌리다리 장화는 신발 칸이 없어 건틀릿)
  { key: 'tangleGauntlet', name: '얽힘 뿌리 건틀릿', slot: 'hands', kind: 'gauntlet', place: 'heart2', placeName: '심연의 심장 심장문', spec: 'fadingMiasma' },
  { key: 'lordCrown', name: '군주의 그림자 왕관', slot: 'head', kind: 'crown', place: 'heart3', placeName: '심연의 심장 심실', spec: 'drumbeat' },
  { key: 'scaleRobe', name: '녹슬음의 낡은 저울 로브', slot: 'chest', kind: 'robe', place: 'heart3', placeName: '심연의 심장 심실', spec: 'layer' },
];

export const uniqueOf = (key: string | undefined) => (key ? UNIQUES.find(u => u.key === key) : undefined);
/** 그 장소 · 부위에서 나오는 고유 장비 */
/** 그 장소 · 부위에서 나오는 고유 장비 (20인 구역, 61 3-4). 목록이지만 지금은 구역 · 부위마다 하나 */
export const uniquesFor = (place: string, slot: SlotKey) => UNIQUES.filter(u => u.place === place && u.slot === slot);
/** 고정 특수능력 값: 그 등급 최대 굴림 × UNIQUE_MULT. 값 고정 특수능력은 그대로 */
export const uniqueValue = (u: UniqueDef, grade: ItemGrade) => (SPECS[u.spec]?.fixed ? SPECS[u.spec].val : specValue(u.spec, grade, 1) * UNIQUE_MULT);
