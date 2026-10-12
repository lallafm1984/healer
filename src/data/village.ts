/**
 * 로비 「살아 있는 마을」 장면 목록 (2026-10-11 코덱스 village-living-background 시안 manifest.json에서 옮김).
 * 좌표·크기·잘라내기 다각형은 원본 그림 853×1844 기준. 그림 이름은 src/art의 village-<원본 파일 이름> (바탕 = village-base).
 * 승인된 가지·잎·꽃 초기 진폭 ×2.4 · 덩굴 ×2.1 · 깃발 ×3 · 차양 ×1.35 · 기본 바람 35%.
 * 2026-10-11 추가 요청: 구름 9개/3종과 속도 ×1.65, 새 4마리 무리, 실제 그림 낙엽 8개.
 * 사용자 요청 없이 진폭을 줄이거나 부착점·가림 관계를 바꾸지 않는다.
 * 종탑의 종 레이어(chapel-bell)는 뺐다 (10 4장 「종에 관한 것은 모두 빼자」). 바탕 그림의 탑 창은 원래 비어 있다.
 * 2026-10-12 Lim 「여전히 정적인 느낌」: 폰 화면에선 마을이 0.42배로 줄어 흔들림이 1~2px였다. 흔들림 ×1.4, 구름 ×2, 새 무리 더 자주,
 * 그리고 큰 면이 움직이도록 ambience (구름 그림자 · 햇살 줄기 · 금빛 먼지 · 물 반짝임 · 굴뚝 연기 · 왼쪽에서 오는 돌풍과 날리는 잎)를 더했다.
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
  /** 새가 같은 무리에서 출발하는 시차 (초). phase는 날갯짓 위상에만 사용 */
  flightDelay?: number;
  /** 이 다각형 안에만 보임 (구름 = 산·성 뒤) */
  clip?: Poly;
}

/** 돌풍: first초 뒤부터 every초 (± jitter)마다 왼쪽에서 오른쪽으로 travel초에 걸쳐 지나가고, 한 자리엔 hold초 머문다 */
export interface VillageGust { first: number; every: number; jitter: number; hold: number; travel: number; boost: number; lean: number; leaves: number }

/** 그림 없이 코드로 그리는 마을 공기 (2026-10-12). 좌표·크기는 원본 그림 853×1844 기준, 속도는 그림 px/초 */
export interface VillageAmbience {
  /** 가지·덩굴·깃발·차양 흔들림 배율 (승인된 진폭 × 이 값) */
  sway: number;
  gust: VillageGust;
  /** 땅 위를 오른쪽으로 지나가는 구름 그림자 (곱하기). offset = 처음 자리 (0~1) */
  shadows: { y: number; width: number; height: number; speed: number; offset: number; alpha: number }[];
  /** 왼쪽 위에서 비스듬히 내려오는 햇살 줄기 (더하기). period초에 한 번 밝아졌다 흐려짐 */
  shafts: { x: number; width: number; alpha: number; period: number; phase: number }[];
  shaftAngle: number;
  /** 왼쪽 위 햇무리 */
  sun: { x: number; y: number; radius: number; alpha: number };
  /** 굴뚝 연기 (바탕 그림의 굴뚝 꼭대기) */
  chimneys: { x: number; y: number }[];
  /** 햇빛 속 금빛 먼지 수 */
  motes: number;
  /** 물 반짝임이 생기는 자리 x, y, x, y … (바탕 그림의 물빛 픽셀에서 뽑음: 먼 강 · 다리 아래 강 · 아래 수로) */
  glints: readonly number[];
  /** 동시에 반짝이는 수 */
  glintLive: number;
}

