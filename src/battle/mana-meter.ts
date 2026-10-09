/** 전투 자원은 현재 0~100으로 정규화된다. 숫자와 호는 같은 1% 단위로 표시한다. */
export function manaMeter(current: number, maximum = 100): { percent: number; fill: string; low: boolean } {
  const ratio = Number.isFinite(current) && Number.isFinite(maximum) && maximum > 0
    ? Math.max(0, Math.min(1, current / maximum)) : 0;
  const percent = Math.floor(ratio * 100 + Number.EPSILON * 100);
  return { percent, fill: `${percent}%`, low: percent < 20 };
}
