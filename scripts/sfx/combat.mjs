/** Combat sound direction and review criteria. Raw candidates live outside version control. */
import { SOUNDS } from './sounds.mjs';
import { PRIEST_SOUNDS } from './priest.mjs';
import { BOSS_SOUNDS } from './boss.mjs';
import { BOSS_OWN_SOUNDS } from './boss-own.mjs';
import { ABILITY_SOUNDS } from './abilities.mjs';
import { BOSS_CAST_SOUNDS } from './boss-cast.mjs';
import { CLASS_SOUNDS } from './class.mjs';
import { BATTLE_EXTRA_SOUNDS } from './battle-extra.mjs';

const style = 'Close, dry, tactile fantasy RPG sound effect. Rounded attack, clear midrange on a phone speaker, restrained treble. One isolated event, immediate onset and a natural short decay into silence. No speech, vocals, music, ambience, or repeating rhythm.';
// 보스 기술 착탄은 배경음 · 파티원 공격 위로 크게 (2026-10-21 Lim 「각 보스들의 스킬 사용시 좀더 강력한 효과음으로 잘 들리게」):
// 밝은 첫 타격과 꽉 찬 중음, 다듬을 때 폰 스피커 대역을 올림 (process.py presence). 장판 착탄은 졸개 쓰러짐 · 돌 부서짐 (stone-break)과 따로
const STRONG = new Set(['boss-impact', 'boss-wave', 'boss-zone']);
const loud = keep => `Made to stand out over background music on a small phone speaker: a strong bright transient around 2 to 4 kHz, a dense punchy midrange body and controlled sub-bass. One isolated event near the start; the active sound and its natural tail finish within ${keep} seconds, followed by silence. Close perspective, clean mono-compatible center. A non-musical sound effect with no voice, scream, music, bells, gong, or repeated pattern.`;
const added = [
  ['attack-melee', '근접 공격', 0.38, 'A sword makes one sharp short steel contact against leather armor, with a dry scrape and padded body.'],
  ['attack-heavy', '중장 무기 공격', 0.5, 'A heavy axe hits a wooden shield once, a solid woody crack with dull steel weight and a short decay.'],
  ['attack-bow', '궁수·사냥꾼 공격', 0.35, 'A bowstring releases once with a tight woody twang and a short feathered arrow swish.'],
  ['attack-magic', '마법사 공격', 0.45, 'One small arcane projectile snaps against a magical target, a rounded airy pop and brief glassy fizz.'],
  ['ally-hurt', '파티원 피격', 0.3, 'One muted impact against padded leather armor, a compact low middle thud with a tiny cloth rustle.'],
  ['attack-miss', '빗나감', 0.28, 'A quick dry blade swishes through empty air once, with no contact or impact.'],
  ['parry', '막기', 0.42, 'A steel blade glances off a small shield once, a firm short metallic clack with a damped ring.'],
  ['shield', '보호막 적용·흡수', 0.55, 'A small glassy magical membrane flexes and closes in a warm rounded pulse with a muted crystalline click.'],
  ['ally-heal', '파티원 회복 능력', 0.5, 'One gentle liquid droplet opens into a soft warm restorative magical shimmer, smooth and brief.'],
  ['ally-support', '파티원 지원 능력', 0.55, 'A short cloth banner flick meets a warm resonant wooden contact and a soft uplifting air pulse.'],
  ['ally-control', '파티원 방해 능력', 0.4, 'One dry arcane snap with a quick inward suction, a restrained sharp crack that immediately stops.'],
  ['boss-impact', '보스 강타 착탄', 0.9, 'A huge monster boss brings a giant stone hammer down on a knight\'s shield: a massive forceful crash, a hard bright metallic crack on top of a heavy punchy slam, and a short gritty rumble.'],
  ['boss-wave', '보스 광역 착탄', 1.1, 'A boss unleashes a powerful magical shockwave across the whole battlefield: a big explosive whoomp with a bright crackling burst and a rough rushing blast of air sweeping outward, then a short rumble.'],
  ['boss-zone', '보스 장판 착탄', 0.9, 'A boss spell shatters the stone ground under the party: a loud sharp rock crack and a heavy crunching break, with chunks of stone smashing down and scattering.'],
  ['stone-break', '지면·감옥 파괴', 0.65, 'A small stone structure cracks once and a handful of gritty fragments quickly fall and settle.'],
  ['magic-water', '물·거품·해일', 0.65, 'A compact sheet of water splashes once with two rounded droplets and a quick watery decay.'],
  ['magic-fire', '화염·열기', 0.6, 'One contained burst of flame, a soft ignition puff followed by a brief crisp fire crackle that stops.'],
  ['magic-lightning', '번개·전기', 0.5, 'One short electrical arc cracks with a firm midrange snap and a small dry buzzing decay.'],
  ['magic-dark', '저주·어둠·생명 흡수', 0.7, 'A dark magical suction draws inward, a grainy bowed glass undertone and a short low airy close.'],
  ['magic-wind', '회오리·바람·낙하', 0.65, 'A short swirling gust of air rises and falls once, smooth clothlike movement with a soft end.'],
  ['magic-link', '연결·사슬·전이', 0.45, 'A taut magical thread plucks once with a light glassy ping and a tiny airy traveling tail.'],
  ['magic-shift', '위치 교환·시간 되감기', 0.65, 'A brief reversed air swoop converges into a soft hollow magical pop, then quickly vanishes.'],
  ['magic-grow', '자연·소환·성장', 0.65, 'A small magical plant unfurls once, delicate leaf rustle, light wooden creak, and a gentle rounded air puff.'],
  ['status-stagger', '휘청·방해·실수', 0.35, 'One dry wooden rattle bends slightly downward and ends with a soft padded knock, a restrained stumble cue.'],
].map(([name, where, keep, description]) => ({
  name, where, keep, group: '전투 추가', ko: where, p: 'P0', gen: 2,
  ...(STRONG.has(name)
    ? { presence: true, punch: true, prompt: `Original sound design for a warm tactile fantasy healer game. ${description} ${loud(keep)}` }
    : { prompt: `${description} Audible event ends within ${keep} seconds. ${style}` }),
  match: description,
}));
/** make.mjs가 이름을 골라 다시 만들 수 있는 전투 추가음 (사제 확정음은 넣지 않음) */
export const ADDED = [...added, ...BOSS_SOUNDS, ...BOSS_OWN_SOUNDS, ...BOSS_CAST_SOUNDS, ...ABILITY_SOUNDS, ...BATTLE_EXTRA_SOUNDS, ...CLASS_SOUNDS];

