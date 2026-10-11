/**
 * 로비 「살아 있는 마을」 장면 목록 (2026-10-11 코덱스 village-living-background 시안 manifest.json에서 옮김).
 * 좌표·크기·잘라내기 다각형은 원본 그림 853×1844 기준. 그림 이름은 src/art의 village-<원본 파일 이름> (바탕 = village-base).
 * 승인된 모션 값 그대로: 구름 9개 (서로 다른 속도, 산·성 뒤로 가림) · 가지·잎·꽃 초기 진폭 ×2.4 · 덩굴 ×2.1 · 깃발 ×3 · 차양 ×1.35 · 기본 바람 35%.
 * 사용자 요청 없이 진폭을 줄이거나 부착점·가림 관계를 바꾸지 않는다.
 * 종탑의 종 레이어(chapel-bell)는 뺐다 (10 4장 「종에 관한 것은 모두 빼자」). 바탕 그림의 탑 창은 원래 비어 있다.
 */
export type VillageGroup = 'clouds' | 'foliage' | 'birds' | 'cloth' | 'water' | 'lights';
export type Poly = readonly (readonly [number, number])[];

export interface VillageLayer {
  id: string;
  /** src/art 그림 이름 */
  art: string;
  group: VillageGroup;
  motion?: 'cloud' | 'branch' | 'vine' | 'flag' | 'awning' | 'bird' | 'static';
  x: number; y: number; width: number; height: number;
  /** 부착점 (그림 안 비율) */
  anchor?: readonly [number, number];
  pin?: 'top' | 'left' | 'right';
  amplitude?: number;
  phase?: number;
  /** 구름 속도 */
  speed?: number;
  z?: number;
  alpha?: number;
  rotation?: number;
  flipX?: boolean;
  /** 이 다각형 안에만 보임 (구름 = 산·성 뒤) */
  clip?: Poly;
}

export interface VillageEffects {
  waterPaths: { id: string; direction: readonly [number, number]; density: number; polygon: Poly }[];
  waterfalls: { id: string; direction: readonly [number, number]; density: number; polygon: Poly }[];
  lights: { id: string; x: number; y: number; radius: number; alpha?: number }[];
  motes: { x: number; y: number }[];
  /** 그림 새가 따로 있으면 그린 새는 끔 */
  birds: boolean;
}

/** 하늘: 산·성 실루엣 위로만 구름 */
const CLIP_SKY: Poly = [[0, 0], [853, 0], [853, 40], [785, 69], [753, 92], [735, 77], [720, 50], [704, 28], [687, 8], [674, 65], [661, 87], [647, 67], [633, 69], [613, 121], [597, 97], [577, 132], [549, 153], [525, 144], [493, 145], [463, 140], [437, 147], [410, 129], [395, 130], [348, 101], [308, 122], [275, 111], [240, 111], [193, 116], [145, 88], [93, 92], [32, 87], [0, 91]];
/** 예배당 앞 고정 전경: 뒤쪽 나무가 건물 뒤로 들어가게 바탕을 한 번 더 덮음 */
const CLIP_CHAPEL: Poly = [[0, 519], [59, 437], [72, 384], [69, 357], [94, 332], [111, 301], [123, 337], [149, 353], [158, 328], [184, 310], [204, 297], [218, 263], [225, 300], [247, 312], [274, 346], [278, 327], [290, 294], [295, 272], [301, 308], [318, 323], [315, 355], [330, 369], [337, 389], [352, 403], [355, 435], [403, 464], [432, 474], [455, 498], [853, 500], [853, 1844], [0, 1844]];

