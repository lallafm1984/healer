export function walk(dir: string): string[];
export function scanKeys(root: string): { key: string; file: string; line: number; bad: boolean }[];
export function scanHtmlKeys(file: string): string[];
export function slots(s: string): string;