const combatGroups = new Set(['전투 진행', '힐러 공통', '직업', '경고', '파티원 공격']);
// More concrete acoustic directions for candidates that repeatedly missed the
// fantasy descriptions. The review targets and thresholds remain unchanged.
const retryPrompts = {
  chime: 'One clear glassy plucked string chord, a very short soft harp strum with warm overlapping upper-mid harmonics and a smooth shimmering decay.',
  'renew-druid': 'One close broad rustle of fresh leaves and a flexible twig bending, supported by a warm hollow wooden creak. A soft full-bodied movement with no sharp initial click.',
  'hymn-druid': 'Fantasy forest magic sound effect: a powerful soft whoosh of rustling leaves opens outward, with a resonant hollow wooden breath. A lush airy nature spell, one full-bodied swell and decay.',
  'hymn-paladin': 'One softly struck and palm-damped brass plate produces a broad warm buzzing metallic chord, rich overlapping midrange harmonics, a firm rounded beginning and a rapid smooth release.',
  'heal-astrologer': 'One tiny muted glass-harp pluck, a clear high-mid glassy pop with a delicate string harmonic. Damp it immediately after the pluck so the entire sound ends in 0.18 seconds.',
  'renew-astrologer': 'Two very close light glass-string plucks blend into one smooth airy high harmonic, delicate, non-melodic and softly damped, ending after 0.3 seconds.',
  'renew-warder': 'A miniature crystalline dome closes with a layered glass resonance and lands in one rounded protective pulse that decays quickly. A compact magical barrier with warm weight and stability, clear glassy midrange harmonics. No glass destruction, bass drop, or ongoing drone.',
  deny: 'One palm-muted wooden block knock, warm and rounded but clearly woody in the middle register, with a tiny downward pitch bend. A quiet refusal sound.',
  heart: 'A pair of soft muted hand-drum thumps resembling one heartbeat, rounded and woody with clear upper bass and midrange. One restrained lub-dub pulse and silence.',
  'debuff-poison': 'Two small bubbles pop in thick sticky liquid almost together. A brief wet gurgle with rounded hollow pops and no sustained bubbling.',
  'magic-fire': 'One small flame ignites with a rounded air puff and a brief soft crackle, then immediately extinguishes. A compact full-bodied fire burst.',
  'magic-lightning': 'One short electrical spark zaps with a rounded midrange buzzing body, softly damped and immediately stopping. No loud click or long electrical hum.',
  aoe: 'A strong short rough gust of air rises in pitch and opens outward once, with a clear full-bodied midrange whoosh and soft low-middle resonance. No sharp click, impact, explosion or long background wind.',
  'debuff-curse': 'One short dry bowed-glass scrape bends down in pitch around the middle register and stops smoothly, with a small grainy air suction. Clear raspy midrange, no deep sub-bass or long drone.',
  'stone-break': 'A small brittle stone tile snaps in half once, a clearly audible gritty crack with a short compact crumble of stone chips landing together.',
  'magic-grow': 'A bundle of fresh leaves unfolds once with a rounded wooden twig creak and soft air puff, close and full-bodied, a smooth organic rustle with no loud click.',
};
export const COMBAT_SOUNDS = [
  ...SOUNDS.filter(s => combatGroups.has(s.group) || ['deny', 'win', 'lose'].includes(s.name))
    .map(s => ({ ...s, match: s.match ?? s.prompt.split('Original sound design for a warm tactile fantasy healer game. ')[1]?.split('One isolated event')[0] ?? s.prompt })),
  ...added,
  ...BOSS_SOUNDS,
  ...BOSS_OWN_SOUNDS,
  ...BOSS_CAST_SOUNDS,
  ...ABILITY_SOUNDS,
  ...BATTLE_EXTRA_SOUNDS,
  ...CLASS_SOUNDS,
  ...PRIEST_SOUNDS.filter(p => !SOUNDS.some(s => s.name === p.name)),
].map(s => ({ ...s, ...(s.name === 'renew-warder' ? { gen: 3 } : {}),
  ...(retryPrompts[s.name] ? { retryPrompt: retryPrompts[s.name] } : {}) }));
export const EXTRA_SOUNDS = [...added, ...BOSS_SOUNDS, ...BOSS_OWN_SOUNDS, ...BOSS_CAST_SOUNDS, ...ABILITY_SOUNDS, ...BATTLE_EXTRA_SOUNDS, ...CLASS_SOUNDS, ...PRIEST_SOUNDS.filter(p => !SOUNDS.some(s => s.name === p.name))];
