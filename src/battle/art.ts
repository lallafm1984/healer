/** 전투 아트. 보스·잡몹은 생성 원화(src/art의 boss-·mob-, 29 문서), 없으면 벡터 그림. */
import { art } from '../art';
import { BOSSES, type BossDef } from '../data/bosses';
import type { FactionKey } from '../data/places';
import type { Fight, Mob, Unit } from '../engine/types';
import { mobLookOf } from '../data/mob-looks';
import { SKILLS, type SkillKey, type SlotName } from '../data/skills';

/** 작은 스킬 칸에서도 구분되는 기능 문양. 원화·직업 색에 의존하지 않는 공통 실루엣. */
const SKILL_MARK: Record<SlotName, string> = {
  basic: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  fast: '<path d="M14 2L4 14h7l-1 8 10-13h-7z"/>',
  hot: '<path d="M5 19C1 9 9 3 20 3c1 11-5 19-15 16zM5 19L16 8M8 15v-4M11 12h5"/>',
  aoe: '<circle cx="12" cy="5" r="3"/><circle cx="5" cy="16" r="3"/><circle cx="19" cy="16" r="3"/><path d="M10 8L7 13m7-5 3 5M8 16h8"/>',
  dispel: '<path d="M12 2C8 8 5 11 5 15a7 7 0 0 0 14 0c0-4-3-7-7-13zM7 19L17 9"/>',
  ext: '<path d="M12 2l8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5zM8 12l3 3 5-6"/>',
  raid: '<path d="M9 17V5l11-3v13M9 7l11-3"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="17" cy="16" rx="3" ry="3"/>',
  unique: '<path d="M12 3v15M7 8l5-5 5 5M4 15v6h16v-6"/>',
};
/** 사제 빛의 전이 모양 (빛 구슬 혜성) (24칸 판, 그림 skill-relay가 오기 전): 휠 칸 (판 위 깃든 표시는 2026-10-20부터 왼쪽 원 + 남은 초) */
export const RELAY_D = 'M20 8.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 1 1 9 0zM11 13 3.5 20.5M9.5 10.5 5 15M13.5 14.5 9 19';
const RELAY_MARK = `<path d="${RELAY_D}"/>`;
export function skillMark(key: SkillKey): string {
  const path = key === 'relay' ? RELAY_MARK : key === 'handGuard' ? '<path d="M7 12V6a1.5 1.5 0 0 1 3 0v5-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v7-3a1.5 1.5 0 0 1 3 0v6c0 4-3 7-7 7-3 0-5-2-6-4L3 13a1.5 1.5 0 0 1 2-2z"/>' : SKILL_MARK[SKILLS[key].slot];
  return `<svg class="skill-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

/**
 * 보스 무대 원형 초상·공략 그림 이름 (29 4장). 전투(구간)마다 앞에서부터 있는 그림을 쓴다.
 * boss-<이름> = 그 보스, mob-<이름> = 그 잡몹 구간. 하나도 없으면 아래 벡터 그림.
 */
const ENC_ART: Record<string, string[]> = {
  warden: ['boss-rust-guardian'],
  scrap: ['boss-scrap-guard', 'boss-rust-guardian'],
  patrol: ['boss-scrap-guard', 'boss-rust-guardian'],
  gate: ['mob-scrap-minion', 'mob-debris-thrower', 'boss-rust-guardian'],
  boiler: ['mob-boiler-golem', 'boss-rust-guardian'],
  field: ['mob-scrap-minion', 'mob-debris-thrower', 'boss-rust-guardian'],
  duo: ['mob-scrap-minion', 'boss-rust-guardian'],
  trash: ['mob-scrap-minion', 'boss-rust-guardian'],
  plague: ['boss-plague-lord'],
  hydra: ['boss-swamp-hydra'],
  twins: ['boss-twin-queens'],
  orben: ['boss-orben'],
  abysslord: ['boss-abyss-lord'],
  // 묶음 A (그림 요청 44): 그림이 올 때까지 벡터 그림
  collector3: ['boss-bone-collector'],
  ashyard: ['mob-risen-bones', 'mob-cult-acolyte'],
  shaman8: ['boss-swamp-shaman'],
  reedbank: ['mob-swamp-spearman', 'mob-mud-slinger'],
  butler13: ['boss-ghost-butler'],
  flowerbed: ['mob-empty-armor', 'mob-veiled-mourner'],
  golem18: ['boss-mana-golem'],
  guardian23: ['boss-temple-guardian'],
  frostgolem: ['boss-mana-golem'],
  mage: ['boss-unstable-mage'],
  shadow: ['boss-tower-shadow'],
  icehall: ['mob-rune-doll', 'mob-apprentice-mage'],
  frostlab: ['mob-frost-sprite', 'mob-drifting-tome', 'mob-rune-doll'],
  restyard: ['mob-stone-monk', 'mob-attic-bats'],
  keeper28: ['boss-temple-keeper'],
  plague33: ['boss-plague-lord'],
  sentinel: ['boss-watchtower-sentinel'],
  crystal: ['boss-resonance-crystal'],
  rubblestair: ['mob-stone-monk', 'mob-attic-bats'],
  blackrift: ['mob-tower-watcher', 'mob-abyss-herald', 'mob-void-servant'],
  riftground: ['mob-void-servant', 'mob-black-eye'],
  brokenbridge: ['mob-stone-monk', 'mob-lost-pilgrim'],
  guardian: ['boss-temple-guardian'],
  keeper: ['boss-temple-keeper'],
  templeyard: ['mob-stone-monk', 'mob-attic-bats'],
  nave: ['mob-stone-giant', 'mob-lost-pilgrim', 'mob-stone-monk'],
  butler: ['boss-ghost-butler'],
  lady: ['boss-portrait-lady'],
  belmore: ['boss-lord-belmore'],
  parlor: ['mob-empty-armor', 'mob-ghost-maid'],
  kennel: ['mob-ghost-hound', 'mob-veiled-mourner', 'mob-empty-armor'],
  snowslope: ['mob-rune-doll', 'mob-drifting-tome'],
  shaman: ['boss-swamp-shaman'],
  toad: ['boss-giant-toad'],
  seres: ['boss-swamp-chief'],
  rotbridge: ['mob-swamp-spearman', 'mob-mud-slinger'],
  toadnest: ['mob-wart-toad', 'mob-dart-hunter', 'mob-swamp-spearman'],
  collector: ['boss-bone-collector'],
  malchor: ['boss-malchor'],
  bonepass: ['mob-risen-bones', 'mob-crypt-rats'],
  censerhall: ['mob-beak-enforcer', 'mob-cult-acolyte', 'mob-risen-bones'],
  choir: ['boss-ghost-choir', 'boss-silent-choir'], // 40: 새 이름 boss-ghost-choir
  // 묶음 B (그림 요청 47): 그림이 올 때까지 벡터 그림
  ratking: ['boss-sewer-ratking'],
  carrier: ['boss-plague-carrier'],
  librarian: ['boss-archive-librarian'],
  librarian40: ['boss-archive-librarian'],
  scholar: ['boss-frozen-scholar'],
  priestess: ['boss-lily-priestess'],
  priestess48: ['boss-lily-priestess'],
  sleeper: ['boss-sleeping-lord'],
  leakyway: ['mob-risen-bones', 'mob-crypt-rats'],
  sludgegrate: ['mob-beak-enforcer', 'mob-cult-acolyte', 'mob-risen-bones'],
  iceread: ['mob-rune-doll', 'mob-apprentice-mage'],
  forbidden: ['mob-frost-sprite', 'mob-drifting-tome', 'mob-rune-doll'],
  petalstair: ['mob-empty-armor', 'mob-ghost-maid'],
  keeperhall: ['mob-ossuary-keeper', 'mob-dust-ghost', 'mob-empty-armor'],
  pagedrift: ['mob-rune-doll', 'mob-apprentice-mage'],
  rosetunnel: ['mob-empty-armor', 'mob-veiled-mourner'],
  crab36: ['boss-crab-bosun'],
  crab: ['boss-crab-bosun'],
  cook: ['boss-pirate-cook'],
  morel: ['boss-hook-morel'],
  gunner: ['boss-gunner-boom'],
  octo: ['boss-octo-squirm'],
  seawitch: ['boss-sea-witch'],
  mimic: ['boss-treasure-mimic'],
  parrot: ['boss-parrot-captain'],
  goldbeard44: ['boss-goldbeard'],
  goldbeard: ['boss-goldbeard'],
  gullsand: ['mob-deck-swab', 'mob-jelly-seer'],
  wreckage: ['mob-deck-swab', 'mob-slingshot-pirate'],
  // 묶음 C (그림 요청 49): 그림이 올 때까지 벡터 그림
  sippy52: ['boss-teacup-sippy'],
  sippy: ['boss-teacup-sippy'],
  hatter: ['boss-hatter-haerong'],
  uga: ['boss-mask-uga'],
  shellgod: ['boss-swamp-turtle'],
  kobold60: ['boss-kobold-kkojil'],
  capway: ['mob-cap-guard', 'mob-sneeze-shroom'],
  sugarstair: ['mob-cap-guard', 'mob-pollen-fairy'],
  cuptower: ['mob-big-cap', 'mob-sneeze-shroom', 'mob-cap-guard'],
  hotgravel: ['mob-kobold-miner', 'mob-kobold-smoker'],
  wetstair: ['mob-swamp-spearman', 'mob-mud-slinger'],
  turtlebridge: ['mob-wart-toad', 'mob-dart-hunter', 'mob-swamp-spearman'],
  queen56: ['boss-queen-amanita'],
  pollenfield: ['mob-cap-guard', 'mob-pollen-fairy'],
  songi: ['boss-cap-captain-songi'],
  pililli: ['boss-fairy-bandleader'],
  ponga: ['boss-puffball-ponga'],
  mungge: ['boss-moss-golem'],
  gaegul: ['boss-frog-ferryman'],
  morak: ['boss-spore-gardener'],
  bungbung: ['boss-bee-captain'],
  ppyong: ['boss-fairy-magician'],
  amanita: ['boss-queen-amanita'],
  // 묶음 D1 (그림 요청 52): 그림이 올 때까지 벡터 그림
  mungsil64: ['boss-kobold-mungsil'],
  mungsil: ['boss-kobold-mungsil'],
  bulttung: ['boss-teen-dragon-bulttung'],
  huggeun: ['boss-bellows-golem'],
  ttangttang: ['boss-anvil-golem'],
  kkojil: ['boss-kobold-kkojil'],
  deolkeong: ['boss-kobold-cart'],
  beonjjeok: ['boss-kobold-chief'],
  warmash: ['mob-kobold-miner', 'mob-kobold-smoker'],
  steamroom: ['mob-kobold-miner', 'mob-ember-whelp'],
  lavabath: ['mob-dragon-scale-guard', 'mob-kobold-smoker', 'mob-kobold-miner'],
  coldhearth: ['mob-scrap-minion', 'mob-debris-thrower', 'boss-rust-guardian'],
  anvilbridge: ['mob-boiler-golem', 'boss-rust-guardian'],
  // 묶음 D2 (그림 요청 52)
  whelps: ['boss-whelp-trio'],
  dandani: ['boss-scale-captain'],
  rubina: ['boss-ruby-dragon'],
  knights68: ['boss-water-knights'],
  knights: ['boss-water-knights'],
  uwoong: ['boss-organ-spirit'],
  ormal: ['boss-shadow-ormal'],
  shoretrash: ['mob-void-servant', 'mob-black-eye'],
  // 묶음 E1 (그림 요청 55): 그림이 올 때까지 벡터 그림. 탐험 ⑱ 흐물이는 20인 그림을 같이 씀
  kkubeok: ['boss-sleepy-guards'],
  hokdol: ['boss-camel-merchant'],
  nyanx: ['boss-riddle-cat'],
  heumul72: ['boss-jelly-gardener'],
  heumul: ['boss-jelly-gardener'],
  bichumi: ['boss-mirror-librarian'],
  gipeun: ['boss-abyss-abbot'],
  degul: ['boss-scarab-timekeeper'],
  dooldool: ['boss-bandage-butler'],
  stairtrash: ['mob-void-servant', 'mob-black-eye'],
  sandhall: ['mob-sand-soldier', 'mob-scarab-slinger'],
  backgarden: ['mob-sphinx-statue', 'mob-bandage-servant', 'mob-sand-soldier'],
  // 묶음 E2 (그림 요청 55). 탐험 ⑲ 폭신이는 10인 ⑫ 그림을 같이 씀
  solsol: ['boss-sand-twins'],
  eonggeum: ['boss-vault-turtle'],
  sarasha: ['boss-dusk-queen'],
  pokshin76: ['boss-pillow-golem'],
  ttubeok: ['boss-root-giant'],
  toktok: ['boss-seed-granny'],
  kungkung: ['boss-heart-root'],
  dunetrash: ['mob-sand-soldier', 'mob-bandage-servant'],
  // 묶음 E3 (그림 요청 55). 천문대 졸개는 깨진 신전 그림 그대로
  pokshin: ['boss-pillow-golem'],
  jjaekkak: ['boss-hourglass-priest'],
  hapum: ['boss-sand-king'],
  ttakttak: ['boss-sluice-crab'],
  jjirit: ['boss-star-eel'],
  doeul: ['boss-abyss-echo'],
  hwirik: ['boss-harpy-courier'],
  stargazer: ['boss-star-gazer'],
  geuneul: ['boss-sundial-ghost'],
  windtrash: ['mob-harpy-spear', 'mob-storm-seer'],
  startrash: ['mob-stone-monk', 'mob-attic-bats'],
  sundialyard: ['mob-stone-giant', 'mob-lost-pilgrim', 'mob-stone-monk'],
  // 묶음 F1 (그림 요청 57). 10인 휘리릭은 키운 판이 오기 전까지 탐험 ⑳ 그림, 탐험 ㉑ 복슬이는 던전 ⑰ 그림을 같이 씀
  chulleong: ['boss-well-bucket'],
  puseok: ['boss-moss-keeper'],
  huu: ['boss-heart-breath'],
  hwirik83: ['boss-harpy-courier-raid', 'boss-harpy-courier'],
  kkongkkong: ['boss-parcel-fairy'],
  buri: ['boss-postmaster-harpy'],
  boksul84: ['boss-thunder-sheep'],
  boksul: ['boss-thunder-sheep'],
  dolgae: ['boss-mill-harpy'],
  sheeptrash: ['mob-harpy-spear', 'mob-wind-sprite'],
  millstairs: ['mob-harpy-spear', 'mob-wind-sprite'],
  millhouse: ['mob-thunder-ram', 'mob-storm-seer', 'mob-harpy-spear'],
  // 묶음 F2 (그림 요청 57)
  gulgul: ['boss-crystal-mole'],
  pingping: ['boss-pinwheel-spirit'],
  bitgallae: ['boss-crystal-witch'],
  dungdung: ['boss-drum-giant'],
  ssaengssaeng: ['boss-harpy-knight'],
  ureureung: ['boss-storm-giant'],
  // 묶음 F3: 탐험 ㉒ 퐁퐁이는 던전 ⑱ 그림을 같이 씀, 마도사 졸개는 서리 마탑 그림 (번개 실험 정령은 서리 정령)
  pongpong88: ['boss-flask-golem'],
  pongpong: ['boss-flask-golem'],
  dwijuk: ['boss-topsy-headmaster'],
  kwangkwang: ['boss-shadow-hammer-giant'],
  syungsyung: ['boss-shadow-archer'],
  eodugi: ['boss-shadow-general'],
  platform: ['mob-rune-doll', 'mob-drifting-tome'],
  upsidehall: ['mob-rune-doll', 'mob-apprentice-mage'],
  boltlab: ['mob-frost-sprite', 'mob-drifting-tome', 'mob-rune-doll'],
  // 묶음 G1 (그림 요청 60): 탐험 ㉓ 세레나는 던전 ⑲ 그림을 같이 씀. 귀족가 졸개는 새 그림이 없으면 장원 그림
  geumeum: ['boss-maze-warden'],
  silta: ['boss-trap-spider'],
  bamgeuneul: ['boss-maze-lord'],
  jilpung: ['boss-shadow-cavalry'],
  ureobal: ['boss-abyss-beast'],
  chilheuk: ['boss-shadow-knight-commander'],
  serena92: ['boss-ghost-conductor'],
  serena: ['boss-ghost-conductor'],
  valen: ['boss-fallen-duke'],
  carriagetrash: ['mob-wet-armor', 'mob-wet-mourner', 'mob-empty-armor', 'mob-veiled-mourner'],
  ballhall: ['mob-wet-armor', 'mob-sunken-maid', 'mob-empty-armor', 'mob-ghost-maid'],
  balcony: ['mob-sunken-hound', 'mob-wet-mourner', 'mob-wet-armor', 'mob-ghost-hound', 'mob-veiled-mourner', 'mob-empty-armor'],
  // 묶음 G2 (그림 요청 60): 탐험 ㉔ 녹슬음은 던전 ⑳ 그림을 같이 씀. 심연의 정예 졸개는 새 그림이 없으면 심연의 탑 졸개 그림
  janmul: ['boss-shadow-boatman'],
  hwigami: ['boss-abyss-eel-king'],
  geomeun: ['boss-darkwater-queen'],
  nokseul96: ['boss-shadow-lender'],
  lanterntrash: ['mob-shadow-knight', 'mob-trap-caster', 'mob-void-servant', 'mob-abyss-herald'],
  // 묶음 G3 (그림 요청 60): 되살아난 군주 · 심장 조각은 새 그림이 없으면 심연의 군주 · 심연의 심장 그림
  eongkim: ['boss-root-guardian'],
  revlord: ['boss-abyss-lord-revived', 'boss-abyss-lord'],
  abyssheart: ['boss-abyss-heart'],
  heartshard100: ['boss-heart-shard', 'boss-abyss-heart'],
  nokseul: ['boss-shadow-lender'],
  lastshade: ['boss-last-shadow'],
  dawntrash: ['mob-shadow-knight', 'mob-abyss-brute', 'mob-void-servant', 'mob-abyss-herald'],
  cracktrash: ['mob-shadow-knight', 'mob-shadow-crossbow', 'mob-void-servant', 'mob-abyss-herald'],
  coolroot: ['mob-abyss-brute', 'mob-trap-caster', 'mob-shadow-knight', 'mob-void-servant', 'mob-abyss-herald'],
  // 묶음 H1 (그림 요청 63 B): 새 보스 그림이 먼저, 올 때까지 같은 세력 옛 보스 그림. 탐험 보스는 던전 보스 그림을 같이 씀
  heaptrash: ['mob-scrap-minion', 'mob-debris-thrower'],
  kongkong5: ['boss-pickaxe-golem', 'boss-scrap-guard'],
  shaft: ['mob-scrap-minion', 'mob-debris-thrower'],
  kongkong: ['boss-pickaxe-golem', 'boss-scrap-guard'],
  railway: ['mob-boiler-golem', 'mob-scrap-minion'],
  gurit: ['boss-mine-foreman', 'boss-rust-guardian'],
  alleytrash: ['mob-cult-acolyte', 'mob-crypt-rats'],
  molly10: ['boss-herbalist-monk', 'boss-malchor'],
  pothall: ['mob-risen-bones', 'mob-crypt-rats'],
  molly: ['boss-herbalist-monk', 'boss-malchor'],
  mushbed: ['mob-beak-enforcer', 'mob-cult-acolyte', 'mob-risen-bones'],
  chingching: ['boss-vine-golem', 'boss-bone-collector'],
  lilypads: ['mob-swamp-spearman', 'mob-dart-hunter'],
  kara15: ['boss-swamp-huntress', 'boss-swamp-shaman'],
  reedfence: ['mob-swamp-spearman', 'mob-mud-slinger'],
  kara: ['boss-swamp-huntress', 'boss-swamp-shaman'],
  mudpath: ['mob-wart-toad', 'mob-dart-hunter', 'mob-swamp-spearman'],
  cheolbeok: ['boss-mud-elemental', 'boss-giant-toad'],
  fountainwalk: ['mob-empty-armor', 'mob-ghost-maid'],
  lavender20: ['boss-perfumer', 'boss-portrait-lady'],
  bottlehall: ['mob-empty-armor', 'mob-ghost-maid'],
  lavender: ['boss-perfumer', 'boss-portrait-lady'],
  stillroom: ['mob-ghost-hound', 'mob-veiled-mourner', 'mob-empty-armor'],
  rose: ['boss-madam-rose', 'boss-lord-belmore'],
  iceholes: ['mob-rune-doll', 'mob-apprentice-mage'],
  ppodeuk25: ['boss-snowman-assistant', 'boss-mana-golem'],
  toolstore: ['mob-rune-doll', 'mob-apprentice-mage'],
  ppodeuk: ['boss-snowman-assistant', 'boss-mana-golem'],
  coldstore: ['mob-frost-sprite', 'mob-drifting-tome', 'mob-rune-doll'],
  icia: ['boss-frost-researcher', 'boss-unstable-mage'],
  sheaves: ['mob-stone-monk', 'mob-lost-pilgrim'],
  jipdan30: ['boss-scarecrow-knight', 'boss-temple-guardian'],
  // 묶음 H2 (그림 요청 63): 새 그림이 올 때까지 같은 세력 옛 그림. 탐험 보스는 던전 보스 그림을 같이 씀
  sacks: ['mob-stone-monk', 'mob-attic-bats'],
  jipdan: ['boss-scarecrow-knight', 'boss-temple-guardian'],
  millwheel: ['mob-stone-giant', 'mob-lost-pilgrim', 'mob-stone-monk'],
  nadal: ['boss-granary-guardian', 'boss-temple-guardian'],
  crowfield: ['mob-stone-monk', 'mob-stone-giant'],
  nadal34: ['boss-granary-guardian', 'boss-temple-guardian'],
  wetcave: ['mob-deck-swab', 'mob-slingshot-pirate'],
  peg: ['boss-smuggler-peg', 'boss-goldbeard'],
  powder: ['mob-deck-swab', 'mob-jelly-seer'],
  pado: ['boss-seahorse-knight', 'boss-crab-bosun'],
  reefpool: ['mob-deck-swab', 'mob-slingshot-pirate'],
  peg38: ['boss-smuggler-peg', 'boss-goldbeard'],
  iceflowers: ['mob-rune-doll', 'mob-apprentice-mage'],
  jiji42: ['boss-apprentice-twins', 'boss-unstable-mage'],
  messhall: ['mob-rune-doll', 'mob-apprentice-mage'],
  jiji: ['boss-apprentice-twins', 'boss-unstable-mage'],
  lounge: ['mob-frost-sprite', 'mob-drifting-tome', 'mob-rune-doll'],
  eomgyeok: ['boss-dorm-warden', 'boss-frozen-scholar'],
  campfire: ['mob-cult-acolyte', 'mob-beak-enforcer'],
  geopum46: ['boss-potion-monk', 'boss-plague-carrier'],
  shelves: ['mob-risen-bones', 'mob-crypt-rats'],
  geopum: ['boss-potion-monk', 'boss-plague-carrier'],
  cauldron: ['mob-beak-enforcer', 'mob-cult-acolyte', 'mob-risen-bones'],
  malos: ['boss-plague-archpriest', 'boss-malchor'],
  tiles: ['mob-cult-acolyte', 'mob-attic-bats'],
  malos50: ['boss-plague-archpriest', 'boss-malchor'],
  flourstore: ['mob-cap-guard', 'mob-pollen-fairy'],
  polpol: ['boss-flour-fairy', 'boss-teacup-sippy'],
  oven: ['mob-big-cap', 'mob-sneeze-shroom', 'mob-cap-guard'],
  monggeul: ['boss-cake-golem', 'boss-hatter-haerong'],
  dewpath: ['mob-cap-guard', 'mob-pollen-fairy'],
  polpol54: ['boss-flour-fairy', 'boss-teacup-sippy'],
  mushpath: ['mob-swamp-spearman', 'mob-dart-hunter'],
  poljjak58: ['boss-frog-captain', 'boss-swamp-huntress'],
  lilybridge: ['mob-swamp-spearman', 'mob-mud-slinger'],
  poljjak: ['boss-frog-captain', 'boss-swamp-huntress'],
  tadpond: ['mob-wart-toad', 'mob-dart-hunter', 'mob-swamp-spearman'],
  umulluk: ['boss-toad-king', 'boss-giant-toad'],
  // 묶음 H3 (그림 요청 63): 새 그림이 올 때까지 같은 세력 옛 그림. 탐험 보스는 던전 보스 그림을 같이 씀
  scalepile: ['mob-kobold-miner', 'mob-ember-whelp'],
  ttemjil62: ['boss-kobold-smith', 'boss-kobold-kkojil'],
  charcoal: ['mob-kobold-miner', 'mob-ember-whelp'],
  ttemjil: ['boss-kobold-smith', 'boss-kobold-kkojil'],
  bellowway: ['mob-dragon-scale-guard', 'mob-kobold-smoker', 'mob-kobold-miner'],
  hwalhwal: ['boss-salamander-tamer', 'boss-kobold-kkojil'],
  hotdock: ['mob-dragon-scale-guard', 'mob-kobold-smoker'],
  jigeul66: ['boss-lava-turtle', 'boss-kobold-kkojil'],
  steamcave: ['mob-dragon-scale-guard', 'mob-ember-whelp'],
  jigeul: ['boss-lava-turtle', 'boss-kobold-kkojil'],
  gemvein: ['mob-dragon-scale-guard', 'mob-kobold-smoker', 'mob-kobold-miner'],
  garnet: ['boss-garnet-dragon', 'boss-kobold-kkojil'],
  miststeps: ['mob-void-servant', 'mob-abyss-herald'],
  malmijal70: ['boss-anemone-gardener', 'boss-abyss-lord'],
  kelphall: ['mob-void-servant', 'mob-black-eye'],
  malmijal: ['boss-anemone-gardener', 'boss-abyss-lord'],
  pearlpond: ['mob-tower-watcher', 'mob-abyss-herald', 'mob-void-servant'],
  chalrang: ['boss-jelly-knight', 'boss-abyss-lord'],
  palmshade: ['mob-sand-soldier', 'mob-scarab-slinger'],
  baseurak74: ['boss-scroll-mummy', 'boss-bandage-butler'],
  sandshelf: ['mob-sand-soldier', 'mob-scarab-slinger'],
  baseurak: ['boss-scroll-mummy', 'boss-bandage-butler'],
  sealedstack: ['mob-sphinx-statue', 'mob-bandage-servant', 'mob-sand-soldier'],
  gitpen: ['boss-sand-scribe', 'boss-dusk-queen'],
  obelisks: ['mob-bandage-servant', 'mob-sphinx-statue'],
  gitpen78: ['boss-sand-scribe', 'boss-dusk-queen'],
  // 묶음 H4 (그림 요청 63): 새 그림이 올 때까지 같은 세력 옛 그림. 탐험 보스는 던전 보스 그림을 같이 씀
  swaybridge: ['mob-harpy-spear', 'mob-storm-seer'],
  hwiparam82: ['boss-harpy-instructor', 'boss-harpy-courier'],
  glideyard: ['mob-harpy-spear', 'mob-wind-sprite'],
  hwiparam: ['boss-harpy-instructor', 'boss-harpy-courier'],
  windtunnel: ['mob-thunder-ram', 'mob-storm-seer', 'mob-harpy-spear'],
  hoeori: ['boss-wind-elemental', 'boss-storm-giant'],
  zapgrass: ['mob-wind-sprite', 'mob-thunder-ram'],
  hoeori86: ['boss-wind-elemental', 'boss-storm-giant'],
  floatshelf: ['mob-rune-doll', 'mob-apprentice-mage'],
  peoleok: ['boss-flapping-tome', 'boss-unstable-mage'],
  forbidstair: ['mob-frost-sprite', 'mob-drifting-tome', 'mob-rune-doll'],
  swit: ['boss-ghost-librarian', 'boss-archive-librarian'],
  startline: ['mob-apprentice-mage', 'mob-rune-doll'],
  swit90: ['boss-ghost-librarian', 'boss-archive-librarian'],
  drownhall: ['mob-wet-armor', 'mob-sunken-maid', 'mob-empty-armor', 'mob-ghost-maid'],
  gawison: ['boss-ghost-pruner', 'boss-ghost-butler'],
  thornmaze: ['mob-sunken-hound', 'mob-wet-mourner', 'mob-wet-armor', 'mob-ghost-hound', 'mob-veiled-mourner', 'mob-empty-armor'],
  rosalin: ['boss-ghost-archduchess', 'boss-portrait-lady'],
  lotusstep: ['mob-wet-armor', 'mob-sunken-maid', 'mob-empty-armor', 'mob-ghost-maid'],
  gawison94: ['boss-ghost-pruner', 'boss-ghost-butler'],
  glowpond: ['mob-shadow-knight', 'mob-trap-caster', 'mob-void-servant', 'mob-abyss-herald'],
  lastecho97: ['boss-final-echo', 'boss-last-shadow'],
  drillyard: ['mob-shadow-knight', 'mob-shadow-crossbow', 'mob-void-servant', 'mob-abyss-herald'],
  kalnal: ['boss-shadow-drillmaster', 'boss-maze-warden'],
  weaponrack: ['mob-abyss-brute', 'mob-trap-caster', 'mob-shadow-knight', 'mob-void-servant', 'mob-abyss-herald'],
  heukbaek: ['boss-abyss-twin-knights', 'boss-shadow-knight-commander'],
  palisade: ['mob-shadow-knight', 'mob-shadow-crossbow', 'mob-void-servant', 'mob-abyss-herald'],
  kalnal98: ['boss-shadow-drillmaster', 'boss-maze-warden'],
  crystalstair: ['mob-shadow-knight', 'mob-shadow-crossbow', 'mob-void-servant', 'mob-abyss-herald'],
  banjjak: ['boss-crystal-giant', 'boss-heart-shard'],
  echohall: ['mob-abyss-brute', 'mob-trap-caster', 'mob-shadow-knight', 'mob-void-servant', 'mob-abyss-herald'],
  lastecho: ['boss-final-echo', 'boss-last-shadow'],
  sunpath: ['mob-stone-monk', 'mob-stone-giant'],
  banjjak99: ['boss-crystal-giant', 'boss-heart-shard'],
};
/** 그 전투에 쓸 그림 주소 (없으면 '') */
export function encArt(key: string, script = key): string {
  const name = (ENC_ART[key] || ENC_ART[script] || []).find(n => art(n));
  return name ? art(name) : '';
}
/**
 * 일반 · 정예 구간 적 이름 → 그림 (2026-10-25 Lim 「여러 마리가 따로 안 보임」): 지금 맞는 적 초상 · 무리 막대 얼굴.
 * 앞에서부터 있는 그림. 자기 그림이 없는 5종은 올 때까지 비슷한 그림을 빌림 (65 2장 선택)
 */
const MOB_ART: Record<string, string[]> = {
  '고철 졸개': ['mob-scrap-minion'], '잔해 투척병': ['mob-debris-thrower'], '보일러 골렘': ['mob-boiler-golem'], '광차 골렘': ['mob-minecart-golem', 'mob-boiler-golem'],
  '되살아난 뼈': ['mob-risen-bones'], '교단 신도': ['mob-cult-acolyte'], '묘지 쥐떼': ['mob-crypt-rats'], '부리 가면 집행자': ['mob-beak-enforcer'],
  '늪 창병': ['mob-swamp-spearman'], '진흙 투석꾼': ['mob-mud-slinger'], '독침 사냥꾼': ['mob-dart-hunter'], '독 혹 두꺼비': ['mob-wart-toad'],
  '빈 갑옷 시종': ['mob-empty-armor'], '검은 베일 조문객': ['mob-veiled-mourner'], '유령 하녀': ['mob-ghost-maid'], '유령 사냥개': ['mob-ghost-hound'],
  '물에 젖은 갑옷 시종': ['mob-wet-armor', 'mob-empty-armor'], '물에 젖은 조문객': ['mob-wet-mourner', 'mob-veiled-mourner'],
  '가라앉은 유령 하녀': ['mob-sunken-maid', 'mob-ghost-maid'], '가라앉은 사냥개': ['mob-sunken-hound', 'mob-ghost-hound'],
  '먼지 유령': ['mob-dust-ghost'], '납골당 관리인': ['mob-ossuary-keeper'],
  '얼음 룬 인형': ['mob-rune-doll'], '구름 룬 인형': ['mob-cloud-rune-doll', 'mob-rune-doll'], '떠도는 주술서': ['mob-drifting-tome'], '견습 마법사': ['mob-apprentice-mage'],
  '빗자루 견습생': ['mob-broom-apprentice', 'mob-apprentice-mage'], '서리 정령': ['mob-frost-sprite'], '번개 실험 정령': ['mob-bolt-sprite', 'mob-frost-sprite'],
  '돌 수도사': ['mob-stone-monk'], '다락 박쥐 떼': ['mob-attic-bats'], '길 잃은 순례자': ['mob-lost-pilgrim'], '신전 돌거인': ['mob-stone-giant'],
  '공허의 종복': ['mob-void-servant'], '검은 눈': ['mob-black-eye'], '심연 전령': ['mob-abyss-herald'], '탑 감시자': ['mob-tower-watcher'],
  '그림자 기사': ['mob-shadow-knight'], '함정 술사': ['mob-trap-caster'], '심연 거수': ['mob-abyss-brute'], '그림자 석궁수': ['mob-shadow-crossbow'],
  '갑판 청소부': ['mob-deck-swab'], '해파리 점쟁이': ['mob-jelly-seer'], '새총 꼬마 해적': ['mob-slingshot-pirate'], '화약 창고지기': ['mob-powder-keeper', 'mob-deck-swab'],
  '버섯 꼬마 경비': ['mob-cap-guard'], '재채기 버섯': ['mob-sneeze-shroom'], '꽃가루 요정': ['mob-pollen-fairy'], '큰 갓 버섯 거인': ['mob-big-cap'],
  '코볼트 곡괭이꾼': ['mob-kobold-miner'], '코볼트 연기 주술사': ['mob-kobold-smoker'], '불씨 꼬마 용': ['mob-ember-whelp'], '용 비늘 경비병': ['mob-dragon-scale-guard'],
  '모래 병정': ['mob-sand-soldier'], '풍뎅이 투석병': ['mob-scarab-slinger'], '붕대 시종': ['mob-bandage-servant'], '스핑크스 석상': ['mob-sphinx-statue'],
  '깃털 창병 하피': ['mob-harpy-spear'], '폭풍 점술사': ['mob-storm-seer'], '바람 요정': ['mob-wind-sprite'], '천둥 숫양': ['mob-thunder-ram'],
};
/** 그 적 이름의 그림 주소 (없으면 '') */
export function mobArt(name: string): string {
  const n = (MOB_ART[name] || []).find(x => art(x));
  return n ? art(n) : '';
}
/** 구간 적 한 마리의 보이는 이름 · 그림 (같은 종류 몇 번째인지로 data/mob-looks 얼굴, 2026-10-25 Lim 「적얼굴과 이름을 다양화」) */
export function mobLook(f: Pick<Fight, 'mobs'>, m: Mob): { name: string; src: string } {
  if (m.add) return { name: m.name, src: '' };
  const look = mobLookOf(m.name, f.mobs.filter(x => !x.add && x.name === m.name).indexOf(m));
  return { name: look.name, src: (look.art && art(look.art)) || mobArt(m.name) };
}
/** 역병 군주 인터미션 쥐떼 (보스 무대 작은 그림, 없으면 '') */
export const ratsArt = (): string => art('mob-crypt-rats');

export function bossSvg(script: string, key = script): string {
  const src = encArt(key, script);
  if (src) return `<img class="boss-illustration" src="${src}" alt="" decoding="async" draggable="false">`;
  // 유령 성가대: 지휘봉을 든 지휘자 (정식 그림은 22 리소스 목록에서)
  if (script === 'choir') return `<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke="#0E0E15" stroke-width="4" stroke-linejoin="round"><path d="M50 30C34 32 28 52 26 94H74C72 52 66 32 50 30Z" fill="#3B3F6B"/><circle cx="50" cy="22" r="13" fill="#C9C3B0"/><path d="M38 62L60 50" fill="none"/></g><path d="M62 49L88 22" stroke="#0E0E15" stroke-width="5" stroke-linecap="round"/><path d="M62 49L88 22" stroke="#F0C46A" stroke-width="2.5" stroke-linecap="round"/><path d="M43 23h4M53 23h4" stroke="#0E0E15" stroke-width="3" stroke-linecap="round"/><path d="M45 31h10" stroke="#0E0E15" stroke-width="3" stroke-linecap="round"/><path d="M36 70h28M34 82h32" stroke="#2A2D52" stroke-width="3"/></svg>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M84 22V94" stroke="#0E0E15" stroke-width="9"/><path d="M84 22V94" stroke="#5B3B22" stroke-width="4"/><g stroke="#0E0E15" stroke-width="4" stroke-linejoin="round"><path d="M50 8C28 10 22 34 22 52L14 94H80L76 52C76 34 72 10 50 8Z" fill="#6E7233"/><path d="M50 20C38 22 34 34 34 48C40 56 60 56 66 48C66 34 62 22 50 20Z" fill="#1C1B14"/></g><circle cx="84" cy="18" r="7" fill="#C8E06A" stroke="#0E0E15" stroke-width="3"/><circle cx="43" cy="40" r="3.5" fill="#C8E06A"/><circle cx="57" cy="40" r="3.5" fill="#C8E06A"/><path d="M30 72Q50 65 70 72" stroke="#4E5124" stroke-width="4" fill="none"/></svg>`;
}

