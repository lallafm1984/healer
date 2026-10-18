/**
 * 파티원 200명 (74 문서, 2026-10-14 Lim 「닉네임과 직업을 매칭」 · 「파티원 마다 스킬 및 성격을 부여」):
 * MMO 유저 닉네임 2~5자 + 성격 + 직업 스킬을 묶어 둔 목록. 공개모집은 직업을 정한 뒤 그 직업 목록에서 한 명을 뽑는다.
 * 직업군 비율 = 탱커 25% · 근접 30% · 원거리 45% → 전사 · 수호기사 25 · 도적 · 광전사 · 검사 20 · 마법사 · 궁수 · 사냥꾼 30
 * 성격 30종 (75)은 직업마다 고르게: 탱커 직업은 탱커 가능 25종을 1명씩, 원거리 직업은 30종을 1명씩, 근접 세 직업은 30종을 2번씩 나눠 가졌고,
 * 95 1차 (2026-10-18)에서 39명을 새 성격 15종으로 바꿈: 탱커 묶음 6종은 두 탱커 직업에 1명씩 (생존기 성격은 방어 능력 파티원), 손버릇 · 힐 9종은 딜러 3명씩
 * (끊기 욕심은 끊기 능력 파티원). 95 2차에서 75명을 기존 묶음 새 성격 25종으로 바꿈 (25종 3명씩, 옛 30종은 3명씩 · 희귀 4종은 2명씩 남김,
 * 마법사 「얼음땡」은 같은 이름 성격이 생겨 「얼음장」으로). 한 직업 안에서 성격은 겹치지 않음.
 * 스킬 등급은 공개모집 확률 (일반 66 · 고급 27 · 희귀 7%)에 맞춤: 탱커 16 · 7 · 2, 근접 13 · 6 · 1, 원거리 20 · 8 · 2
 * 스토리 동료 이름(10 문서 2장)은 STORY_NICKS로 따로 두고 무작위로 뽑지 않는다.
 */
import type { ClassKey } from './classes';
import { PERS, type PersName } from './personalities';

export interface PoolMember {
  nick: string;
  pers: PersName;
  /** 직업 스킬 키 (abilities.ts, 직업.키) */
  ab: string;
}

type Row = [nick: string, pers: PersName, ab: string];

