/** Every individual effect, including slowed playback, ends within this time. */
export const MAX_SFX_SECONDS = 1.5;

export function sfxTiming(bufferSeconds: number, requestedRate = 1) {
  const rate = Number.isFinite(requestedRate) && requestedRate > 0 ? requestedRate : 1;
  const naturalSeconds = bufferSeconds / rate;
  const seconds = Math.min(naturalSeconds, MAX_SFX_SECONDS);
  return { rate, seconds, fadeAt: naturalSeconds > MAX_SFX_SECONDS ? seconds - .04 : null };
}
