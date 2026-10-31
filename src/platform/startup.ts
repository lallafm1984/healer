/** 서버 확인·타이틀 공지가 끝나기 전에는 게임 시작과 계정 팝업을 기다린다. */
let ready = true;
let settled: Promise<boolean> = Promise.resolve(true);

export const serverReady = (): boolean => ready;
export const waitForServer = (): Promise<boolean> => settled;

/** mountServer가 요청을 직렬화한다. false로 끝나면 업데이트 전까지 닫힌 상태다. */
export function beginServerCheck(): (allowed: boolean) => void {
  ready = false;
  let finish!: (allowed: boolean) => void;
  settled = new Promise(resolve => { finish = resolve; });
  return allowed => { ready = allowed; finish(allowed); };
}