const ROWS: Record<ClassKey, Row[]> = {
  warrior: [
    ['방패든양', '신중파', 'shieldBlock'], ['버스기사', '양보왕', 'battleShout'], ['맞고보자', '아슬아슬', 'defStance'], ['고인물', '고집불통', 'spellReflect'], ['어그로장인', '눈치백단', 'taunt'],
    ['도발왕', '쫄 모으기', 'taunt'], ['몸빵전문', '든든이', 'shieldWall'], ['강철심장', '오뚝이', 'lastStand'], ['철벽수비', '칭찬왕', 'shieldWall'], ['판금아재', '보은형', 'bandage'],
    ['무쇠곰', '미리미리', 'defStance'], ['도발중독', '샘쟁이', 'taunt'], ['탱커지망생', '뉴비', 'bandage'], ['돌격대장', '앞장이', 'battleShout'], ['깡통갑옷', '감사형', 'shieldBlock'],
    ['피통부자', '자급자족', 'lastStand'], ['방패가본체', '집돌이', 'shieldBlock'], ['인간성벽', '영웅', 'intervene'], ['든든한형', '큰형', 'intervene'], ['앞줄지킴이', '응원단장', 'demoShout'],
    ['통곡의벽', '참을성', 'shieldWall'], ['어깨빵', '어그로 흘림', 'demoShout'], ['강철거북', '느림보', 'spellReflect'], ['투구소년', '용두사미', 'battleShout'], ['묵직한방패', '끈기형', 'demoShout'],
  ],
  paladin: [
    ['탱하기싫다', '어그로 흘림', 'wrath'], ['수호천사', '영웅', 'protection'], ['빛의방패', '참을성', 'devotion'], ['맹세한기사', '고집불통', 'vow'], ['기사도정신', '보은형', 'sacrifice'],
    ['은빛방패', '침착함', 'avenger'], ['지켜줄게', '짝꿍', 'sacrifice'], ['지킴이대장', '든든이', 'devotion'], ['백기사', '신바람', 'protection'], ['정의의망치', '다혈질', 'hammer'],
    ['축복받은몸', '쉬엄쉬엄', 'oath'], ['햇살방패', '낙천가', 'devotion'], ['금빛투구', '관심종자', 'vow'], ['맹세의검', '쫄 모으기', 'wrath'], ['빛나는갑옷', '아슬아슬', 'divineShield'],
    ['약속의방패', '미리미리', 'vow'], ['기사단막내', '분위기메이커', 'cleanse'], ['철통수호', '느림보', 'avenger'], ['방패의신', '눈치백단', 'divineShield'], ['끝까지지킴', '자급자족', 'oath'],
    ['든든기사', '승부사', 'sacrifice'], ['기도하는탱', '끈기형', 'cleanse'], ['무적방패', '이기주의자', 'hammer'], ['순백기사', '외톨이', 'hammer'], ['갑옷광택', '앞장이', 'wrath'],
  ],
  rogue: [
    ['감자도적', '덜렁이', 'tricks'], ['회피의신', '자립형', 'evasion'], ['냥냥펀치', '끊기 욕심', 'kick'], ['새벽세시', '모서리파', 'cloak'], ['그림자걸음', '침착함', 'vanish'],
    ['뒤통수전문', '외골수', 'deathMark'], ['은신중', '겁쟁이', 'vanish'], ['독칼', '보은형', 'kidney'], ['단검두개', '울보', 'kidney'], ['몰래한방', '몰입형', 'sprint'],
    ['등뒤조심', '큰형', 'cloak'], ['지갑털이', '뒷줄파', 'tricks'], ['밤고양이', '방랑자', 'sprint'], ['쌍단검', '짝꿍', 'cloak'], ['안개걸음', '쉬엄쉬엄', 'smoke'],
    ['급소찌르기', '대기만성', 'kick'], ['발소리없음', '소심이', 'vial'], ['날쌘다람쥐', '점프광', 'evasion'], ['기습왕', '지속힐 체질', 'vial'], ['소매치기', '비관론자', 'smoke'],
  ],
  berserker: [
    ['장판요정', '덜렁이', 'frenzy'], ['딜뽕', '스킬 난사', 'reckless'], ['오늘만산다', '오뚝이', 'deathWish'], ['도끼든토끼', '얼음땡', 'rage'], ['분노조절중', '다혈질', 'rage'],
    ['화난곰', '대타', 'regen'], ['쌍도끼', '짝꿍', 'whirl'], ['미친돌격', '앞장이', 'charge'], ['막무가내', '화풀이', 'reckless'], ['돌진중독', '관심종자', 'charge'],
    ['성난멧돼지', '폭주기관차', 'frenzy'], ['앞뒤안가림', '따라쟁이', 'bladestorm'], ['박치기왕', '쫄 사냥꾼', 'whirl'], ['버럭버럭', '사교형', 'bShout'], ['근육뇌', '큰 힐 체질', 'frenzy'],
    ['도끼한방', '칭찬왕', 'bladestorm'], ['우당탕', '방랑자', 'regen'], ['불도저', '보호막 애호가', 'rally'], ['함성대장', '응원단장', 'rally'], ['일단때림', '신바람', 'bShout'],
  ],
  swordsman: [
    ['컨트롤장인', '큰형', 'flash'], ['만렙꿈나무', '대기만성', 'meditate'], ['검성지망생', '완벽주의자', 'draw'], ['바람의검', '큰 힐 체질', 'kiai'], ['한줄기검', '쿨 아끼미', 'flash'],
    ['발도술', '타이밍 장인', 'draw'], ['칼바람', '쫄 사냥꾼', 'wave'], ['검객', '외톨이', 'parry'], ['달빛검사', '지속힐 체질', 'meditate'], ['한칼승부', '승부사', 'counter'],
    ['검무', '사교형', 'guardForm'], ['칼춤추는곰', '분위기메이커', 'wave'], ['유랑검객', '참을성', 'parry'], ['이도류', '대타', 'counter'], ['칼같은퇴근', '비관론자', 'bladeGuard'],
    ['무사수행', '자립형', 'mushin'], ['벚꽃검', '낙천가', 'kiai'], ['검기충전', '감사형', 'guardForm'], ['검끝', '소심이', 'bladeGuard'], ['칼집', '따라쟁이', 'parry'],
  ],
  mage: [
    ['불꽃남자', '화풀이', 'iceBlock'], ['얼음공주', '샘쟁이', 'iceBarrier'], ['야근요정', '울보', 'invis'], ['메테오', '딜 욕심쟁이', 'iceWard'], ['파이어볼', '허세꾼', 'iceBlock'],
    ['함박눈', '쫄 사냥꾼', 'frostNova'], ['번개맞은곰', '오뚝이', 'blink'], ['지팡이장인', '끊기 욕심', 'counterspell'], ['순간이동', '겁쟁이', 'blink'], ['주문외우기', '뉴비', 'counterspell'],
    ['유성우', '집돌이', 'rewind'], ['화염술사', '경쟁심', 'rewind'], ['얼음장', '얼음땡', 'frostNova'], ['마법소녀', '분위기메이커', 'poly'], ['마나중독', '스킬 난사', 'invis'],
    ['불장난', '점프광', 'blink'], ['뾰족모자', '타이밍 장인', 'poly'], ['마법학도', '신중파', 'counterspell'], ['빙결', '보호막 애호가', 'iceBarrier'], ['쩌릿쩌릿', '예민형', 'poly'],
    ['폭발전문', '폭주기관차', 'iceWard'], ['비전폭발', '이기주의자', 'iceWard'], ['견습마법사', '뒷줄파', 'blink'], ['화르륵', '사교형', 'iceBlock'], ['서리꽃', '느림보', 'frostNova'],
    ['천둥소녀', '영웅', 'iceBarrier'], ['룬문자', '완벽주의자', 'counterspell'], ['마력폭주', '모서리파', 'timeWarp'], ['수정구슬', '예언가', 'timeWarp'], ['노을빛마법', '감사형', 'invis'],
  ],
  archer: [
    ['딜미터1등', '딜 욕심쟁이', 'rapid'], ['원딜장인', '끊기 욕심', 'harass'], ['별빛궁수', '미신쟁이', 'trueshot'], ['활쏘는곰', '끈기형', 'disengage'], ['백발백중', '허세꾼', 'aimedShot'],
    ['명사수', '타이밍 장인', 'hawkEye'], ['화살비', '스킬 난사', 'multiShot'], ['독수리눈', '예언가', 'hawkEye'], ['헤드샷', '외골수', 'snipe'], ['저격수', '외톨이', 'snipe'],
    ['화살배달', '양보왕', 'multiShot'], ['바람의화살', '신바람', 'multiShot'], ['연사왕', '폭주기관차', 'rapid'], ['활시위', '소심이', 'disengage'], ['큐피드', '샘쟁이', 'trueshot'],
    ['빗나감없음', '예민형', 'survivor'], ['화살통', '칭찬왕', 'harass'], ['새벽궁수', '대기만성', 'camo'], ['눈썰미궁수', '신중파', 'hawkEye'], ['은빛화살', '보호막 애호가', 'survivor'],
    ['사거리끝', '모서리파', 'disengage'], ['먼산저격', '이기주의자', 'harass'], ['활든요정', '점프광', 'camo'], ['화살장인', '몰입형', 'trueshot'], ['숲속궁수', '쉬엄쉬엄', 'camo'],
    ['관통샷', '다혈질', 'multiShot'], ['조준중', '쿨 아끼미', 'aimedShot'], ['멀리서딜', '뒷줄파', 'disengage'], ['십점만점', '용두사미', 'aimedShot'], ['한발더', '뉴비', 'rapid'],
  ],
  hunter: [
    ['초코우유', '양보왕', 'firstAid'], ['늦잠왕', '집돌이', 'feign'], ['펫이본체', '관심종자', 'pet'], ['늑대랑산책', '방랑자', 'primal'], ['덫놓는곰', '덜렁이', 'trap'],
    ['함정전문', '고집불통', 'trap'], ['곰돌이조련', '허세꾼', 'callWild'], ['멍멍대장', '응원단장', 'pet'], ['추적자', '외골수', 'cheetah'], ['숲속캠핑', '자립형', 'feign'],
    ['숲지기', '침착함', 'firstAid'], ['매사냥', '딜 욕심쟁이', 'bestial'], ['올빼미친구', '큰 힐 체질', 'misdirect'], ['고양이집사', '따라쟁이', 'pet'], ['덫설치중', '쿨 아끼미', 'trap'],
    ['펫먹이줌', '지속힐 체질', 'firstAid'], ['길들이기', '울보', 'primal'], ['동물농장', '낙천가', 'callWild'], ['늑대소녀', '화풀이', 'bestial'], ['그물던지기', '완벽주의자', 'turtle'],
    ['발자국추적', '예언가', 'cheetah'], ['호랑이친구', '대타', 'bestial'], ['여우꼬리', '예민형', 'cheetah'], ['몰이꾼', '경쟁심', 'misdirect'], ['부엉부엉', '미신쟁이', 'misdirect'],
    ['털뭉치', '얼음땡', 'feign'], ['독덫', '승부사', 'turtle'], ['미끼', '겁쟁이', 'feign'], ['개껌배달', '용두사미', 'pet'], ['산짐승', '비관론자', 'turtle'],
  ],
};