export interface VillageEffects {
  waterPaths: { id: string; direction: readonly [number, number]; density: number; polygon: Poly }[];
  waterfalls: { id: string; direction: readonly [number, number]; density: number; polygon: Poly }[];
  lights: { id: string; x: number; y: number; radius: number; alpha?: number }[];
  leafArt: string;
  /** alpha>16 영역의 실제 폭. 투명 여백을 자르지 않고 표시 크기를 보정 */
  leafContentWidth: number;
  motes: { x: number; y: number; size: number; drift: readonly [number, number]; duration: number; phase: number; rotation: number }[];
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
  cloudSpeedScale: 3.3,
  birdFrames: ['village-bird-mid', 'village-bird-up'],
  /** 새 무리: birdCycle초마다 한 번 birdCross초에 걸쳐 가로지름 (하늘 → 먼 계곡 번갈아) */
  birdCycle: 26,
  birdCross: 21,
  layers: [
    { id: 'cloud-distant-west', art: 'village-cloud-wide', group: 'clouds', motion: 'cloud', x: 67, y: 37, width: 184, height: 64, anchor: [0, 0], amplitude: 2.8, phase: 0.051, speed: 0.42, z: 0.1, alpha: 0.56, clip: CLIP_SKY },
    // Wisp는 전체 높이의 52.35%만 구름이다. 원본 픽셀을 자르지 않고 높이/시작점을 보정한다.
    { id: 'cloud-distant-middle', art: 'village-cloud-wisp-v1', group: 'clouds', motion: 'cloud', x: 330, y: 24, width: 219, height: 73, anchor: [0, 0], amplitude: 2.8, phase: 2.451, speed: 0.51, z: 0.2, alpha: 0.62, flipX: true, clip: CLIP_SKY },
    { id: 'cloud-distant-east', art: 'village-cloud-wide', group: 'clouds', motion: 'cloud', x: 601, y: 31, width: 179, height: 66, anchor: [0, 0], amplitude: 2.8, phase: 4.851, speed: 0.47, z: 0.3, alpha: 0.58, clip: CLIP_SKY },
    { id: 'cloud-west', art: 'village-cloud-wide', group: 'clouds', motion: 'cloud', x: -100, y: -28, width: 202, height: 95, anchor: [0, 0], amplitude: 2.8, phase: 0, speed: 0.68, z: 1, alpha: 0.83, clip: CLIP_SKY },
    { id: 'cloud-middle', art: 'village-cloud-round', group: 'clouds', motion: 'cloud', x: 198, y: -15, width: 137, height: 86, anchor: [0, 0], amplitude: 2.8, phase: 2.4, speed: 1.06, z: 2, alpha: 0.94, clip: CLIP_SKY },
    { id: 'cloud-near-west', art: 'village-cloud-round', group: 'clouds', motion: 'cloud', x: 88, y: -12, width: 166, height: 90, anchor: [0, 0], amplitude: 2.8, phase: 0.968, speed: 0.95, z: 2.2, alpha: 0.87, clip: CLIP_SKY },
    { id: 'cloud-near-middle', art: 'village-cloud-wisp-v1', group: 'clouds', motion: 'cloud', x: 355, y: -42, width: 288, height: 96, anchor: [0, 0], amplitude: 2.8, phase: 3.368, speed: 0.79, z: 2.8, alpha: 0.84, clip: CLIP_SKY },
    { id: 'cloud-east', art: 'village-cloud-wide', group: 'clouds', motion: 'cloud', x: 478, y: -32, width: 210, height: 99, anchor: [0, 0], amplitude: 2.8, phase: 4.8, speed: 0.87, z: 3, alpha: 0.88, clip: CLIP_SKY },
    { id: 'cloud-small', art: 'village-cloud-wisp-v1', group: 'clouds', motion: 'cloud', x: 749, y: -27, width: 150, height: 50, anchor: [0, 0], amplitude: 2.8, phase: 0.917, speed: 1.24, z: 4, alpha: 0.75, flipX: true, clip: CLIP_SKY },
    { id: 'tree-west-back', art: 'village-tree-pine', group: 'foliage', motion: 'branch', x: 109, y: 144, width: 145, height: 303, anchor: [0.48, 0.98], amplitude: 2.16, phase: 5.717, z: 5 },
    { id: 'tree-west-high', art: 'village-tree-broad', group: 'foliage', motion: 'branch', x: -215, y: 128, width: 361, height: 347, anchor: [0.49, 0.97], amplitude: 3.36, phase: 3.317, z: 6 },
    { id: 'tree-east-back', art: 'village-tree-pine', group: 'foliage', motion: 'branch', x: 375, y: 268, width: 122, height: 255, anchor: [0.47, 0.98], amplitude: 2.64, phase: 1.833, z: 7 },
    { id: 'tree-west-low', art: 'village-branch-canopy', group: 'foliage', motion: 'branch', x: -93, y: 470, width: 179, height: 159, anchor: [0.19, 0.96], amplitude: 5.52, phase: 4.233, z: 19, flipX: true },
    { id: 'tree-west-edge', art: 'village-branch-canopy', group: 'foliage', motion: 'branch', x: -103, y: 595, width: 161, height: 143, anchor: [0.19, 0.96], amplitude: 5.52, phase: 0.35, z: 20, flipX: true },
    // width = alpha 외곽 기준 날개 폭. 같은 네 마리가 하늘/먼 계곡을 번갈아 횡단한다.
    { id: 'bird-flock-lead', art: 'village-bird-mid', group: 'birds', motion: 'bird', x: 0, y: 92, width: 24, height: 23, anchor: [0.47, 0.62], phase: 0.2, flightDelay: 0, alpha: 0.84, z: 9 },
    { id: 'bird-flock-high', art: 'village-bird-up', group: 'birds', motion: 'bird', x: 0, y: 73, width: 20, height: 24, anchor: [0.47, 0.7], phase: 1.8, flightDelay: 0.7, alpha: 0.75, z: 9 },
    { id: 'bird-flock-low', art: 'village-bird-mid', group: 'birds', motion: 'bird', x: 0, y: 110, width: 22, height: 21, anchor: [0.47, 0.62], phase: 3.6, flightDelay: 1.25, alpha: 0.8, z: 9 },
    { id: 'bird-flock-tail', art: 'village-bird-up', group: 'birds', motion: 'bird', x: 0, y: 89, width: 18, height: 22, anchor: [0.47, 0.7], phase: 5.1, flightDelay: 1.9, alpha: 0.7, z: 9 },
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
    lights: [{ id: 'light-market', x: 492, y: 739, radius: 36, alpha: 0.2 }, { id: 'light-square', x: 599, y: 1154, radius: 34, alpha: 0.2 }],
    leafArt: 'village-leaf-drift-v1',
    leafContentWidth: 1123,
    motes: [
      { x: 60, y: 218, size: 10, drift: [48, 148], duration: 19, phase: 0.12, rotation: 0.4 },
      { x: 786, y: 425, size: 8, drift: [-36, 126], duration: 23, phase: 0.54, rotation: 2.1 },
      { x: 50, y: 606, size: 12, drift: [46, 143], duration: 21, phase: 0.8, rotation: -0.7 },
      { x: 776, y: 865, size: 11, drift: [-44, 139], duration: 18, phase: 0.27, rotation: 1.3 },
      { x: 73, y: 1048, size: 9, drift: [34, 119], duration: 24, phase: 0.65, rotation: -1.2 },
      { x: 756, y: 1305, size: 14, drift: [-46, 155], duration: 20, phase: 0.02, rotation: 0.8 },
      { x: 98, y: 1492, size: 13, drift: [45, 158], duration: 22, phase: 0.43, rotation: 2.8 },
      { x: 726, y: 1616, size: 10, drift: [-35, 126], duration: 17, phase: 0.91, rotation: -0.2 },
    ],
  } satisfies VillageEffects as VillageEffects,
  ambience: {
    sway: 1.4,
    gust: { first: 2.5, every: 11, jitter: 3, hold: 3.4, travel: 2.8, boost: 1.1, lean: 0.55, leaves: 14 },
    shadows: [
      { y: 340, width: 620, height: 320, speed: 12, offset: 0.12, alpha: 0.8 },
      { y: 760, width: 700, height: 360, speed: 10, offset: 0.66, alpha: 0.75 },
      { y: 1160, width: 600, height: 320, speed: 13.5, offset: 0.38, alpha: 0.8 },
    ],
    shafts: [
      { x: -150, width: 180, alpha: 0.24, period: 11, phase: 0 },
      { x: 20, width: 120, alpha: 0.2, period: 8.5, phase: 2.1 },
      { x: 170, width: 210, alpha: 0.17, period: 13, phase: 4.2 },
      { x: 350, width: 130, alpha: 0.15, period: 9.5, phase: 1.3 },
    ],
    shaftAngle: -0.42,
    sun: { x: -40, y: 150, radius: 560, alpha: 0.38 },
    chimneys: [{ x: 663, y: 522 }],
    motes: 46,
    glints: [
      334, 215, 348, 216, 325, 217, 311, 221, 299, 225, 288, 226, 247, 227, 322, 227, 231, 230, 260, 231, 276, 233, 213, 237, 289, 238, 244, 240,
      267, 240, 186, 241, 202, 241, 233, 241, 252, 245, 220, 246, 164, 247, 173, 250, 208, 250, 193, 251, 240, 251, 225, 256, 187, 260, 197, 261,
      212, 262, 237, 265, 225, 271, 238, 275, 252, 279, 259, 286, 516, 433, 505, 437, 529, 437, 541, 439, 295, 443, 285, 444, 305, 445, 531, 447,
      319, 465, 638, 484, 590, 494, 637, 504, 589, 512, 639, 522, 595, 523, 649, 523, 640, 538, 620, 541, 702, 559, 689, 564, 825, 596, 850, 601,
      840, 607, 103, 933, 4, 1012, 19, 1025, 24, 1041, 37, 1076, 61, 1239, 72, 1264, 88, 1279, 120, 1286, 101, 1290, 196, 1395, 196, 1417, 209, 1423,
      178, 1431, 230, 1431, 217, 1437, 251, 1442, 234, 1447, 267, 1456, 206, 1527, 252, 1627, 205, 1638, 222, 1640, 261, 1640, 189, 1642, 245, 1644, 251, 1657,
      302, 1666, 274, 1668, 355, 1679, 298, 1682, 326, 1685, 271, 1689, 339, 1696, 355, 1703, 312, 1704, 331, 1709, 376, 1718, 304, 1728, 356, 1729, 367, 1741,
      382, 1746, 429, 1761, 402, 1769, 471, 1778, 413, 1779, 493, 1801, 512, 1808, 542, 1822, 562, 1827, 531, 1833, 512, 1835, 551, 1836,
    ],
    glintLive: 16,
  } satisfies VillageAmbience as VillageAmbience,
};
