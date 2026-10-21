import { create, use, useTalent } from '../../src/engine';
import { addDebuff, damage } from '../../src/engine/core';
import { healerTick } from '../../src/engine/healer';
import { TALENTS, type TalentKey } from '../../src/data/talents';
import { SKILLS, type SkillKey } from '../../src/data/skills';
import { priestSounds, PRIEST_SKILL_SOUNDS, PRIEST_TALENT_SOUNDS, PRIEST_FEEDBACK_SOUNDS } from '../../src/battle/priest-sound';
import { audioCtx, preloadSfx, setSfxOn, sfx } from '../../src/sfx';
import { MAX_SFX_SECONDS } from '../../src/sfx/timing';

type Spec = { name: string; ko: string; duration: number; texture?: string; retained?: boolean; shortened?: boolean };
const specs: Spec[] = await (await fetch('./priest-theme.json')).json();
document.querySelector('#sequence')!.textContent = `${specs.length}종 순서대로 듣기`;
const files = import.meta.glob<string>('../../src/sfx/*.ogg', { eager: true, query: '?url', import: 'default' });
const status = document.querySelector<HTMLElement>('#status')!;
const checks = document.querySelector<HTMLElement>('#checks')!;
const mute = document.querySelector<HTMLInputElement>('#mute')!;
let generation = 0;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function ready() { audioCtx(); await preloadSfx(); }
function emit(name: string, vol = 1) { sfx(name, { vol }); }
function exercise(spec: Spec) {
  const skill = Object.entries(PRIEST_SKILL_SOUNDS).find(([, n]) => n === spec.name)?.[0] as SkillKey | undefined;
  const talent = Object.entries(PRIEST_TALENT_SOUNDS).find(([, n]) => n === spec.name)?.[0] as TalentKey | undefined;
  const selections = TALENTS.map(t => { const i = t.picks.findIndex(p => p.key === talent); return i < 0 ? null : i; });
  const f = create({ encounter: 'warden', diff: '쉬움', seed: 7, level: 100, hero: 'priest', talents: selections });
  f.gear.crit = 0; f.events.length = 0; f.used = [];
  const u = f.party.find(u => !u.me)!; u.hp = u.max * .4;
  if (skill) {
    if (skill === 'purify') addDebuff(f, u, { name: '시험', type: '마법', left: 20 });
    if (skill === 'serenity') f.g.p = 100;
    const result = use(f, skill, u.cell);
    if (!result.ok) throw new Error(result.reason);
    for (let i = 0; f.cast && i < 200; i++) { f.t += .05; healerTick(f); }
  } else if (talent) {
    const result = useTalent(f, talent, f.cells.findIndex(c => !c.unit));
    if (!result.ok) throw new Error(result.reason);
  } else if (spec.name === 'priest-rescue') { u.hp = 1; u.guardian = 10; damage(f, u, u.max * 10); }
  else if (spec.name === 'priest-relay-hop') { use(f, 'relay', u.cell); f.events.length = 0; f.used = []; damage(f, u, 10); }
  else { emit(spec.name); return [spec.name]; }
  const plan = priestSounds(f);
  const names = plan.cues.map(c => c.name);
  for (const cue of plan.cues) emit(cue.name, cue.vol);
  for (const event of f.events) {
    if (event.type === 'sound' && !plan.suppress.has(event.name)) { emit(event.name); names.push(event.name); }
    if (event.type === 'gauge' && !plan.suppress.has('gauge')) { emit(PRIEST_FEEDBACK_SOUNDS.gauge); names.push(PRIEST_FEEDBACK_SOUNDS.gauge); }
  }
  if (!names.includes(spec.name)) throw new Error('스킬 연결 누락: '+spec.name);
  return names;
}
async function play(spec: Spec) {
  await ready();
  const names = exercise(spec);
  status.dataset.played = JSON.stringify(names);
  status.textContent = mute.checked ? `${spec.ko} · 음소거 중` : `${spec.ko} · ${spec.duration.toFixed(2)}초 재생`;
  document.querySelectorAll<HTMLButtonElement>('.cue').forEach(b => { b.dataset.active = String(b.dataset.name === spec.name); });
}
for (const [i, spec] of specs.entries()) {
  const button = document.createElement('button'); button.className = 'cue'; button.dataset.name = spec.name;
  const title = document.createElement('b'); title.textContent = spec.ko;
  const detail = document.createElement('span');
  const key = Object.entries(PRIEST_SKILL_SOUNDS).find(([, n]) => n === spec.name)?.[0] as SkillKey | undefined;
  detail.textContent = `${spec.duration.toFixed(2)}초${key ? ` · Lv ${SKILLS[key].lv}` : ''}${spec.retained ? spec.shortened ? ' · 음색 유지' : ' · 유지' : ''}${spec.texture ? ` · ${spec.texture}` : ''}`;
  button.append(title, detail);
  button.addEventListener('click', () => { generation++; void play(spec).catch(e => { status.textContent = String(e); }); });
  document.querySelector(i < 9 ? '#skills' : i < 13 ? '#talents' : '#feedback')!.append(button);
}
document.querySelector('#check')!.addEventListener('click', async () => {
  const button = document.querySelector<HTMLButtonElement>('#check')!; button.disabled = true;
  try {
    const ctx = new OfflineAudioContext(2, 1, 44100); const results = [];
    for (const spec of specs) {
      const url = files[`../../src/sfx/${spec.name}.ogg`];
      const response = await fetch(url); if (!response.ok) throw new Error(spec.name+' HTTP '+response.status);
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      if (buffer.numberOfChannels !== 2 || Math.abs(buffer.duration-spec.duration) > .01 || buffer.duration > MAX_SFX_SECONDS) throw new Error(spec.name+' 형식·길이 불일치');
      results.push({ name: spec.name, seconds: buffer.duration, channels: buffer.numberOfChannels });
    }
    checks.dataset.results = JSON.stringify(results);
    const all = [...results];
    for (const [path, url] of Object.entries(files)) {
      const name = path.split('/').pop()!.replace(/\.ogg$/, '');
      if (specs.some(s => s.name === name)) continue;
      const response = await fetch(url); if (!response.ok) throw new Error(name+' HTTP '+response.status);
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      if (buffer.duration > MAX_SFX_SECONDS) throw new Error(name+' 1.5초 초과');
      all.push({ name, seconds: buffer.duration, channels: buffer.numberOfChannels });
    }
    checks.dataset.allResults = JSON.stringify(all);
    checks.textContent = `전체 효과음 ${all.length}개 · 모두 ${MAX_SFX_SECONDS}초 이하\n사제 ${results.length} / ${specs.length} 파일 정상 · 스테레오 디코딩 완료`;
  } catch (e) { checks.textContent = String(e); } finally { button.disabled = false; }
});
document.querySelector('#sequence')!.addEventListener('click', async () => {
  const run = ++generation; const completed: string[] = [];
  try {
    for (const spec of specs) {
      if (generation !== run) return;
      await play(spec); completed.push(spec.name);
      await sleep((spec.duration+.35)*1000);
    }
    if (generation === run) { status.textContent = `${specs.length}종 순차 재생 완료`; status.dataset.sequence = JSON.stringify(completed); }
  } catch (e) { status.textContent = String(e); }
});
document.querySelector('#stop')!.addEventListener('click', () => {
  generation++; setSfxOn(false); mute.checked = true; status.textContent = '일시정지됨 · 효과음을 켜면 남은 소리가 이어집니다.';
});
mute.addEventListener('change', () => { generation++; setSfxOn(!mute.checked); status.textContent = mute.checked ? '효과음 꺼짐' : '효과음 켜짐'; });
