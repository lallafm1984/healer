/** 계정 RPC와 인증 요청 모두 제한 시간을 적용한다. 호출자가 건넨 취소 신호도 지킨다. */
export const ACCOUNT_TIMEOUT_MS = 12_000;
export async function accountFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const timeout = AbortSignal.timeout(ACCOUNT_TIMEOUT_MS);
  const original = init?.signal ?? (input instanceof Request ? input.signal : null);
  const signal = original ? AbortSignal.any([original, timeout]) : timeout;
  return fetch(input, { ...init, signal });
}
