/**
 * 6직업 기술 · 특성 버튼 · 치명적 치유 소리 (2026-10-22 Lim 「사제 말고 6직업은 사제를 베이스로 참고해서 직업군 사운드를 모두 만들자」
 * → 「스킬의 쿨타임에 비례해서 화려하게」 → 「사제 소리와 동일하게 하지말고 느낌만 가져오고 직업별로 개성있는 소리」
 * → 「힐느낌은 뾰로롱~ 같은 느낌이고 힐이 아닌 스킬도 비슷하거나 결이 비슷한 테마로, 다른 게임을 참고해서」).
 * 72개 모두 고전 RPG 치유 마법 · 요정 반짝임처럼 밝은 마법 음이 빠르게 위로 훑어 올라가 반짝이며 피어나는 결 (SPARKLE, 「뾰로롱」)을 바탕으로 하고,
 * 직업 재료는 그 음의 색 (COLOR)으로만 둠: 드루이드 나무 마림바 · 잎, 성기사 금빛 놋쇠 종 · 판금, 주술사 물방울 · 토템, 수도사 대나무 풍경 · 바람 · 옷자락,
 * 점성술사 오르골 · 우주, 결계사 수정 핑 · 인장 · 역장. 사제 소리 파일은 섞지 않음.
 * 재사용 시간 단계 (tier): 1 = 없음 · 6초 이하 (짧고 깔끔), 2 = 8~15초, 3 = 20~60초, 4 = 90초 이상 · 전투에 한 번 (가장 화려, 1.5초 안).
 * heal = 회복하는 기술 (듣기 페이지 표시용). 생성 문장은 T5Gemma 256 토큰 안 (지금 최대 약 215).
 * 직접 힐 · 지속 힐 · 공대 기술 (heal · renew · hymn-<직업>)은 CLASS_BASE로 sounds.mjs에 들어감. 어느 스킬이 어느 소리인지는 src/battle/class-sound-table.ts
 */
const HEAD = 'Original sound design for a warm tactile fantasy healer game. ';
/** 「뾰로롱」: 고전 RPG 치유 마법의 상행 아르페지오 글리산도 + 반짝이는 잔향 */
const SPARKLE = 'Built like a classic RPG healing spell: a quick rising arpeggio of bright magical notes sweeps upward in a twinkling glissando and blooms into a soft glowing shimmer.';
/** 직업마다 그 음의 색 (재료) */
const COLOR = {
  druid: 'Druid color: the notes ring like a warm wooden marimba and kalimba, with a leafy rustle and a soft breathy flute glow underneath. No metal, glass or choir.',
  paladin: 'Paladin color: the notes ring like bright golden brass bells and chimes over polished plate armor, with a warm holy-flame glow underneath. No glass, water or choir.',
  shaman: 'Shaman color: the notes are bright water-drop plinks and bubbling splashes over a hollow wooden totem knock and a soft hide drum. No metal, glass or choir.',
  monk: 'Monk color: the notes are airy bamboo wind-chimes and a breathy flute riding a soft whoosh of wind and fluttering cloth. No metal, glass or choir.',
  astrologer: 'Astrologer color: the notes are a music-box and celesta glass twinkle over a deep cosmic hum, like starlight. No wood, water, armor or choir.',
  warder: 'Warder color: the notes are clear crystal glass pings with a humming force-field barrier and precise seal clicks. No wood, water, airy sparkle or choir.',
};
const LOOK = {
  1: 'Small and quick: a short twinkle, one gesture.',
  2: 'A fuller twinkle with one extra sparkle accent.',
  3: 'Impressive: a short build, then a bright full sparkling bloom.',
  4: 'Grand ultimate spell: a rising build, a brilliant cascading burst of sparkles, then a glowing tail.',
};
const tail = (tier, keep) => `${LOOK[tier]} One isolated event near the start; it finishes within ${keep} seconds, then silence. Close perspective, clear midrange, clean mono-compatible center. No spoken or sung voice, gong, backing music, ambience bed or repeated rhythmic pattern.`;
const HERO_KO = { druid: '드루이드', paladin: '성기사', shaman: '주술사', monk: '수도사', astrologer: '점성술사', warder: '결계사' };
const ROLE_KO = { basic: '기본 힐', fast: '빠른 기술', hot: '지속 기술', aoe: '광역 기술', dispel: '해제', ext: '외부 생존기', raid: '공대 기술', unique: '고유 기술', talent: '특성 버튼', crit: '치명적 치유' };

