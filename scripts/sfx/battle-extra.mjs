/**
 * 전투에서 소리가 빠져 있던 순간 · 장비 특수능력 소리 (2026-10-22 Lim 「전투 화면에서 빠진 효과음을 찾아보자」 → 「모두 만들고 … 전투를 풍요롭게」).
 * 쓰는 곳: battle/index.ts (보스 처치 · 장전 · 시전 끊김 · 물리 디버프), battle/core.ts (붉은 경고), battle/combat-sound.ts (어그로 · 붙어 섬 · 혼자 놂 ·
 * 바로 쓰는 보스 기술 공통 · 장비 특수능력 specSound)
 */
import { HEAD } from './boss.mjs';

const tail = keep => `Clear on a small phone speaker: a crisp transient and a full midrange body, little sub-bass. One isolated event near the start; the active sound and its natural tail finish within ${keep} seconds, followed by silence. Close perspective, clean mono-compatible center. A non-musical sound effect with no voice, speech, music, bells, or repeated pattern.`;

/** [이름, 쓰는 곳, 한국어 설명, 길이, 소리 문장, 'punch' = 보스 소리처럼 크게] */
const ROWS = [
  ['boss-down', '보스가 쓰러지는 순간 (구간 처치 · 승리 띠)', '거대한 몸이 쿵 무너지고 반짝', 1.4, 'A huge monster boss is defeated: a heavy collapsing thud of a giant body hitting the ground, armor and stone settling with a low rumble, then a short bright triumphant magical shimmer.', 'punch'],
  ['debuff-physical', '물리 디버프가 걸림 (출혈 · 표식 …)', '살갗이 찢기는 날카로운 쓰윽', 0.5, 'A sharp physical wound is inflicted on an adventurer: a quick slicing rip through cloth and leather with a small wet sting and a tight gasp-free flinch of armor.', ''],
  ['boss-aggro', '보스가 노리는 사람이 바뀜 (어그로 놓침)', '거대한 몸이 홱 돌아서는 으르렁', 0.7, 'A monster boss suddenly turns toward a new target: a heavy menacing low animal-like rumble with a sharp swish of a huge body twisting around and a heavy footstep.', 'punch'],
  ['alarm-rule', '붉은 경고 (탱커가 맨 앞줄을 벗어남 등 위치 규칙)', '삐릭삐릭 다급한 짧은 경보', 0.7, 'A short urgent alarm: two quick rising whistle-like siren chirps with a tense electronic edge and a low pulse underneath, clearly signaling that something is wrong.', ''],
  ['cast-break', '시전 · 찬가가 끊김 (취소 · 대상 바꿈 · 방해)', '마법이 툭 끊기며 피식 꺼짐', 0.5, 'A spell being cast is suddenly interrupted: a glassy magical hum snapping off with a sharp crack and a quick deflating fizzle of fading sparks.', ''],
  ['ui-arm', '스킬을 눌러 대상 고르기 (장전)', '톡 하고 마법이 준비됨', 0.25, 'A small soft magical click as a healing spell is readied in the hand: a light crisp tick with a tiny glassy shimmer.', ''],
  ['ui-disarm', '고른 스킬을 내려놓음 (장전 취소)', '톡 하고 내려놓음', 0.25, 'A small soft click as a readied spell is put away: a light muted wooden tick with a tiny downward swish.', ''],
  ['ally-clump', '파티원 「붙어 섬」 (위치 잡기 실수)', '투닥 서로 부딪히는 소리', 0.5, 'Adventurers bump into each other in a crowd: soft cloth and leather shuffles, a clumsy armored bump and a short scrape of boots.', ''],
  ['ally-alone', '파티원 「혼자 놂」 (협동 실수)', '터벅터벅 혼자 걸어 나감', 0.5, 'A lone adventurer wanders off on their own: a few light hollow footsteps drifting away with a soft lonely whoosh of a cloak.', ''],
  ['boss-cast', '예고 없이 바로 쓰는 보스 기술 (특성 소리가 없을 때)', '어두운 마력이 훅 일어남', 0.7, 'A monster boss uses a skill: a sharp dark magical whoosh with a short ominous swell and a crackle of gathering energy.', 'punch'],
  ['spec-heal', '장비 특수능력 발동: 치유', '금빛 회복이 반짝 차오름', 0.7, 'A healing charm on a piece of gear bursts to life: a warm golden glassy sparkle and a soft swelling glow of restoring light.', ''],
  ['spec-proc', '장비 특수능력 발동: 발동', '마법 불꽃이 찡 튐', 0.6, 'An enchantment on a piece of gear triggers: a quick bright magical spark burst with a crisp rising zing.', ''],
  ['spec-guard', '장비 특수능력 발동: 보호', '보호막이 탁 하고 씌워짐', 0.6, 'A protective ward from a piece of gear snaps on: a firm glassy shield pulse with a solid metallic click.', ''],
  ['spec-mana', '장비 특수능력 발동: 마나', '마나가 보글보글 차오름', 0.7, 'Mana flows back from a gear charm: a cool liquid magical swirl rising with a soft bubbling shimmer.', ''],
  ['spec-dispel', '장비 특수능력 발동: 해제', '맑게 씻겨 나가는 쉬익', 0.6, 'A gear charm cleanses a curse: a bright purifying whoosh with a crisp sparkle wiping everything clean.', ''],
  ['spec-cd', '장비 특수능력 발동: 재사용', '째깍째깍 시간이 빨라짐', 0.6, 'Time speeds up from a gear charm: a quick ticking clockwork whirl and a swift rising whoosh.', ''],
  ['spec-ally', '장비 특수능력 발동: 파티원', '따뜻한 기운이 동료에게 퍼짐', 0.7, 'A gear blessing reaches an ally: a warm soft magical pulse traveling outward with a gentle sparkle.', ''],
  ['spec-gimmick', '장비 특수능력 발동: 기믹', '뿅 하고 재주가 튀어나옴', 0.6, 'A curious gear trick triggers: a playful springy magical pop with a twinkling flourish.', ''],
  ['spec-priest', '장비 특수능력 발동: 사제 전용', '빛이 따스하게 피어남', 0.7, 'A class-specific gear power awakens: a warm holy light swells softly with a gentle choir-like synthetic shimmer and no voice.', ''],
  ['spec-druid', '장비 특수능력 발동: 드루이드 전용', '잎이 바스락 피어남', 0.7, 'A class-specific gear power awakens: fresh leaves rustle and a blossom opens with a hollow wooden knock.', ''],
  ['spec-paladin', '장비 특수능력 발동: 성기사 전용', '금빛 금속이 쨍 빛남', 0.7, 'A class-specific gear power awakens: a bright brass-and-light flare rings on polished plate with a radiant glint.', ''],
  ['spec-shaman', '장비 특수능력 발동: 주술사 전용', '물이 찰랑 튀고 토템이 똑', 0.7, 'A class-specific gear power awakens: water splashes up and a carved wooden totem knocks once.', ''],
  ['spec-monk', '장비 특수능력 발동: 수도사 전용', '안개가 후 감돌고 손바닥 톡', 0.7, 'A class-specific gear power awakens: a misty breath whooshes around with a soft palm tap on cloth.', ''],
  ['spec-astrologer', '장비 특수능력 발동: 점성술사 전용', '별빛이 반짝반짝 쏟아짐', 0.7, 'A class-specific gear power awakens: twinkling starlight glitters down in a soft celestial swell.', ''],
  ['spec-warder', '장비 특수능력 발동: 결계사 전용', '수정 인장이 착 울림', 0.7, 'A class-specific gear power awakens: a crystal seal clicks shut with a resonant glassy pulse.', ''],
];

export const BATTLE_EXTRA_SOUNDS = ROWS.map(([name, where, ko, keep, desc, fl]) => ({
  name, group: name.startsWith('spec-') ? '장비 특수능력' : '전투 진행', where, ko, p: 'P1', gen: 2, keep, presence: true, punch: fl === 'punch',
  prompt: `${HEAD}${desc} ${tail(keep)}`, match: desc,
}));