/** 직업별 파티원 (이름 · 성격 · 직업 스킬) */
export const PARTY_POOL = Object.fromEntries(
  Object.entries(ROWS).map(([cls, rows]) => [cls, rows.map(([nick, pers, ab]): PoolMember => ({ nick, pers, ab: `${cls}.${ab}` }))]),
) as unknown as Record<ClassKey, readonly PoolMember[]>;

/** 직업별 닉네임만 */
export const CLASS_NICKS = Object.fromEntries(Object.entries(PARTY_POOL).map(([cls, list]) => [cls, list.map(m => m.nick)])) as unknown as Record<ClassKey, readonly string[]>;

/** 스토리 동료 (10 문서 2장, 고정 영입 예정): 무작위 파티원 · 길드 지원자 이름으로 쓰지 않음 */
export const STORY_NICKS: readonly string[] = ['말없는탱', '이슬', '칼날'];

/** 희귀 성격 (04 6-F) 파티원이 뽑힐 가중치 */
export const RARE_WEIGHT = 0.4;

/**
 * 공개모집 파티원 1명 (75): 그 직업 목록에서 안 쓴 사람 중, 저레벨 던전이면 희귀 빼고 · 탱커는 ★1만 · ★★★는 파티당 1명까지 (04 6-F).
 * 희귀 성격은 가중치 0.4. 맞는 사람이 없으면 조건을 하나씩 풀고, 다 썼으면 null
 */
