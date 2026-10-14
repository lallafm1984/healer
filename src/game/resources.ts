import type { SaveData } from '../platform/storage';

export type ResourceKey = 'gold' | 'stone' | 'refined';

/** 개발 옵션은 사용 가능량만 바꾼다. 실제 잔액·보상은 유한한 값으로 보존한다. */
export const unlimitedResource = (save: SaveData, key: ResourceKey): boolean =>
  !!(key === 'gold' ? save.settings.devGold : save.settings.devStones);

/** 비용 확인과 보유량 표시에 공통 사용. Infinity는 저장하지 않는다. */
export const resourceBalance = (save: SaveData, key: ResourceKey): number =>
  unlimitedResource(save, key) ? Infinity : key === 'gold' ? save.player.gold : save.mats[key];

/** 여러 재화가 필요한 작업은 모두 충분한지 확인한 뒤 차감한다. */
export function spendResource(save: SaveData, key: ResourceKey, amount: number): void {
  if (unlimitedResource(save, key)) return;
  if (key === 'gold') save.player.gold -= amount;
  else save.mats[key] -= amount;
}
