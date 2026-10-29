export const TERMS: { ko: string; en: string[]; ja: string[]; not?: string[] }[];
export const EXCEPT: Record<string, string>;
export function checkTerms(dict: Record<string, string>, lang: 'en' | 'ja'): { key: string; term: string; text: string }[];
