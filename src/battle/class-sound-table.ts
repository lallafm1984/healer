/** 6직업 기술 · 특성 버튼 소리 이름 (소리 문장은 scripts/sfx/class.mjs · sounds.mjs heal · renew · hymn-<직업>). class-sound.ts가 씀 */
import type { HeroKey } from '../data/heroes';
import type { SkillKey } from '../data/skills';
import type { TalentKey } from '../data/talents';

export const CLASS_SKILL_SOUNDS: Partial<Record<HeroKey, Partial<Record<SkillKey, string>>>> = {
  druid: { sprout: 'heal-druid', growth: 'druid-growth', bloom: 'renew-druid', wildflower: 'druid-wildflower', natureCleanse: 'druid-nature-cleanse', bark: 'druid-bark', quietwood: 'hymn-druid', rebirth: 'druid-rebirth' },
  paladin: { holyLight: 'heal-paladin', beacon: 'paladin-beacon', oath: 'renew-paladin', lightWave: 'paladin-light-wave', handCleanse: 'paladin-hand-cleanse', sacrifice: 'paladin-sacrifice', sanctuary: 'hymn-paladin', handGuard: 'paladin-hand-guard' },
  shaman: { ripple: 'heal-shaman', springTotem: 'shaman-spring-totem', droplet: 'renew-shaman', chainHeal: 'shaman-chain-heal', washing: 'shaman-washing', earthTotem: 'shaman-earth-totem', rainTotem: 'hymn-shaman', spiritLink: 'shaman-spirit-link' },
  monk: { vitalPalm: 'heal-monk', mistWrap: 'monk-mist-wrap', wanderMist: 'renew-monk', mistBreath: 'monk-mist-breath', clearChi: 'monk-clear-chi', soothe: 'monk-soothe', reviveWind: 'hymn-monk', tea: 'monk-tea' },
  astrologer: { starHeal: 'heal-astrologer', twinkle: 'astrologer-twinkle', starMark: 'renew-astrologer', starfall: 'astrologer-starfall', clearStar: 'astrologer-clear-star', starSleep: 'astrologer-star-sleep', starMemory: 'hymn-astrologer', polaris: 'astrologer-polaris' },
  warder: { sealHeal: 'heal-warder', judgment: 'warder-judgment', lightBarrier: 'renew-warder', wardCircle: 'warder-ward-circle', wardCleanse: 'warder-ward-cleanse', guardWard: 'warder-guard-ward', lightVeil: 'hymn-warder', wardHold: 'warder-ward-hold' },
};
export const CLASS_TALENT_SOUNDS: Partial<Record<HeroKey, Partial<Record<TalentKey, string>>>> = {
  druid: { springRain: 'druid-spring-rain', forestMemory: 'druid-forest-memory', oldTree: 'druid-old-tree' },
  paladin: { resolveFill: 'paladin-resolve-fill', dawnVow: 'paladin-dawn-vow' },
  shaman: { totemCall: 'shaman-totem-call', waterSpirit: 'shaman-water-spirit', seaSeat: 'shaman-sea-seat' },
  monk: { thousandHands: 'monk-thousand-hands', gatherMist: 'monk-gather-mist', chiBurst: 'monk-chi-burst', mistStorm: 'monk-mist-storm' },
  astrologer: { fallingNight: 'astrologer-falling-night', supernova: 'astrologer-supernova', milkyWay: 'astrologer-milky-way' },
  warder: { judgeHammer: 'warder-judge-hammer', citadel: 'warder-citadel', endlessJudge: 'warder-endless-judge' },
};