export function pickMember(cls: ClassKey, r: () => number, used: ReadonlySet<string>, o: { low?: boolean; tank?: boolean; hard?: number } = {}): PoolMember | null {
  const free = PARTY_POOL[cls].filter(m => !used.has(m.nick) && (o.tank ? !('noTank' in PERS[m.pers]) : !('tankOnly' in PERS[m.pers]))); // 탱커 묶음 (95)은 탱커로만
  const rare = (m: PoolMember) => 'rare' in PERS[m.pers];
  const strict = free.filter(m => !o.low || (!rare(m) && (!o.tank || PERS[m.pers].star === 1) && ((o.hard ?? 0) < 1 || PERS[m.pers].star < 3)));
  const list = strict.length ? strict : free;
  if (!list.length) return null;
  const w = (m: PoolMember) => (rare(m) ? RARE_WEIGHT : 1);
  let x = r() * list.reduce((a, m) => a + w(m), 0);
  for (const m of list) { x -= w(m); if (x < 0) return m; }
  return list[list.length - 1];
}

/**
 * 직업 목록에서 아직 안 쓴 이름 하나 (난수 1번). 다 썼으면 목록 이름 뒤에 숫자 (방패든양2). 길드 지원자용
 */
export function pickNick(cls: ClassKey, r: () => number, used: ReadonlySet<string>): string {
  const list = CLASS_NICKS[cls];
  const free = list.filter(n => !used.has(n));
  if (free.length) return free[Math.floor(r() * free.length)];
  const base = list[Math.floor(r() * list.length)];
  let i = 2;
  while (used.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}
