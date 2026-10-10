/**
 * 고유 무기 · 방어구 (34 6-10 ③, Lim 2026-10-10 「장비 갯수를 매우 다양하게」).
 * 던전마다 1개 (그 던전 어느 보스에서나, 이름 있는 장신구와 다른 부위), 레이드는 이름 있는 장신구가 없는 칸마다 1개 (10인 마지막이 아닌 칸 · 20인 구역).
 * 효과 = 그 보스 기믹에 맞는 특수능력 하나를 UNIQUE_MULT배 값으로 고정 (굴림 없음). 나머지 특수능력 줄은 등급대로 굴림 (data/equipment makeItem).
 * 나오는 규칙은 이름 있는 장신구와 같음: 그 장소에서 그 부위 희귀 이상이 나오면 NAMED_CHANCE. 그림 = item-unique-<키> (그림 요청 50)
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
  { key: 'boilerGauntlet', name: '증기 보일러 건틀릿', slot: 'hands', kind: 'gauntlet', place: 'rustfort', placeName: '녹슨 요새', spec: 'shieldFriend' },
  { key: 'malchorRobe', name: '말코어의 향 로브', slot: 'chest', kind: 'robe', place: 'crypt', placeName: '역병 지하묘지', spec: 'coldMedicine' },
  { key: 'seresBracer', name: '세레스의 깃 팔찌', slot: 'hands', kind: 'bracer', place: 'swamp', placeName: '독안개 늪', spec: 'antidote' },
  { key: 'belmoreWraps', name: '벨모어 경의 손싸개', slot: 'hands', kind: 'wraps', place: 'manor', placeName: '저주받은 장원', spec: 'curseBreak' },
  { key: 'frostVestment', name: '탑주의 서리 법복', slot: 'chest', kind: 'vestment', place: 'frost', placeName: '서리 마탑', spec: 'spellWard' },
  { key: 'guardianHelm', name: '신전 수호상 투구', slot: 'head', kind: 'helm', place: 'temple', placeName: '깨진 신전', spec: 'cutBeat' },
  { key: 'sentinelMace', name: '파수꾼의 수정 메이스', slot: 'weapon', kind: 'mace', place: 'watchtower', placeName: '무너진 망루', spec: 'crystalBreak' },
  { key: 'ratkingHood', name: '쥐왕의 두건', slot: 'head', kind: 'hood', place: 'sewer', placeName: '역병 수로', spec: 'fadingMiasma' },
  { key: 'scholarStaff', name: '대학자의 얼음 지팡이', slot: 'weapon', kind: 'staff', place: 'archive', placeName: '얼음 서고', spec: 'insight' },
  { key: 'lilyRelic', name: '여사제의 백합 성물', slot: 'weapon', kind: 'relic', place: 'ossuary', placeName: '백합 납골당', spec: 'edgeTouch' },
  { key: 'hatterPlume', name: '해롱의 깃털 모자', slot: 'head', kind: 'plume', place: 'teaparty', placeName: '끝없는 다과회', spec: 'drumbeat' },
  { key: 'shellMail', name: '등딱지 무늬 사슬 조끼', slot: 'chest', kind: 'mail', place: 'mossroot', placeName: '이끼 뿌리 사원', spec: 'braveSong' },
  // 던전 ⑬ ⑭ (51 6장)
  { key: 'sulkyPlume', name: '불퉁이의 삐친 깃털 모자', slot: 'head', kind: 'plume', place: 'hotspring', placeName: '용암 온천장', spec: 'hardShell' },
  { key: 'anvilHelm', name: '땅땅의 모루 투구', slot: 'head', kind: 'helm', place: 'forge', placeName: '용암 대장간', spec: 'cutBeat' },
  // 10인: 심연의 탑 2~4층
  { key: 'hydraCoat', name: '히드라 비늘 외투', slot: 'chest', kind: 'coat', place: 'abyss2', placeName: '심연의 탑 2층', spec: 'holdTogether' },
  { key: 'twinWraps', name: '쌍둥이 여군주의 손싸개', slot: 'hands', kind: 'wraps', place: 'abyss3', placeName: '심연의 탑 3층', spec: 'quickAid' },
  { key: 'orbenWand', name: '오르벤의 별 완드', slot: 'weapon', kind: 'wand', place: 'abyss4', placeName: '심연의 탑 4층', spec: 'constellation' },
  // 10인: 짠물 해적단
  { key: 'clawGauntlet', name: '갑판장의 집게 건틀릿', slot: 'hands', kind: 'gauntlet', place: 'gull1', placeName: '갈매기 항구 부두', spec: 'hardShell' },
  { key: 'cookHabit', name: '왕솥의 앞치마 수도복', slot: 'chest', kind: 'habit', place: 'gull2', placeName: '갈매기 항구 주방', spec: 'heartyMeal' },
  { key: 'gunnerPlume', name: '쾅쾅의 깃털 모자', slot: 'head', kind: 'plume', place: 'queen1', placeName: '짠물 여왕호 갑판', spec: 'shelterMap' },
  { key: 'inkRobe', name: '꾸물이 먹물 로브', slot: 'chest', kind: 'robe', place: 'queen2', placeName: '짠물 여왕호 창고', spec: 'warmCloak' },
  { key: 'mimicScepter', name: '덥석이 이빨 홀', slot: 'weapon', kind: 'scepter', place: 'isle1', placeName: '보물섬 요새 동굴', spec: 'kindCrit' },
  { key: 'parrotCrown', name: '깍깍 깃 관', slot: 'head', kind: 'crown', place: 'isle2', placeName: '보물섬 요새 망루', spec: 'starClock' },
  // 10인: 버섯 요정단
  { key: 'songiWreath', name: '송이 경비대 화관', slot: 'head', kind: 'wreath', place: 'fest1', placeName: '요정 축제 마당 어귀', spec: 'firstWord' },
  { key: 'bandSleeve', name: '삘릴리 악단 토시', slot: 'hands', kind: 'sleeve', place: 'fest2', placeName: '요정 축제 마당 무대', spec: 'busyHands' },
  { key: 'mossStaff', name: '뭉게 이끼 지팡이', slot: 'weapon', kind: 'staff', place: 'cave1', placeName: '포자 동굴 정원 이끼굴', spec: 'eliteHunter' },
  { key: 'lilypadHabit', name: '개굴 연잎 수도복', slot: 'chest', kind: 'habit', place: 'cave2', placeName: '포자 동굴 정원 연못', spec: 'sturdyBack' },
  { key: 'hiveGloves', name: '붕붕 벌집 장갑', slot: 'hands', kind: 'gloves', place: 'palace1', placeName: '버섯 여왕의 궁전 정원', spec: 'woundClean' },
  { key: 'magicCrown', name: '뿅뿅 마술 관', slot: 'head', kind: 'crown', place: 'palace2', placeName: '버섯 여왕의 궁전 연회장', spec: 'numberSense' },
  // 묶음 D1 (51 6장): 폭탄 해체반은 몸통 · 끊기 박자는 머리에만 나와서 꼬질 · 땅땅 것은 51의 메이스 · 건틀릿 대신 외투 · 투구
  { key: 'kkojilCoat', name: '꼬질의 보물 지킴이 외투', slot: 'chest', kind: 'coat', place: 'den1', placeName: '코볼트 보물 굴 갱도', spec: 'bombSquad' },
  { key: 'cartGloves', name: '덜컹이 바퀴 장갑', slot: 'hands', kind: 'gloves', place: 'den2', placeName: '코볼트 보물 굴 수레길', spec: 'hardShell' },
  // 묶음 D2 (51 6장): 정예 사냥꾼은 무기에만 나와서 삼남매 것은 51의 수도복 대신 홀
  { key: 'eggScepter', name: '삼남매 알껍데기 홀', slot: 'weapon', kind: 'scepter', place: 'nest1', placeName: '어미 용의 둥지 알둥지', spec: 'eliteHunter' },
  { key: 'scaleBracer', name: '단단이 비늘 토시', slot: 'hands', kind: 'bracer', place: 'nest2', placeName: '어미 용의 둥지 다리', spec: 'shieldFriend' },
  // 묶음 E1 (54 6장): 10인 ⑩ 입구 · 골목, 던전 ⑮ (이름 있는 장신구가 반지라 장갑)
  { key: 'drowsyHelm', name: '꾸벅 · 끄덕 졸음 투구', slot: 'head', kind: 'helm', place: 'bazaar1', placeName: '노을 시장 입구', spec: 'drumbeat' },
  { key: 'spiceWraps', name: '혹돌이 향신료 손싸개', slot: 'hands', kind: 'wraps', place: 'bazaar2', placeName: '노을 시장 골목', spec: 'coldMedicine' },
  { key: 'bandageGloves', name: '둘둘이의 붕대 장갑', slot: 'hands', kind: 'gloves', place: 'hourglass', placeName: '모래시계 궁전', spec: 'woundClean' },
  // 20인: 가라앉은 대성당 (2 · 3구역은 묶음 D2, 숫자 감각은 머리에만 나와서 우웅이 것은 51의 완드 대신 관)
  { key: 'sunkenVestment', name: '가라앉은 대성당 법복', slot: 'chest', kind: 'vestment', place: 'cathedral1', placeName: '가라앉은 대성당 1구역', spec: 'encore' },
  { key: 'knightHelm', name: '물그림자 기사 투구', slot: 'head', kind: 'helm', place: 'cathedral2', placeName: '가라앉은 대성당 회랑', spec: 'holdTogether' },
  { key: 'pipeCrown', name: '우웅이 파이프 관', slot: 'head', kind: 'crown', place: 'cathedral3', placeName: '가라앉은 대성당 오르간', spec: 'numberSense' },
  // 20인 ② 물밑 수도원 (묶음 E1): 연못 · 서고
  { key: 'jellyVestment', name: '흐물이 해파리 법복', slot: 'chest', kind: 'vestment', place: 'abbey1', placeName: '물밑 수도원 연못', spec: 'wideEmbrace' },
  { key: 'mirrorWand', name: '비추미 거울 완드', slot: 'weapon', kind: 'wand', place: 'abbey2', placeName: '물밑 수도원 서고', spec: 'bounceLight' },
  // 묶음 E2 (54 6장): 10인 ⑪ 분수 · 보물고 (보물고 메달은 장신구라 투구), 20인 ③ 입구 · 온실
  { key: 'sandWreath', name: '솔솔 · 살살 모래 화관', slot: 'head', kind: 'wreath', place: 'dusk1', placeName: '노을 궁전 분수', spec: 'stillMoment' },
  { key: 'shellHelm', name: '엉금이 등껍질 투구', slot: 'head', kind: 'helm', place: 'dusk2', placeName: '노을 궁전 보물고', spec: 'hardShell' },
  { key: 'rootGauntlet', name: '뚜벅이 뿌리 건틀릿', slot: 'hands', kind: 'gauntlet', place: 'rootwood1', placeName: '빛뿌리 숲 입구', spec: 'heavyFeet' },
  { key: 'seedHabit', name: '톡톡 씨앗 수도복', slot: 'chest', kind: 'habit', place: 'rootwood2', placeName: '빛뿌리 숲 온실', spec: 'bombSquad' },
  // 묶음 E3 (54 6장): 10인 ⑫ 복도 · 시계방, 20인 ④ 수문 (사슬 끊는 손은 무기에만 나와서 사슬 조끼 대신 메이스) · 다리, 던전 ⑯
  { key: 'pillowHabit', name: '폭신이 베개 수도복', slot: 'chest', kind: 'habit', place: 'pyramid1', placeName: '낮잠 피라미드 복도', spec: 'sturdyBack' },
  { key: 'hourglassBracer', name: '째깍이 모래시계 팔찌', slot: 'hands', kind: 'bracer', place: 'pyramid2', placeName: '낮잠 피라미드 시계방', spec: 'busyHands' },
  { key: 'clawMace', name: '딱딱이 집게 메이스', slot: 'weapon', kind: 'mace', place: 'reservoir1', placeName: '별빛 저수지 수문', spec: 'chainBreaker' },
  { key: 'sparkSleeve', name: '찌릿 번개 토시', slot: 'hands', kind: 'sleeve', place: 'reservoir2', placeName: '별빛 저수지 다리', spec: 'thrifty' },
  { key: 'sundialCrown', name: '그늘지기의 해시계 관', slot: 'head', kind: 'crown', place: 'observatory', placeName: '해시계 천문대', spec: 'starClock' },
  // 묶음 F1 (56 6장): 20인 ⑤ 도르래 · 이끼벽 (수도복은 낮잠 피라미드 복도와 겹쳐 로브로), 10인 ⑬ 접수대 · 분류실, 던전 ⑰
  { key: 'bucketHood', name: '출렁이 두레박 두건', slot: 'head', kind: 'hood', place: 'well1', placeName: '숨결 우물 도르래', spec: 'numberSense' },
  { key: 'mossRobe', name: '푸석이 이끼 로브', slot: 'chest', kind: 'robe', place: 'well2', placeName: '숨결 우물 이끼벽', spec: 'fadingMiasma' },
  { key: 'courierPlume', name: '휘리릭 우편 깃털 모자', slot: 'head', kind: 'plume', place: 'post1', placeName: '구름 우체국 접수대', spec: 'drumbeat' },
  { key: 'ribbonGloves', name: '꽁꽁이 리본 장갑', slot: 'hands', kind: 'gloves', place: 'post2', placeName: '구름 우체국 분류실', spec: 'layer' },
  { key: 'vaneScepter', name: '돌개의 풍차 날개 홀', slot: 'weapon', kind: 'scepter', place: 'windmill', placeName: '천둥 풍차', spec: 'bounceLight' },
  // 묶음 F2 (56 6장): 20인 ⑥ 갈림길 · 수정밭, 10인 ⑭ 성문 · 무기고 (56의 땅땅이는 용암 대장간 땅땅과 겹쳐 굴굴이로)
  { key: 'crystalPick', name: '굴굴이 수정 곡괭이', slot: 'weapon', kind: 'mace', place: 'crystal1', placeName: '수정 뿌리굴 갈림길', spec: 'insight' },
  { key: 'pinwheelHabit', name: '핑핑이 바람개비 수도복', slot: 'chest', kind: 'habit', place: 'crystal2', placeName: '수정 뿌리굴 수정밭', spec: 'woundClean' },
  { key: 'drumHelm', name: '둥둥이 천둥 북 투구', slot: 'head', kind: 'helm', place: 'fort1', placeName: '폭풍 성채 성문', spec: 'drumbeat' },
  // 묶음 F3 (56 6장): 20인 ⑦ 성문 · 성벽길, 던전 ⑱
  { key: 'shadowHammer', name: '쾅쾅이 그림자 망치', slot: 'weapon', kind: 'mace', place: 'shadow1', placeName: '그림자 성벽 성문', spec: 'bounceLight' },
  { key: 'fletchSleeve', name: '슝슝이 화살깃 토시', slot: 'hands', kind: 'sleeve', place: 'shadow2', placeName: '그림자 성벽 성벽길', spec: 'evenly' },
  { key: 'upsideVestment', name: '뒤죽박죽의 거꾸로 법복', slot: 'chest', kind: 'vestment', place: 'school', placeName: '구름 마법학교', spec: 'lingerLight' },
  { key: 'lanceWraps', name: '쌩쌩이 번개 창 손싸개', slot: 'hands', kind: 'wraps', place: 'fort2', placeName: '폭풍 성채 무기고', spec: 'shieldFriend' },
  // 묶음 G1 (59 6장): 10인 ⑮ 입구 · 회랑, 20인 ⑧ 막사 · 훈련장, 던전 ⑲
  { key: 'tollHelm', name: '그믐 통행세 투구', slot: 'head', kind: 'helm', place: 'maze1', placeName: '그림자 미궁 입구', spec: 'numberSense' },
  { key: 'webGloves', name: '실타래 거미줄 장갑', slot: 'hands', kind: 'gloves', place: 'maze2', placeName: '그림자 미궁 회랑', spec: 'layer' },
  { key: 'galeLance', name: '질풍 기병창', slot: 'weapon', kind: 'staff', place: 'camp1', placeName: '그림자 진영 막사', spec: 'bounceLight' },
  { key: 'hornSleeve', name: '우레발 뿔 토시', slot: 'hands', kind: 'sleeve', place: 'camp2', placeName: '그림자 진영 훈련장', spec: 'sturdyBack' },
  { key: 'valenRapier', name: '발렌의 은빛 레이피어', slot: 'weapon', kind: 'scepter', place: 'ballroom', placeName: '가라앉은 무도회장', spec: 'bounceLight' },
  // 묶음 G2 (59 6장): 20인 ⑨ 선착장 · 물길
  { key: 'oarStaff', name: '잔물결 뱃사공 노', slot: 'weapon', kind: 'staff', place: 'coast1', placeName: '어둠물 해안 선착장', spec: 'insight' },
  { key: 'eelVest', name: '휘감이 비늘 조끼', slot: 'chest', kind: 'mail', place: 'coast2', placeName: '어둠물 해안 물길', spec: 'woundClean' },
];

export const uniqueOf = (key: string | undefined) => (key ? UNIQUES.find(u => u.key === key) : undefined);
/** 그 장소 · 부위에서 나오는 고유 장비 */
export const uniqueFor = (place: string, slot: SlotKey) => UNIQUES.find(u => u.place === place && u.slot === slot);
/** 고정 특수능력 값: 그 등급 최대 굴림 × UNIQUE_MULT. 값 고정 특수능력은 그대로 */
export const uniqueValue = (u: UniqueDef, grade: ItemGrade) => (SPECS[u.spec]?.fixed ? SPECS[u.spec].val : specValue(u.spec, grade, 1) * UNIQUE_MULT);