/** [이름, 직업, 역할, 스킬 · 특성 이름, 재사용, 단계, 길이, 회복하는 기술, 한국어 설명, 소리 문장] */
const ROWS = [
  ['heal-druid', 'druid', 'basic', '새싹', '재사용 없음', 1, 0.7, true, '새싹이 뾰로롱 돋음',
    'A seed taps into soil and a sprout pops up as a quick twinkling run of warm wooden notes rises and glows.'],
  ['druid-growth', 'druid', 'fast', '생장', '재사용 없음 (2초 시전)', 1, 0.7, true, '덩굴이 뾰로롱 자람',
    'A vine shoots upward with a quick stretching creak and a short rising twinkle of wooden notes.'],
  ['renew-druid', 'druid', 'hot', '피워 내기', '12초', 2, 0.9, true, '꽃봉오리가 뾰로롱 피어남',
    'A bud bursts open in a soft leafy whoosh as a rising twinkle of wooden notes blooms into a warm glow.'],
  ['druid-wildflower', 'druid', 'aoe', '들꽃 군락', '10초', 2, 0.95, true, '들꽃이 뾰로롱 번져 핌',
    'Wildflowers ripple across the ground, a spreading rustle with a cascading twinkle of wooden notes that blooms wide.'],
  ['druid-nature-cleanse', 'druid', 'dispel', '자연 정화', '4초', 1, 0.6, false, '숲바람 뾰로롱, 독기가 털림',
    'A gust of forest wind sweeps up with a quick twinkling run that brushes the residue away and clears.'],
  ['druid-bark', 'druid', 'ext', '나무껍질', '60초', 3, 1.1, false, '나무껍질이 뾰로롱 덮여 단단',
    'Bark grows over an ally with a creaking build and a rising twinkle of wooden notes that settles into a firm knock and a protective glow.'],
  ['hymn-druid', 'druid', 'raid', '고요한 숲', '180초', 4, 1.45, true, '숲 전체가 뾰로롱 깨어남',
    'A whole forest awakens: rustling leaves swell around the party, then a grand cascading twinkle of wooden notes bursts upward and blooms into a wide warm glow.'],
  ['druid-rebirth', 'druid', 'unique', '환생', '전투에 한 번 (3초 시전)', 4, 1.45, true, '씨앗이 뾰로롱 깨어나 생명이 돌아옴',
    'A seed stirs in the earth with a soft rumble, cracks open, and a rising cascade of twinkling wooden notes surges upward into a radiant blossoming glow.'],
  ['druid-spring-rain', 'druid', 'talent', '봄비', '전투에 한 번', 4, 1.4, true, '봄비 속 새싹이 뾰로롱',
    'A warm spring shower patters on leaves while a cascade of twinkling wooden notes rises as sprouts pop up everywhere, glowing softly.'],
  ['druid-forest-memory', 'druid', 'talent', '숲의 기억', '180초', 4, 1.4, false, '숲의 기억이 뾰로롱 메아리',
    'A deep hollow wooden resonance and rustling old leaves swell up with a rising twinkle that echoes back once, glowing.'],
  ['druid-old-tree', 'druid', 'talent', '한 그루의 고목', '90초', 4, 1.45, true, '새싹을 모아 고목이 뾰로롱 치유',
    'Sprouts whoosh inward into one ancient tree, a deep wooden groan builds, then a powerful cascading twinkle of wooden notes bursts upward into a warm glow.'],
  ['druid-crit', 'druid', 'crit', '치명적 치유', '', 1, 0.55, true, '잎이 톡, 뾰롱',
    'A tiny twig snap and one quick bright twinkle of wooden notes.'],

  ['heal-paladin', 'paladin', 'basic', '빛의 손길', '재사용 없음 (2초 시전)', 1, 0.7, true, '빛의 손길이 뾰로롱',
    'A warm touch of holy light: a quick rising twinkle of golden brass notes glows over polished plate.'],
  ['paladin-beacon', 'paladin', 'fast', '봉화', '10초', 2, 0.9, true, '봉화가 뾰로롱 붙음',
    'A beacon flame catches with a bright whoosh and a rising twinkle of brass bells, embers crackling.'],
  ['renew-paladin', 'paladin', 'hot', '빛의 서약', '재사용 없음 (신성한 힘)', 1, 0.6, true, '서약이 뾰로롱 울림',
    'A golden pulse on plate armor with a quick rising twinkle of brass notes.'],
  // 재사용은 없지만 신성한 힘 3칸을 모아 쓰는 큰 기술: 2026-10-22 Lim 「성기사 빛의 파도의 소리는 길고 화려하게」 → 4단계
  ['paladin-light-wave', 'paladin', 'aoe', '빛의 파도', '재사용 없음 (신성한 힘 3칸)', 4, 1.45, true, '빛의 파도가 길게 뾰로롱 밀려 퍼짐',
    'A great wave of holy light swells and rolls outward across the ground: a rising roar of holy flame builds, then a grand cascading twinkle of golden brass bells sweeps wide and rains down into a glorious long glow.'],
  ['paladin-hand-cleanse', 'paladin', 'dispel', '정화의 손', '4초', 1, 0.6, false, '건틀릿 손길이 뾰로롱, 그림자가 걷힘',
    'A gauntleted hand sweeps upward with a quick twinkling run of brass notes that brushes shadow away.'],
  ['paladin-sacrifice', 'paladin', 'ext', '희생', '90초', 4, 1.4, false, '방패를 들자 뾰로롱 빛이 감쌈',
    'A steel shield rises with a firm clank, holy flame swells, and a rising cascade of brass bells rings out into a deep protective glow.'],
  ['hymn-paladin', 'paladin', 'raid', '빛의 성역', '180초', 4, 1.45, true, '성역이 뾰로롱 내려앉음',
    'A great sanctuary descends: a rising roar of holy flame and brass builds, then a grand cascading twinkle of golden bells rains down into a glorious glow.'],
  ['paladin-hand-guard', 'paladin', 'unique', '보호의 손', '300초', 4, 1.45, false, '강철 손이 뾰로롱 감싸 무적',
    'A plate gauntlet clasps shut, then a brilliant rising cascade of brass bells surges around it into a solid shining shell of light.'],
  ['paladin-resolve-fill', 'paladin', 'talent', '가득 찬 빛', '60초', 3, 1.1, false, '신성한 힘이 뾰로롱 차오름',
    'Three quick brass pulses stack upward into a rising twinkle of golden notes that fuses into one full glow.'],
  ['paladin-dawn-vow', 'paladin', 'talent', '새벽의 맹세', '180초', 4, 1.45, false, '새벽빛이 뾰로롱 떠오름',
    'Dawn breaks: a long rising sweep of holy flame climbs through a cascading twinkle of brass bells and blooms into a radiant sunrise glow.'],
  ['paladin-crit', 'paladin', 'crit', '치명적 치유', '', 1, 0.55, true, '갑옷 팅, 뾰롱',
    'A tiny brass ting on polished plate and one quick bright twinkle.'],

  ['heal-shaman', 'shaman', 'basic', '잔물결', '재사용 없음 (2초 시전)', 1, 0.7, true, '잔물결이 뾰로롱 튐',
    'A soft splash and a quick rising run of bright water-drop plinks that ripples and glows.'],
  ['shaman-spring-totem', 'shaman', 'fast', '샘 토템', '10초', 2, 0.9, true, '샘 토템이 쿵, 물이 뾰로롱',
    'A wooden totem thumps into the earth and a spring bubbles up in a rising twinkle of water-drop plinks.'],
  ['renew-shaman', 'shaman', 'hot', '물방울', '4초', 1, 0.55, true, '물방울이 뾰롱',
    'One clear droplet falls and rings with a quick rising twinkle of water plinks.'],
  ['shaman-chain-heal', 'shaman', 'aoe', '연쇄 치유', '재사용 없음 (2.5초 시전)', 1, 0.8, true, '물줄기가 퐁퐁퐁퐁 뾰로롱 이어짐',
    'A splash leaps from pool to pool in four bouncing droplets, each a brighter plink, rising like a twinkling run.'],
  ['shaman-washing', 'shaman', 'dispel', '씻김', '4초', 1, 0.6, false, '물살이 뾰로롱 씻어 내림',
    'A quick rush of stream water pours over stones with a rising twinkle of plinks and drains clear.'],
  ['shaman-earth-totem', 'shaman', 'ext', '대지 토템', '90초', 4, 1.4, false, '대지 토템이 쿠웅, 땅이 뾰로롱 울림',
    'A stone totem slams down with a deep boom, the earth rumbles, and a rising cascade of water plinks and totem knocks swells into a protective glow.'],
  ['hymn-shaman', 'shaman', 'raid', '비구름 토템', '180초', 4, 1.45, true, '비구름이 몰려와 단비가 뾰로롱',
    'A rain cloud gathers with rolling thunder, then a refreshing downpour bursts over everyone in a grand cascading twinkle of countless water plinks on totems and stone.'],
  ['shaman-spirit-link', 'shaman', 'unique', '영혼 잇기', '120초', 4, 1.4, false, '물줄기들이 뾰로롱 하나로 이어짐',
    'Streams of spirit water swirl together in a rising glide of twinkling plinks and merge into one surging pool with a deep totem knock.'],
  ['shaman-totem-call', 'shaman', 'talent', '토템 부르기', '40초', 3, 1.1, false, '토템을 쿵쿵 옮기자 물이 뾰로롱',
    'Totems lift with a hollow knock, swoosh and land with two earthy thumps as a spring splashes up in a bright twinkle of plinks.'],
  ['shaman-water-spirit', 'shaman', 'talent', '물의 정령', '180초', 4, 1.4, false, '물의 정령이 뾰로롱 뛰놂',
    'A water spirit erupts from a pool in a big splashing rush, leaping in a cascading twinkle of plinks and gurgles.'],
  ['shaman-sea-seat', 'shaman', 'talent', '바다의 자리', '180초', 4, 1.45, true, '큰 샘이 콸콸 뾰로롱 솟아오름',
    'A great spring erupts with a rich gush, waves rolling outward under a grand cascading twinkle of water plinks and a soft hide drum.'],
  ['shaman-crit', 'shaman', 'crit', '치명적 치유', '', 1, 0.55, true, '돌 위 물방울 똑, 뾰롱',
    'A tiny crisp water-drop plink on stone and one quick bright twinkle.'],

  ['heal-monk', 'monk', 'basic', '생기 손바닥', '재사용 없음 (1초마다)', 1, 0.55, true, '손바닥 탁, 바람이 뾰로롱',
    'A soft palm lands on cloth with a warm thump and a quick rising twinkle of airy bamboo chimes.'],
  ['monk-mist-wrap', 'monk', 'fast', '안개 감싸기', '10초', 2, 0.9, true, '따스한 안개가 뾰로롱 휘감김',
    'A palm press and a swirl of warm mist wraps around in a rising whoosh with a twinkle of bamboo chimes and a cloth flutter.'],
  ['renew-monk', 'monk', 'hot', '떠도는 안개', '6초', 1, 0.55, true, '김 한 줌이 뾰롱 지나감',
    'A puff of warm steam glides by with a quick rising twinkle of bamboo chimes.'],
  ['monk-mist-breath', 'monk', 'aoe', '안개 숨결', '15초', 2, 1.0, true, '안개 숨결이 뾰로롱 넓게 퍼짐',
    'A long calm rush of warm mist rolls outward as a cascading twinkle of bamboo chimes spreads wide, robes fluttering.'],
  ['monk-clear-chi', 'monk', 'dispel', '맑은 기운', '4초', 1, 0.6, false, '휙 바람에 뾰로롱, 옷자락 탁',
    'A crisp upward whoosh with a quick twinkling run of bamboo chimes and a sharp cloth snap.'],
  ['monk-soothe', 'monk', 'ext', '누그러뜨림', '120초', 4, 1.4, false, '두 손으로 감싸자 바람이 뾰로롱 둘러침',
    'Two palms press onto heavy cloth, then a slow warm wind swirls around in a rising twinkle of bamboo chimes that settles into a protective cocoon.'],
  ['hymn-monk', 'monk', 'raid', '되살림 바람', '180초', 4, 1.45, true, '되살리는 큰 바람이 뾰로롱 휘몰아침',
    'A great wind gathers in a deep inward rush, then sweeps through in a powerful gust with a grand cascading twinkle of bamboo chimes and a breathy flute glissando, robes snapping.'],
  ['monk-tea', 'monk', 'unique', '차 한 잔', '60초', 3, 1.1, false, '차를 쪼르르, 김이 뾰로롱',
    'Warm tea pours into a ceramic cup with a trickle and a clink, and a rising twinkle of bamboo chimes drifts up with the steam.'],
  ['monk-thousand-hands', 'monk', 'talent', '천 개의 손', '90초', 4, 1.4, false, '천 개의 손바닥이 타다닥 뾰로롱',
    'A blazing flurry of palm strikes on cloth accelerates with a rising cascade of bamboo chimes, ending in one sharp burst of air.'],
  ['monk-gather-mist', 'monk', 'talent', '모이는 안개', '60초', 3, 1.1, true, '사방의 김이 뾰로롱 모여 샘이 됨',
    'Warm mist drifts inward from all sides with a rising twinkle of bamboo chimes and gathers into one still glowing pool.'],
  ['monk-chi-burst', 'monk', 'talent', '기 폭발', '120초', 4, 1.45, true, '숨을 모았다가 뾰로롱 펑',
    'Air draws inward with a deep rising rush, then explodes outward in a powerful whoosh and a palm strike as a cascading twinkle of bamboo chimes bursts out.'],
  ['monk-mist-storm', 'monk', 'talent', '안개 폭풍', '180초', 4, 1.45, false, '소용돌이 안개 폭풍이 뾰로롱',
    'Swirling mist spins faster in a rising whirlwind, snapping cloth and a cascading twinkle of bamboo chimes building to a stormy peak, then thinning.'],
  ['monk-crit', 'monk', 'crit', '치명적 치유', '', 1, 0.55, true, '손끝 탁, 뾰롱',
    'A tiny palm tap on taut cloth and one quick bright twinkle of bamboo chime.'],

  ['heal-astrologer', 'astrologer', 'basic', '별빛 치유', '재사용 없음 (2초 시전)', 1, 0.7, true, '별빛이 뾰로롱 치유',
    'A quick rising twinkle of music-box starlight notes glows over a faint deep space hum.'],
  ['astrologer-twinkle', 'astrologer', 'fast', '반짝임', '9초', 2, 0.85, true, '별이 뾰로롱 반짝',
    'A star flares with a quick cascading music-box twinkle and a small shower of glints.'],
  ['renew-astrologer', 'astrologer', 'hot', '별자리 표식', '재사용 없음', 1, 0.55, true, '별 셋이 뾰로롱 이어짐',
    'Three points of starlight light up in a quick rising twinkle of music-box notes.'],
  ['astrologer-starfall', 'astrologer', 'aoe', '별비', '8초', 2, 1.0, true, '별비가 뾰로롱 쏟아짐',
    'A shower of glass stars falls from above in a cascading twinkle of music-box notes over a warm cosmic swell.'],
  ['astrologer-clear-star', 'astrologer', 'dispel', '맑은 별빛', '4초', 1, 0.6, false, '별빛이 뾰로롱 맑게 갬',
    'A clean ascending sweep of starlight, a quick twinkling run with a reversed shimmer that clears.'],
  ['astrologer-star-sleep', 'astrologer', 'ext', '별의 잠', '120초', 4, 1.4, false, '별빛 이불이 뾰로롱 덮임',
    'A deep cosmic swell wraps around like a starry blanket as a cascading twinkle of music-box notes descends into a hushed glowing hum.'],
  ['hymn-astrologer', 'astrologer', 'raid', '별의 기억', '180초', 4, 1.45, true, '별빛이 뾰로롱 되감기며 되돌림',
    'Starlight rewinds through time: a wide reversed shimmer swirls backward and a grand cascading twinkle of music-box notes rises into a brilliant starburst.'],
  ['astrologer-polaris', 'astrologer', 'unique', '북극성', '12초', 2, 1.0, true, '북극성이 뾰로롱 빛남',
    'One guiding star ignites overhead with a rising twinkle of music-box notes and a pure ringing glass tone above a deep hum.'],
  ['astrologer-falling-night', 'astrologer', 'talent', '내리는 밤', '90초', 4, 1.4, false, '밤이 내려앉고 별이 뾰로롱 하나둘',
    'Night falls: a deep cosmic swell descends into velvet calm as countless stars light up in a growing cascading twinkle of music-box notes.'],
  ['astrologer-supernova', 'astrologer', 'talent', '초신성', '180초', 4, 1.45, true, '별이 부풀어 뾰로롱 터짐',
    'A tiny star glints, swells with a rising celestial shimmer, and explodes in a brilliant cascading burst of music-box twinkles with a deep afterglow.'],
  ['astrologer-milky-way', 'astrologer', 'talent', '은하수', '180초', 4, 1.4, false, '은하수가 뾰로롱 흐름',
    'A river of countless stars sweeps across the sky in a lively rising stream of cascading music-box twinkles.'],
  ['astrologer-crit', 'astrologer', 'crit', '치명적 치유', '', 1, 0.55, true, '작은 별빛 뾰롱',
    'One quick bright music-box twinkle of starlight.'],

  ['heal-warder', 'warder', 'basic', '인장 치유', '재사용 없음 (2초 시전)', 1, 0.7, true, '인장이 뾰로롱 붙음',
    'A quick rising twinkle of crystal glass pings and a small seal clicking into place.'],
  ['warder-judgment', 'warder', 'fast', '심판', '재사용 없음 (2초 시전)', 1, 0.7, true, '인장 셋이 착착착 뾰로롱',
    'Three crisp crystal seal clicks crack open in quick succession, each a brighter glass ping rising like a twinkling run.'],
  ['renew-warder', 'warder', 'hot', '빛의 막', '6초', 1, 0.55, false, '빛의 막이 뾰롱 씌워짐',
    'A thin crystal barrier snaps closed with a quick rising twinkle of glass pings and a short hum.'],
  ['warder-ward-circle', 'warder', 'aoe', '결계 원', '20초', 3, 1.1, false, '결계 원이 뾰로롱 둘러서 잠김',
    'A ring of crystal panels rises around in a quick chain of glass pings, a cascading twinkle closing the circle with a firm seal lock and a force-field hum.'],
  ['warder-ward-cleanse', 'warder', 'dispel', '결계 정화', '4초', 1, 0.6, false, '인장이 딸깍 돌며 뾰로롱',
    'A crystal seal turns with a clean click and a quick rising twinkle of glass pings that clears.'],
  ['warder-guard-ward', 'warder', 'ext', '수호 결계', '45초', 3, 1.1, false, '두꺼운 수정벽이 뾰로롱 잠김',
    'Thick crystal walls slide together with a rising cascade of glass pings and lock with a deep seal clunk, a protective force-field humming.'],
  ['hymn-warder', 'warder', 'raid', '빛의 장막', '180초', 4, 1.45, false, '거대한 수정 장막이 뾰로롱 펼쳐짐',
    'A vast crystal veil unfolds over everyone: panels open in a rapid chain of glass pings, a grand cascading twinkle rising into one massive humming dome, sealed with a heavy lock.'],
  ['warder-ward-hold', 'warder', 'unique', '결계 굳히기', '40초', 3, 1.1, false, '결계가 뾰로롱 꾸욱 굳어짐',
    'Crystal barriers thicken with a deep glassy swell and a rising twinkle of pings, then two solid seal clicks lock everything in place.'],
  ['warder-judge-hammer', 'warder', 'talent', '심판의 망치', '60초', 3, 1.1, false, '수정 망치가 뾰로롱 쾅',
    'A crystal hammer rises with a quick twinkling run of glass pings and strikes a seal with a heavy impact, a clear resonant ring spreading.'],
  ['warder-citadel', 'warder', 'talent', '성채', '180초', 4, 1.45, false, '수정 성채가 뾰로롱 솟아 잠김',
    'Tall crystal walls rise from the ground in a grand cascading twinkle of glass pings and lock with a heavy seal clunk, a deep fortress force-field roaring to life.'],
  ['warder-endless-judge', 'warder', 'talent', '끝없는 심판', '180초', 4, 1.45, false, '인장이 끝없이 뾰로롱 올라감',
    'A rapid ascending chain of crystal seal clicks and glass pings climbs higher and higher into one brilliant humming peak and a final heavy lock.'],
  ['warder-crit', 'warder', 'crit', '치명적 치유', '', 1, 0.55, true, '수정 인장 찰칵, 뾰롱',
    'A tiny crystal seal click and one quick bright glass twinkle.'],
];

const BASE = /^(heal|renew|hymn)-/;
const sound = ([name, hero, role, what, cd, tier, keep, heal, ko, desc]) => ({
  name, group: BASE.test(name) ? '직업' : '직업 기술',
  where: `${HERO_KO[hero]} ${role === 'crit' ? '치명적 치유' : role === 'talent' ? `특성 버튼 「${what}」` : `${ROLE_KO[role]} 「${what}」`}${cd ? ` (재사용 ${cd})` : ''}`,
  ko, p: BASE.test(name) ? 'P0' : 'P1', gen: 2, keep, presence: true, tier, cd, hero, role, skill: what, heal,
  prompt: `${HEAD}${desc} ${SPARKLE} ${COLOR[hero]} ${tail(tier, keep)}`, match: desc,
});

/** 직접 힐 · 지속 힐 · 공대 기술 (sounds.mjs 「직업」 묶음) */
export const CLASS_BASE = ROWS.filter(r => BASE.test(r[0])).map(sound);
/** 그 밖의 기술 · 특성 버튼 · 치명적 치유 */
export const CLASS_SOUNDS = ROWS.filter(r => !BASE.test(r[0])).map(sound);
