/** 전투용 native dialog. 확인 창을 읽는 동안 멈추고, 닫으면 열기 전 pause 상태로 돌아간다. */
import type { Fight } from '../engine';

export type BattleConfirmKind = 'restart' | 'quit' | 'giveUp';
export interface BattleDialogCallbacks {
  getFight(): Fight | null;
  getPaused(): boolean;
  /** 일시정지 메뉴를 열지 않는 raw pause setter. */
  setPaused(value: boolean): void;
  act(kind: BattleConfirmKind): void;
}
export interface BattleDialogs {
  confirm(kind: BattleConfirmKind): void;
  closeAll(): void;
  /** 열린 확인 창이 있으면 취소로 닫고 true (안드로이드 뒤로가기) */
  cancel(): boolean;
}

export function battleConfirmation(kind: BattleConfirmKind): { title: string; message: string; action: string; detail?: string } {
  if (kind === 'restart') return {
    title: '처음부터 다시 시작', action: '전체 구간 다시 시작',
    message: '이번 도전의 모든 구간 진행과 전투 기록을 초기화하고, 같은 파티로 첫 구간부터 다시 시작합니다.',
  };
  if (kind === 'quit') return {
    title: '보상 없이 나가기', action: '보상 없이 나가기',
    message: '이번 도전을 종료하고 보상 없이 나갑니다.',
  };
  return {
    title: '현재 전투를 포기하시겠습니까?', action: '포기하기',
    message: '현재 전투를 종료하고\n전멸과 같은 실패로 정산합니다.',
  };
}

function element<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`전투 대화상자 요소 없음: #${id}`);
  return el as T;
}

export function initBattleDialogs(callbacks: BattleDialogCallbacks): BattleDialogs {
  const confirmDialog = element<HTMLDialogElement>('battleConfirm');
  const confirmTitle = element<HTMLElement>('confirmHeading');
  const confirmMessage = element<HTMLElement>('confirmMessage');
  const confirmDetail = element<HTMLElement>('confirmDetail');
  const cancel = element<HTMLButtonElement>('confirmCancel');
  const apply = element<HTMLButtonElement>('confirmApply');
  type Session = {
    dialog: HTMLDialogElement; fight: Fight; wasPaused: boolean; opener: HTMLElement | null;
    kind: BattleConfirmKind;
  };
  let active: Session | null = null;
  let acting = false;

  function restoreOpener(session: Session): void {
    const el = session.opener;
    if (el?.isConnected && !el.closest('[hidden], [inert]') && el.getClientRects().length) el.focus({ preventScroll: true });
    // Native close의 자동 focus 복귀도 고정 앱 shell을 스크롤시키지 않게 한다.
    for (const id of ['app', 'viewport']) {
      const shell = document.getElementById(id);
      if (shell) { shell.scrollTop = 0; shell.scrollLeft = 0; }
    }
  }
  function closeActive(restoreFocus = true): Session | null {
    const session = active;
    active = null; // close 이벤트와 연속 클릭보다 먼저 실행 잠금을 해제한다.
    if (!session) return null;
    if (session.dialog.open) session.dialog.close();
    // 다른 판으로 넘어갔다면 새 판의 pause 상태를 덮어쓰지 않는다.
    if (callbacks.getFight() === session.fight) callbacks.setPaused(session.wasPaused);
    if (restoreFocus) restoreOpener(session);
    return session;
  }
  function open(dialog: HTMLDialogElement, kind: Session['kind']): Session | null {
    if (active || acting) return null;
    const fight = callbacks.getFight();
    if (!fight || fight.over) return null;
    const session: Session = {
      dialog, fight, kind, wasPaused: callbacks.getPaused(),
      opener: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    };
    active = session;
    callbacks.setPaused(true);
    return session;
  }
  function show(session: Session, first: HTMLElement): void {
    try {
      session.dialog.showModal();
      session.dialog.scrollTop = 0;
      first.focus({ preventScroll: true });
    } catch (error) {
      closeActive();
      throw error;
    }
  }

  function confirm(kind: BattleConfirmKind): void {
    const session = open(confirmDialog, kind);
    if (!session) return;
    const text = battleConfirmation(kind);
    confirmTitle.textContent = text.title;
    confirmMessage.textContent = text.message;
    confirmDetail.textContent = text.detail ?? '';
    confirmDetail.hidden = !text.detail;
    confirmDialog.dataset.kind = kind;
    confirmDialog.setAttribute('aria-describedby', text.detail ? 'confirmMessage confirmDetail' : 'confirmMessage');
    cancel.textContent = kind === 'giveUp' ? '계속 전투' : '취소';
    apply.textContent = text.action;
    apply.disabled = false;
    show(session, cancel); // 기본 선택은 항상 취소다.
  }

  cancel.addEventListener('click', () => { if (active?.dialog === confirmDialog) closeActive(); });
  apply.addEventListener('click', () => {
    const session = active;
    if (!session || session.dialog !== confirmDialog || acting) return;
    const valid = callbacks.getFight() === session.fight && !session.fight.over;
    apply.disabled = true;
    closeActive(false);
    if (valid) {
      acting = true;
      try { callbacks.act(session.kind); } finally { acting = false; }
    } else restoreOpener(session);
  });

  confirmDialog.addEventListener('cancel', event => {
    event.preventDefault();
    if (active?.dialog === confirmDialog) closeActive();
  });
  confirmDialog.addEventListener('close', () => {
    // 이전 close 이벤트가 늦게 도착해 같은 dialog의 새 세션을 닫지 않게 한다.
    if (!confirmDialog.open && active?.dialog === confirmDialog) closeActive();
  });
  confirmDialog.addEventListener('keydown', event => {
    if (active?.dialog !== confirmDialog) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeActive(); return; }
    if (event.key !== 'Tab') return;
    const stops = Array.from(confirmDialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]'))
      .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[hidden]') && el.getClientRects().length);
    const first = stops[0], last = stops[stops.length - 1];
    if (!first) { event.preventDefault(); confirmDialog.focus({ preventScroll: true }); }
    else if (!confirmDialog.contains(document.activeElement) || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
      event.preventDefault(); (event.shiftKey ? last : first).focus({ preventScroll: true });
    }
  });

  return {
    confirm,
    closeAll() {
      closeActive();
      if (confirmDialog.open) confirmDialog.close();
    },
    cancel() { return !!closeActive(); },
  };
}