/**
 * 진형 판 「나」 칸의 직업 문장 (27 3-4·5장: ✚ 대신 직업 문장, 원형 금테 + 돌 바탕).
 * 그린 문장(emblem-<직업>)이 있으면 그 그림, 없으면 선 아이콘 (src/screens/art.ts의 EMBLEM 모양·색과 같음).
 * 돌려주는 값 = 판에서 그림으로 쓸 SVG·그림 주소 (board.ts가 캔버스에 그려 텍스처로 씀)
 */
const EMBLEM_LINE: Record<string, string> = {
  priest: '<path d="M6.5 16v-4.5a5.5 5.5 0 0 1 11 0V16l1.5 2h-14z"/><path d="M12 4v2"/><path d="M12.6 9.4l-1.4 2.4 1.8 1.4-1 2.3"/><path d="M10 20.5h4"/>',
  druid: '<path d="M12 21V10"/><path d="M12 10C11 7.5 9 6 6.5 6M12 10c1-2.5 3-4 5.5-4M7.5 6V3.5M16.5 6V3.5"/><path d="M12 15.5c2.6 0 4.6-1.6 5.2-4.2-2.6 0-4.6 1.6-5.2 4.2z"/>',
  paladin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3.5v6M12 14.5v6M3.5 12h6M14.5 12h6"/>',
};
export function emblemSrc(hero: string, color: string): { src: string; painted: boolean } {
  const img = art(`emblem-${hero}`);
  if (img) return { src: img, painted: true };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${EMBLEM_LINE[hero] || EMBLEM_LINE.priest}</svg>`;
  return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, painted: false };
}

/**
 * 판 위 그림 이름 (37 v0.2). 있는 그림 이름을 돌려주고, 없으면 '' (그러면 판은 지금처럼 글자·색으로 그림).
 * 판 위 적: 데이터에 정한 고유 그림 (37 4장 C) → 하는 일에 맞는 공용 그림 (37 4장 E)
 */
const ADD_ART: Record<string, string> = {
  mend: 'mob-imp-mender', bomb: 'mob-bomb', pylon: 'mob-pylon', jail: 'mob-jail', march: 'mob-slime-march', fixate: 'mob-spark-fixate',
  smash: 'mob-brute', drain: 'mob-mana-leech', swarm: 'mob-imp-swarm', sting: 'mob-imp-swarm', aura: 'mob-totem', hit: 'mob-imp',
  hatch: 'mob-egg', hoard: 'mob-gold-pile', // 묶음 D (그림 요청 52)
};
const firstArt = (...names: (string | undefined)[]): string => names.find(n => n && art(n)) ?? '';
export function addArtName(m: Mob): string {
  const a = m.add!;
  return firstArt(a.art, ADD_ART[a.job?.p ?? (a.cleave ? 'swarm' : a.zone != null ? 'aura' : 'hit')]);
}
/** 헤매는 영혼 칸 (37 4장 C-3·5 고유, E-21 공용) */
export const soulArtName = (u: Unit): string => firstArt(u.soul?.art, 'mob-soul-wisp');
/** 장판 칸 무늬 (37 4장 B-8~14): 세력 장판 → 공용. 예고는 B-9 */
const ZONE_TAIL: Partial<Record<FactionKey, string>> = { plague: 'plague', swamp: 'swamp', noble: 'noble', mage: 'frost', hill: 'hill', pirate: 'tide', fairy: 'spore', dragon: 'lava', abyss: 'abyss', golem: 'metal', sand: 'sand', storm: 'storm', deep: 'deep' }; // 심연 = 44 그림, 골렘 쇳물 = 52 F, 모래 늪 · 회오리 = 55 F, 심연의 정예 어둠물 웅덩이 = 60 F
export const zoneArtName = (fac: FactionKey | null): string => firstArt(fac && ZONE_TAIL[fac] ? `fx-cell-zone-${ZONE_TAIL[fac]}` : undefined, 'fx-cell-zone');
/** 요정 고리 칸 (49 F): 심연은 흐물이 빛 고리 (55 F 3), 그 밖 = 버섯 고리 */
export const ringArtName = (fac: FactionKey | null): string => firstArt(fac === 'abyss' ? 'fx-cell-ring-jelly' : undefined, 'fx-cell-ring');
/** 무너진 바닥 칸 (37 4장 B-3~5): 늪 = 물, 마탑 = 얼음 기둥, 그 밖 = 돌 구덩이 */
const HOLE_TAIL: Partial<Record<FactionKey, string>> = { swamp: 'swamp', mage: 'ice' };
export const holeArtName = (fac: FactionKey | null): string => firstArt(fac && HOLE_TAIL[fac] ? `fx-cell-hole-${HOLE_TAIL[fac]}` : undefined, 'fx-cell-hole-stone');
/** 밀물 칸 (60 E 1·2, 63 E 6·7·13·14): 짠물 해적단 = 맑은 청록 짠물, 늪 = 독 연못, 그 밖 = 어둠물. 꼬리는 그 그림이 있을 때만 ('' = 어둠물) */
const TIDE_TAIL: Partial<Record<FactionKey, string>> = { pirate: 'sea', swamp: 'poison' };
export const tideTail = (fac: FactionKey | null): string => (fac && TIDE_TAIL[fac] && art(`fx-cell-tide-${TIDE_TAIL[fac]}`) ? TIDE_TAIL[fac]! : '');
export const tideArtName = (fac: FactionKey | null, warn = false): string => {
  const t = tideTail(fac), w = warn ? '-warn' : '';
  return firstArt(t ? `fx-cell-tide-${t}${w}` : undefined, `fx-cell-tide${w}`);
};

/**
 * 묶음 H 보스 기술 이펙트 (63 E): 전투 대본 → 그림 fx-. 그림이 없으면 지금 연출 그대로.
 * land = 그 기술 예고가 떨어질 때 (줄 피해는 맞는 줄을 왼쪽 → 오른쪽으로 지나감, fx-cell-은 맞은 칸 바닥에 잠깐 남음) · omen = 예고 칸 무늬 (떨어질 때까지)
 * hold = 그 기술 디버프 · 감옥이 걸린 동안 칸 위에 겹침 · hit = 그 기술 디버프가 걸릴 때 한 번 · cure = 그 디버프를 힐로 다 녹였을 때
 * swap = 이 전투에서 엔진 연출 (fx 사건 이름) 대신 · dark = 체력 숫자가 숨은 동안 판 전체. 기술 키는 번호 꼬리를 뺀 이름도 됨 (skillBase)
 */
interface BossFx {
  land?: Record<string, string>; omen?: Record<string, string>; hold?: Record<string, string>; hit?: Record<string, string>;
  cure?: Record<string, string>; swap?: Record<string, string>; dark?: string;
}
export const BOSS_FX: Record<string, BossFx> = {
  gurit: { land: { cart: 'fx-minecart-charge' } }, // 광차 돌진
  ppodeuk25: { land: { roll: 'fx-snowball-roll' } }, // 눈덩이 굴리기
  ppodeuk: { land: { roll: 'fx-snowball-roll' } },
  icia: { hold: { armor: 'fx-ice-armor' }, cure: { armor: 'fx-frost-burst' } }, // 얼음 갑옷: 힐로 녹이면 서리 폭발
  jipdan30: { hit: { crows: 'fx-crow-swarm' } }, // 까마귀 떼: 보스 자리에서 맞는 사람에게
  jipdan: { hit: { crows: 'fx-crow-swarm' } },
  nadal: { land: { grain: 'fx-cell-hole-grain', grain2: 'fx-cell-hole-grain' } }, // 낟알 쏟아짐 (장판이라 무너진 칸 대신 맞은 칸에 잠깐)
  nadal34: { land: { grain: 'fx-cell-hole-grain' } },
  eomgyeok: { swap: { heartbeat: 'fx-hush' } }, // 조용히! (시전 끊기)
  geopum: { hold: { bubble: 'fx-bubble-trap' }, swap: { 'swell-pop': 'fx-bubble-pop' } }, // 역병 거품: 지우면 거품 터짐
  polpol: { dark: 'fx-flour-cloud' }, // 밀가루 구름 (50% 아래 흐름 dark)
  monggeul: { hit: { cream: 'fx-cream-burst' } }, // 크림 폭발 (판 가운데)
  chalrang: { omen: { omen: 'fx-cell-jelly-omen' }, hold: { bubble: 'fx-bubble-trap' }, swap: { 'jail-break': 'fx-bubble-pop' } }, // 해파리 점괘 · 물거품 감옥
  swit: { swap: { heartbeat: 'fx-hush' } }, // 조용히
  swit90: { swap: { heartbeat: 'fx-hush' } },
};
/** 번호 꼬리를 뺀 기술 키 (rows · spots · 점괘: cart0 · cart0b → cart, grain20 → grain2) */
export const skillBase = (key: string): string => key.replace(/\d[bm]?$/, '');
const pick = (t: Record<string, string> | undefined, k: string): string | undefined => (t && Object.prototype.hasOwnProperty.call(t, k) ? t[k] : undefined);
const have = (a: string | undefined): string => (a && art(a) ? a : '');
/** 그 전투 · 그 기술 키 (swap은 엔진 연출 이름)의 63 E 그림. 그림이 없으면 '' */
export function bossFxArt(script: string, slot: 'land' | 'omen' | 'swap', key: string): string {
  const t = BOSS_FX[script]?.[slot];
  return have(pick(t, key) ?? pick(t, skillBase(key)));
}
/** 체력 숫자가 숨은 동안 판 전체 그림 (없으면 '') */
export const darkArt = (script: string): string => have(BOSS_FX[script]?.dark);
/** 그 기술이 거는 디버프 · 감옥 이름 (판은 디버프 이름만 앎) */
export function skillDebuffName(script: string, key: string): string {
  const e = (BOSSES as Record<string, BossDef | undefined>)[script]?.skills.find(d => d.key === key)?.effect;
  return !e ? '' : e.p === 'jail' ? e.name : 'debuff' in e && e.debuff ? e.debuff.name : '';
}
const byDebuff = new Map<string, Map<string, string>>();
/** 그 전투에서 이 디버프 · 감옥 이름에 붙는 63 E 그림 (hold · hit · cure). 그림이 없으면 '' */
export function debuffFxArt(script: string, slot: 'hold' | 'hit' | 'cure', name: string): string {
  const k = `${script}|${slot}`;
  let m = byDebuff.get(k);
  if (!m) {
    m = new Map();
    for (const [key, a] of Object.entries(BOSS_FX[script]?.[slot] ?? {})) { const n = skillDebuffName(script, key); if (n) m.set(n, a); }
    byDebuff.set(k, m);
  }
  return have(m.get(name));
}
/** 그 전투의 63 E 그림 모두 (있는 것만, 전투 시작에 미리 읽어 둠) */
export const bossFxArts = (script: string): string[] =>
  Object.values(BOSS_FX[script] ?? {}).flatMap(v => (typeof v === 'string' ? [v] : Object.values(v as Record<string, string>))).filter(a => art(a));
