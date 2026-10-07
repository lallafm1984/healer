/**
 * 결제 자리 (15, 20 4-1: RevenueCat). 스토어·RevenueCat 계정을 붙이기 전이라 실제 결제는 없음.
 * 개발 빌드(설정 「레벨 잠금 무시」 켬)에서는 「시험 구매」로 바로 받게 해서 화면 흐름만 확인한다.
 */
export const STORE_READY = false;
export const STORE_WHY = '스토어 연결 전 (Play Console·RevenueCat 설정 뒤)';

export interface PurchaseResult { ok: boolean; test?: boolean; why?: string }

export async function purchase(_id: string, devTest: boolean): Promise<PurchaseResult> {
  if (STORE_READY) return { ok: false, why: '결제 모듈 없음' };
  return devTest ? { ok: true, test: true } : { ok: false, why: STORE_WHY };
}
