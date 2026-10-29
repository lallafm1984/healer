/**
 * 다국어 (기획 121, 2026-10-29 Lim 「설정에 언어 선택 (한국어 · English · 日本語, 기본은 기기 언어)」 · 「한국어 UI는 1px도 깨지지 않게」).
 * 열쇠 = 한국어 원문: t('출전') · t('휴식 보너스 +{n}', { n }). 한국어면 자리값만 끼워 그대로 돌려준다 (사전을 안 봄) → 한국어 화면은 예전과
 * 바이트 단위로 같다 (tests/e2e/i18n-ko.mjs 스냅샷). 영어 · 일본어는 사전 (en.ts · ja.ts)에서 찾고 없으면 한국어 그대로.
 * 사전은 정적 import (2026-10-29 2단계 ⑤: 동적 import는 game 층이 i18n을 쓰면 시뮬 rolldown 단일 파일 묶음을 깨뜨렸음. 앱은 로컬 파일이라 묶음 크기보다 단순함이 낫다).
 * 언어는 localStorage healer.lang (저장 파일 밖: 「저장 지우고 처음부터」 · 서버 백업과 상관없는 기기 설정), 없으면 기기 언어 (ko → 한국어, ja → 일본어, 그 밖 영어).
 * t()는 화면 층 (screens · battle · platform · game)에서만. engine · data · sim의 한국어는 열쇠 · 저장 값 (난이도 '쉬움' · 등급 '희귀')이라 보여 줄 때 거친다 (AGENTS.md 「다국어」).
 * 이 모듈은 읽히는 순간 언어를 정하므로, 여기서 t를 가져오는 모듈은 import 시점부터 t를 쓸 수 있다 (screen() 이름 · 탭 이름).
 */
import en from './en';
import ja from './ja';
import enNames from './names-en';
import jaNames from './names-ja';
import enPlaces from './places-en';
import jaPlaces from './places-ja';
import enEnemies from './enemies-en';
import jaEnemies from './enemies-ja';
import enBossSkills from './boss-skills-en';
import jaBossSkills from './boss-skills-ja';
import enBossParts from './boss-parts-en';
import jaBossParts from './boss-parts-ja';
export type Lang = 'ko' | 'en' | 'ja';
export interface LangDef { key: Lang; /** 설정 칩 글 (늘 그 말로, 번역하지 않음) */ name: string; locale: string }
export const LANGS: readonly LangDef[] = [
  { key: 'ko', name: '한국어', locale: 'ko-KR' },
  { key: 'en', name: 'English', locale: 'en-US' },
  { key: 'ja', name: '日本語', locale: 'ja-JP' },
];
export const LANG_KEY = 'healer.lang';
export type Dict = Record<string, string>;

const isLang = (v: unknown): v is Lang => v === 'ko' || v === 'en' || v === 'ja';
const hasWindow = typeof window !== 'undefined' && typeof document !== 'undefined';

/** 저장된 언어, 없으면 기기 언어 (브라우저에서만 봄: 단위 테스트 · 시뮬은 한국어) */
export function detectLang(): Lang {
  try {
    const saved = hasWindow ? localStorage.getItem(LANG_KEY) : null;
    if (isLang(saved)) return saved;
  } catch { /* 저장소를 못 읽으면 기기 언어 */ }
  if (!hasWindow) return 'ko';
  const tag = (navigator.languages?.[0] ?? navigator.language ?? '').toLowerCase();
  return tag.startsWith('ko') ? 'ko' : tag.startsWith('ja') ? 'ja' : 'en';
}

let cur: Lang = 'ko';
let dict: Dict = {};
const listeners: (() => void)[] = [];

/** UI 사전 + 이름 사전 (데이터 이름 names · 장소 places · 적 enemies · 보스 기술 boss-skills · 보스 부품 boss-parts, 121 3단계 ①). 사전끼리 열쇠는 겹치지 않는다 (tests/i18n-names.test.ts) */
const DICTS: Record<Exclude<Lang, 'ko'>, Dict> = { en: { ...enNames, ...enPlaces, ...enEnemies, ...enBossSkills, ...enBossParts, ...en }, ja: { ...jaNames, ...jaPlaces, ...jaEnemies, ...jaBossSkills, ...jaBossParts, ...ja } };
/** 그 언어 사전 (한국어는 빈 것: 열쇠가 곧 글) */
export const loadDict = (l: Lang): Dict => (l === 'ko' ? {} : DICTS[l]);

function apply(l: Lang): void {
  dict = loadDict(l);
  cur = l;
  if (hasWindow) document.documentElement.lang = l;
}

/** 지금 언어 */
export const lang = (): Lang => cur;
/** 지금 언어의 Intl 로케일 (숫자 · 날짜) */
export const locale = (): string => LANGS.find(l => l.key === cur)!.locale;
/** 설정에서 고름: 저장하고 사전을 읽은 뒤 등록한 곳 (정적 글 · 탭)에 알림. 부른 쪽이 지금 화면을 다시 그린다 */
export async function setLang(l: Lang): Promise<void> {
  if (hasWindow) { try { localStorage.setItem(LANG_KEY, l); } catch { /* 저장소가 막혀도 이번 실행은 바뀜 */ } }
  apply(l);
  listeners.forEach(fn => fn());
}
export function onLangChange(fn: () => void): void { listeners.push(fn); }

const fill = (s: string, p?: Record<string, string | number>): string =>
  (p ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in p ? String(p[k]) : m)) : s);
/**
 * 한국어 원문 → 지금 언어. 자리값은 {이름}: t('휴식 보너스 +{n}', { n: 3 }).
 * 한국어면 사전을 보지 않고 원문 그대로 (자리값만 끼움). 다른 언어에 그 열쇠가 없으면 한국어 그대로 보임 (단위 테스트가 코드의 열쇠를 모두 사전에서 찾음)
 */
export function t(ko: string, p?: Record<string, string | number>): string {
  return fill(cur === 'ko' ? ko : (dict[ko] ?? ko), p);
}
/**
 * 자리 꼬리표가 있는 번역: 같은 한국어가 좁은 자리 (로비 팻말)에서는 더 짧은 말이어야 할 때. 사전 열쇠 '주간 도전@short'를 먼저 보고 없으면 '주간 도전'.
 * 한국어는 꼬리표와 상관없이 원문 그대로 (화면 글이 바뀌지 않음)
 */
export function tc(ko: string, ctx: string, p?: Record<string, string | number>): string {
  return fill(cur === 'ko' ? ko : (dict[`${ko}@${ctx}`] ?? dict[ko] ?? ko), p);
}

// ---------- 숫자 ----------
const compacts = new Map<string, Intl.NumberFormat>();
/** 좁은 자리 (위 정보창 골드): 1만부터 줄여 씀, 버림. 한 1.23만 · 12.3만 · 1.23억, 영 12.3K · 123K · 1.23M, 일 1.23万 · 12.3万 · 1.23億. 무제한이면 ∞ */
export function shortAmount(n: number): string {
  if (!isFinite(n)) return '∞';
  if (n < 10000) return Math.floor(n).toLocaleString(locale());
  const loc = locale();
  let f = compacts.get(loc);
  if (!f) { f = new Intl.NumberFormat(loc, { notation: 'compact', maximumSignificantDigits: 3, roundingMode: 'trunc' }); compacts.set(loc, f); }
  return f.format(Math.floor(n));
}
/** 자릿수 쉼표 (반올림) */
export const fmtInt = (n: number): string => Math.round(n).toLocaleString(locale());

apply(detectLang());
