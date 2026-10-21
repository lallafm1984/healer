import { readFileSync } from 'node:fs';
const specs = JSON.parse(readFileSync(new URL('./priest-theme.json', import.meta.url), 'utf8'));
export const PRIEST_SOUNDS = specs.map(s => ({
  name: s.name, group: '사제 스킬', where: `사제 ${s.ko}`, ko: s.ko, p: 'P0',
  gen: Math.max(2, s.duration + .2), keep: s.duration,
  prompt: s.prompt ?? `${s.description} Warm airy choir-like synthetic harmonics, a smooth holy healing aura. No words, lyrics, drums, bell strikes or harsh noise.`,
  match: s.description,
}));