export const VILLAGE = {
  width: 853,
  height: 1844,
  background: 'village-base',
  defaultWind: 35,
  layers: [
    { id: 'cloud-distant-west', art: 'village-cloud-wide', group: 'clouds', motion: 'cloud', x: 67, y: 37, width: 184, height: 64, anchor: [0, 0], amplitude: 2.8, phase: 0.051, speed: 0.42, z: 0.1, alpha: 0.56, clip: CLIP_SKY },
    { id: 'cloud-distant-middle', art: 'village-cloud-wide', group: 'clouds', motion: 'cloud', x: 336, y: 42, width: 175, height: 62, anchor: [0, 0], amplitude: 2.8, phase: 2.451, speed: 0.51, z: 0.2, alpha: 0.62, clip: CLIP_SKY },
    { id: 'cloud-distant-east', art: 'village-cloud-wide', group: 'clouds', motion: 'cloud', x: 601, y: 31, width: 179, height: 66, anchor: [0, 0], amplitude: 2.8, phase: 4.851, speed: 0.47, z: 0.3, alpha: 0.58, clip: CLIP_SKY },
    { id: 'cloud-west', art: 'village-cloud-wide', group: 'clouds', motion: 'cloud', x: -100, y: -28, width: 202, height: 95, anchor: [0, 0], amplitude: 2.8, phase: 0, speed: 0.68, z: 1, alpha: 0.83, clip: CLIP_SKY },
    { id: 'cloud-middle', art: 'village-cloud-round', group: 'clouds', motion: 'cloud', x: 198, y: -15, width: 137, height: 86, anchor: [0, 0], amplitude: 2.8, phase: 2.4, speed: 1.06, z: 2, alpha: 0.94, clip: CLIP_SKY },
    { id: 'cloud-near-west', art: 'village-cloud-round', group: 'clouds', motion: 'cloud', x: 88, y: -12, width: 166, height: 90, anchor: [0, 0], amplitude: 2.8, phase: 0.968, speed: 0.95, z: 2.2, alpha: 0.87, clip: CLIP_SKY },
    { id: 'cloud-near-middle', art: 'village-cloud-round', group: 'clouds', motion: 'cloud', x: 357, y: -22, width: 172, height: 99, anchor: [0, 0], amplitude: 2.8, phase: 3.368, speed: 0.79, z: 2.8, alpha: 0.84, clip: CLIP_SKY },
    { id: 'cloud-east', art: 'village-cloud-wide', group: 'clouds', motion: 'cloud', x: 478, y: -32, width: 210, height: 99, anchor: [0, 0], amplitude: 2.8, phase: 4.8, speed: 0.87, z: 3, alpha: 0.88, clip: CLIP_SKY },
    { id: 'cloud-small', art: 'village-cloud-round', group: 'clouds', motion: 'cloud', x: 755, y: -17, width: 104, height: 70, anchor: [0, 0], amplitude: 2.8, phase: 0.917, speed: 1.24, z: 4, alpha: 0.75, clip: CLIP_SKY },
    { id: 'tree-west-back', art: 'village-tree-pine', group: 'foliage', motion: 'branch', x: 109, y: 144, width: 145, height: 303, anchor: [0.48, 0.98], amplitude: 2.16, phase: 5.717, z: 5 },
    { id: 'tree-west-high', art: 'village-tree-broad', group: 'foliage', motion: 'branch', x: -215, y: 128, width: 361, height: 347, anchor: [0.49, 0.97], amplitude: 3.36, phase: 3.317, z: 6 },
    { id: 'tree-east-back', art: 'village-tree-pine', group: 'foliage', motion: 'branch', x: 375, y: 268, width: 122, height: 255, anchor: [0.47, 0.98], amplitude: 2.64, phase: 1.833, z: 7 },
    { id: 'tree-west-low', art: 'village-branch-canopy', group: 'foliage', motion: 'branch', x: -93, y: 470, width: 179, height: 159, anchor: [0.19, 0.96], amplitude: 5.52, phase: 4.233, z: 19, flipX: true },
    { id: 'tree-west-edge', art: 'village-branch-canopy', group: 'foliage', motion: 'branch', x: -103, y: 595, width: 161, height: 143, anchor: [0.19, 0.96], amplitude: 5.52, phase: 0.35, z: 20, flipX: true },
    { id: 'bird-valley', art: 'village-bird-up', group: 'birds', motion: 'bird', x: 454, y: 278, width: 13, height: 14, anchor: [0.5, 0.5], amplitude: 1, phase: 1.534, z: 20 },
    { id: 'bird-sky', art: 'village-bird-mid', group: 'birds', motion: 'bird', x: 220, y: 95, width: 11, height: 10, anchor: [0.5, 0.5], amplitude: 0.7, phase: 3.934, z: 20 },
    { id: 'flag-west', art: 'village-flag-front', group: 'cloth', motion: 'flag', x: 146, y: 481, width: 45, height: 113, anchor: [0.5, 0.035], pin: 'top', amplitude: 6.9, phase: 5.15, z: 24 },
    { id: 'flag-east', art: 'village-flag-angle', group: 'cloth', motion: 'flag', x: 363, y: 497, width: 38, height: 102, anchor: [0.5, 0.035], pin: 'top', amplitude: 6.3, phase: 1.267, z: 25 },
    { id: 'shop-awning', art: 'village-awning', group: 'cloth', motion: 'awning', x: 532, y: 757, width: 213, height: 106, anchor: [0.5, 0.07], pin: 'top', amplitude: 2.16, phase: 3.667, z: 27 },
    { id: 'chapel-west', art: 'village-shrub-yellow', group: 'foliage', motion: 'branch', x: 30, y: 670, width: 78, height: 62, anchor: [0.5, 0.94], amplitude: 4.32, phase: 6.067, z: 63 },
    { id: 'chapel-door', art: 'village-shrub-mixed', group: 'foliage', motion: 'branch', x: 105, y: 632, width: 67, height: 57, anchor: [0.5, 0.94], amplitude: 4.32, phase: 2.184, z: 64 },
    { id: 'chapel-stair-high', art: 'village-shrub-green', group: 'foliage', motion: 'branch', x: 163, y: 562, width: 70, height: 57, anchor: [0.5, 0.94], amplitude: 4.32, phase: 4.584, z: 65 },
    { id: 'chapel-stair-mid', art: 'village-shrub-yellow', group: 'foliage', motion: 'branch', x: 186, y: 668, width: 73, height: 58, anchor: [0.5, 0.94], amplitude: 4.32, phase: 0.7, z: 66 },
    { id: 'chapel-stair-east', art: 'village-shrub-mixed', group: 'foliage', motion: 'branch', x: 337, y: 641, width: 84, height: 72, anchor: [0.5, 0.94], amplitude: 4.32, phase: 3.1, z: 67 },
    { id: 'chapel-lower', art: 'village-shrub-green', group: 'foliage', motion: 'branch', x: 115, y: 780, width: 79, height: 65, anchor: [0.5, 0.94], amplitude: 4.32, phase: 5.5, z: 68 },
    { id: 'canal-flower', art: 'village-shrub-yellow', group: 'foliage', motion: 'branch', x: 23, y: 837, width: 80, height: 64, anchor: [0.5, 0.94], amplitude: 4.32, phase: 1.617, z: 69 },
    { id: 'canal-garden', art: 'village-shrub-mixed', group: 'foliage', motion: 'branch', x: 162, y: 887, width: 110, height: 94, anchor: [0.5, 0.94], amplitude: 4.32, phase: 4.017, z: 70 },
    { id: 'sundial-flower', art: 'village-shrub-mixed', group: 'foliage', motion: 'branch', x: 271, y: 1027, width: 70, height: 60, anchor: [0.5, 0.94], amplitude: 4.32, phase: 0.134, z: 71 },
    { id: 'shop-flower', art: 'village-shrub-mixed', group: 'foliage', motion: 'branch', x: 758, y: 859, width: 85, height: 73, anchor: [0.5, 0.94], amplitude: 4.32, phase: 2.534, z: 72 },
    { id: 'shop-corner', art: 'village-shrub-yellow', group: 'foliage', motion: 'branch', x: 793, y: 1016, width: 75, height: 60, anchor: [0.5, 0.94], amplitude: 4.32, phase: 4.934, z: 73 },
    { id: 'notice-west', art: 'village-shrub-green', group: 'foliage', motion: 'branch', x: 180, y: 1155, width: 83, height: 68, anchor: [0.5, 0.94], amplitude: 4.32, phase: 1.05, z: 74 },
    { id: 'notice-back', art: 'village-shrub-green', group: 'foliage', motion: 'branch', x: 463, y: 1086, width: 94, height: 77, anchor: [0.5, 0.94], amplitude: 4.32, phase: 3.45, z: 75 },
    { id: 'notice-flower', art: 'village-shrub-yellow', group: 'foliage', motion: 'branch', x: 481, y: 1245, width: 79, height: 63, anchor: [0.5, 0.94], amplitude: 4.32, phase: 5.85, z: 76 },
    { id: 'terrace-front', art: 'village-shrub-mixed', group: 'foliage', motion: 'branch', x: 618, y: 1195, width: 91, height: 78, anchor: [0.5, 0.94], amplitude: 4.32, phase: 1.967, z: 77 },
    { id: 'terrace-stairs', art: 'village-shrub-yellow', group: 'foliage', motion: 'branch', x: 546, y: 1379, width: 87, height: 70, anchor: [0.5, 0.94], amplitude: 4.32, phase: 4.367, z: 78 },
    { id: 'terrace-east', art: 'village-shrub-green', group: 'foliage', motion: 'branch', x: 778, y: 1265, width: 98, height: 80, anchor: [0.5, 0.94], amplitude: 4.32, phase: 0.484, z: 79 },
    { id: 'bridge-west', art: 'village-shrub-mixed', group: 'foliage', motion: 'branch', x: 15, y: 1235, width: 99, height: 85, anchor: [0.5, 0.94], amplitude: 4.32, phase: 2.884, z: 80 },
    { id: 'bridge-east', art: 'village-shrub-green', group: 'foliage', motion: 'branch', x: 218, y: 1375, width: 89, height: 73, anchor: [0.5, 0.94], amplitude: 4.32, phase: 5.284, z: 81 },
    { id: 'front-wall', art: 'village-shrub-mixed', group: 'foliage', motion: 'branch', x: 684, y: 1510, width: 85, height: 73, anchor: [0.5, 0.94], amplitude: 4.32, phase: 1.401, z: 82 },
    { id: 'ivy-chapel-west', art: 'village-vine-soft', group: 'foliage', motion: 'vine', x: 94, y: 526, width: 37, height: 95, anchor: [0.43, 0.025], pin: 'top', amplitude: 5.88, phase: 3.801, z: 103 },
    { id: 'ivy-chapel-east', art: 'village-vine-thick', group: 'foliage', motion: 'vine', x: 388, y: 536, width: 38, height: 63, anchor: [0.43, 0.025], pin: 'top', amplitude: 5.88, phase: 6.201, z: 104 },
    { id: 'ivy-canal', art: 'village-vine-flowers', group: 'foliage', motion: 'vine', x: 29, y: 965, width: 49, height: 103, anchor: [0.43, 0.025], pin: 'top', amplitude: 5.88, phase: 2.317, z: 105 },
    { id: 'ivy-bridge', art: 'village-vine-long', group: 'foliage', motion: 'vine', x: 258, y: 1344, width: 61, height: 135, anchor: [0.43, 0.025], pin: 'top', amplitude: 5.88, phase: 4.717, z: 106 },
    { id: 'ivy-cliff-west', art: 'village-vine-thick', group: 'foliage', motion: 'vine', x: 78, y: 1415, width: 67, height: 111, anchor: [0.43, 0.025], pin: 'top', amplitude: 5.88, phase: 0.834, z: 107 },
    { id: 'ivy-cliff-center', art: 'village-vine-flowers', group: 'foliage', motion: 'vine', x: 370, y: 1460, width: 70, height: 148, anchor: [0.43, 0.025], pin: 'top', amplitude: 5.88, phase: 3.234, z: 108 },
    { id: 'ivy-cliff-east', art: 'village-vine-thick', group: 'foliage', motion: 'vine', x: 485, y: 1500, width: 82, height: 136, anchor: [0.43, 0.025], pin: 'top', amplitude: 5.88, phase: 5.634, z: 109 },
    { id: 'ivy-terrace', art: 'village-vine-long', group: 'foliage', motion: 'vine', x: 714, y: 1428, width: 69, height: 153, anchor: [0.43, 0.025], pin: 'top', amplitude: 5.88, phase: 1.751, z: 110 },
    { id: 'ivy-front', art: 'village-vine-thick', group: 'foliage', motion: 'vine', x: 615, y: 1605, width: 78, height: 129, anchor: [0.43, 0.025], pin: 'top', amplitude: 5.88, phase: 4.151, z: 111 },
    { id: 'edge-west-low', art: 'village-grass-front', group: 'foliage', motion: 'branch', x: -24, y: 1505, width: 193, height: 121, anchor: [0.5, 0.96], amplitude: 7.2, phase: 0.268, z: 152 },
    { id: 'edge-west-near', art: 'village-grass-front', group: 'foliage', motion: 'branch', x: -55, y: 1681, width: 244, height: 153, anchor: [0.5, 0.96], amplitude: 7.2, phase: 2.668, z: 153 },
    { id: 'edge-center', art: 'village-grass-front', group: 'foliage', motion: 'branch', x: 241, y: 1736, width: 237, height: 148, anchor: [0.5, 0.96], amplitude: 7.2, phase: 5.067, z: 154 },
    { id: 'edge-east', art: 'village-grass-front', group: 'foliage', motion: 'branch', x: 690, y: 1664, width: 212, height: 133, anchor: [0.5, 0.96], amplitude: 7.2, phase: 1.184, z: 155 },
    { id: 'leaves-west', art: 'village-branch-green', group: 'foliage', motion: 'branch', x: -47, y: 1058, width: 128, height: 124, anchor: [0.81, 0.94], amplitude: 7.2, phase: 3.584, z: 156 },
    { id: 'leaves-mid', art: 'village-branch-yellow', group: 'foliage', motion: 'branch', x: 327, y: 1530, width: 100, height: 101, anchor: [0.15, 0.94], amplitude: 7.2, phase: 5.984, z: 157 },
    { id: 'leaves-east', art: 'village-branch-white', group: 'foliage', motion: 'branch', x: 748, y: 1340, width: 109, height: 102, anchor: [0.81, 0.94], amplitude: 7.2, phase: 2.101, z: 158 },
    { id: 'leaves-front', art: 'village-branch-red', group: 'foliage', motion: 'branch', x: 532, y: 1741, width: 158, height: 183, anchor: [0.81, 0.94], amplitude: 7.2, phase: 4.501, z: 159 },
    { id: 'ivy-cliff-thick', art: 'village-vine-thick', group: 'foliage', motion: 'vine', x: 418, y: 1501, width: 133, height: 220, anchor: [0.43, 0.025], pin: 'top', amplitude: 5.04, phase: 0.618, z: 159 },
    { id: 'ivy-low-right', art: 'village-vine-flowers', group: 'foliage', motion: 'vine', x: 635, y: 1694, width: 74, height: 156, anchor: [0.43, 0.025], pin: 'top', amplitude: 4.83, phase: 3.018, z: 160 },
    { id: 'front-low-leaves', art: 'village-grass-front', group: 'foliage', motion: 'branch', x: 70, y: 1767, width: 253, height: 158, anchor: [0.5, 0.96], amplitude: 6.48, phase: 5.418, z: 177 },
  ] satisfies VillageLayer[] as VillageLayer[],
  occluders: [
    { id: 'fixed-chapel-foreground', art: 'village-base', group: 'foliage', motion: 'static', x: 0, y: 0, width: 853, height: 1844, z: 10, clip: CLIP_CHAPEL },
  ] satisfies VillageLayer[] as VillageLayer[],
  effects: {
    waterPaths: [
      { id: 'water-under-bridge', direction: [0.25, 1], density: 10, polygon: [[157, 1368], [194, 1358], [222, 1350], [224, 1384], [239, 1398], [260, 1409], [269, 1424], [268, 1465], [248, 1454], [231, 1450], [217, 1437], [173, 1434], [164, 1410], [151, 1402]] },
      { id: 'water-lower-pool', direction: [1, 0.38], density: 16, polygon: [[209, 1589], [229, 1588], [249, 1598], [264, 1614], [291, 1631], [320, 1641], [344, 1650], [381, 1668], [403, 1680], [412, 1694], [364, 1691], [330, 1693], [306, 1678], [285, 1670], [267, 1659], [243, 1658], [227, 1644], [209, 1642], [198, 1646], [197, 1620]] },
    ],
    waterfalls: [
      { id: 'water-distant-channel', direction: [0, 1], density: 5, polygon: [[578, 478], [588, 480], [591, 493], [588, 507], [585, 522], [579, 530], [575, 515], [576, 495]] },
      { id: 'water-narrow-channel', direction: [0, 1], density: 7, polygon: [[204, 1501], [211, 1513], [213, 1539], [224, 1557], [223, 1576], [208, 1579], [200, 1560], [202, 1536], [199, 1525]] },
    ],
    lights: [{ id: 'light-market', x: 492, y: 739, radius: 33, alpha: 0.15 }, { id: 'light-square', x: 599, y: 1154, radius: 31, alpha: 0.15 }],
    motes: [{ x: 60, y: 610 }, { x: 386, y: 648 }, { x: 749, y: 925 }, { x: 675, y: 1320 }, { x: 86, y: 1510 }, { x: 548, y: 1680 }],
    birds: false,
  } satisfies VillageEffects as VillageEffects,
};
