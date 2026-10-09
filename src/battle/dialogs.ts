/** 전투용 native dialog. 대상을 읽는 동안 멈추고, 닫으면 열기 전 pause 상태로 돌아간다. */
import type { Fight, Role } from '../engine';
import { debuffDisplay, healthDisplay } from './party-display';

export type BattleConfirmKind = 'restart' | 'quit' | 'giveUp';
export interface BattleDialogCallbacks {
  getFight(): Fight | null;
  getPaused(): boolean;
  /** 일시정지 메뉴를 열지 않는 raw pause setter. */
  setPaused(value: boolean): void;
  /** 캔버스 칸 선택과 같은 경로로 장전/기본 스킬을 사용한다. */
  selectCell(index: number): void;
  act(kind: BattleConfirmKind): void;
  getUsedItems(): number;
}
export interface BattleDialogs {
  showTargets(): void;
  confirm(kind: BattleConfirmKind): void;
  closeAll(): void;
}

const roleName: Record<Role, string> = { tank: '탱커', melee: '근접', ranged: '원거리', healer: '힐러' };

export function battleConfirmation(kind: BattleConfirmKind, usedItems: number): { title: string; message: string; action: string } {
  const used = Math.max(0, Math.floor(usedItems));
  if (kind === 'restart') return {
    title: '처음부터 다시 시작할까요?', action: '전체 구간 다시 시작',
    message: '이번 도전의 모든 구간 진행과 전투 기록을 초기화하고, 같은 파티로 첫 구간부터 다시 시작합니다.',
  };
  const items = used ? ` 이미 사용한 소비 아이템 ${used}개는 사용한 것으로 정산됩니다.` : ' 이번 도전에서 사용한 소비 아이템은 없습니다.';
  if (kind === 'quit') return {
    title: '보상 없이 나갈까요?', action: '보상 없이 나가기',
    message: `이번 도전을 종료하고 보상 없이 나갑니다.${items}`,
  };
  return {
    title: '전투를 포기할까요?', action: '포기하고 실패 정산',
    message: `전투를 종료하고 전멸과 같은 실패로 정산합니다.${items}`,
  };
}

function element<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`전투 대화상자 요소 없음: #${id}`);
  return el as T;
}

export function initBattleDialogs(callbacks: BattleDialogCallbacks): BattleDialogs {
  const targets = element<HTMLDialogElement>('partyTargets');
  const targetList = element<HTMLDivElement>('targetList');
  const targetsClose = element<HTMLButtonElement>('targetsClose');
  const confirmDialog = element<HTMLDialogElement>('battleConfirm');
  const confirmTitle = element<HTMLElement>('confirmHeading');
  const confirmMessage = element<HTMLElement>('confirmMessage');
  const cancel = element<HTMLButtonElement>('confirmCancel');
  const apply = element<HTMLButtonElement>('confirmApply');
  type Session = {
    dialog: HTMLDialogElement; fight: Fight; wasPaused: boolean; opener: HTMLElement | null;
    kind: 'targets' | BattleConfirmKind; targets: Map<number, Fight['party'][number]>;
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
      targets: new Map(),
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

  function showTargets(): void {
    const session = open(targets, 'targets');
    if (!session) return;
    const fragment = document.createDocumentFragment();
    for (const unit of session.fight.party) {
      const health = healthDisplay(unit.hp, unit.max);
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.cell = String(unit.cell);
      button.dataset.unitId = String(unit.id);
      button.style.minHeight = '44px';
      // 쓰러진 아군도 부활 기술의 대상이 된다. 사용 가능 여부는 캔버스와 같은 엔진 경로가 판단한다.
      const selectable = session.fight.cells[unit.cell]?.unit === unit;
      button.disabled = !selectable;
      if (selectable) session.targets.set(unit.cell, unit);
      const name = document.createElement('span');
      name.className = 'target-name';
      name.textContent = `${unit.nick}${unit.me && unit.nick !== '나' ? ' (나)' : ''} · ${roleName[unit.role]}`;
      const hp = document.createElement('span');
      hp.className = 'target-health';
      hp.textContent = `${!unit.alive ? '쓰러짐 · ' : health.critical ? '위험 · ' : ''}HP ${Math.max(0, Math.ceil(unit.hp)).toLocaleString('ko-KR')} / ${Math.ceil(unit.max).toLocaleString('ko-KR')} · ${health.percent}%`;
      const debuffs = document.createElement('span');
      debuffs.className = 'target-debuffs';
      debuffs.textContent = unit.debuffs.length ? unit.debuffs.map(d => debuffDisplay(d, session.fight.hero).detail).join(' / ') : '디버프 없음';
      const hots = document.createElement('span');
      hots.className = 'target-hots';
      const hotDetails = [
        ...(unit.hot > 0 ? [`소생 · ${Math.ceil(unit.hot)}초`] : []),
        ...unit.hots.filter(h => h.left > 0).map(h => `${h.name} · ${Math.ceil(h.left)}초`),
      ];
      hots.textContent = hotDetails.length ? `지속 치유: ${hotDetails.join(' / ')}` : '지속 치유 없음';
      button.append(name, hp, debuffs, hots);
      fragment.append(button);
    }
    if (!session.targets.size) {
      const empty = document.createElement('p');
      empty.className = 'target-empty';
      empty.textContent = '현재 선택할 수 있는 파티원이 없습니다.';
      fragment.append(empty);
    }
    targetList.replaceChildren(fragment);
    targetList.scrollTop = 0;
    show(session, targetsClose);
  }

  function confirm(kind: BattleConfirmKind): void {
    const session = open(confirmDialog, kind);
    if (!session) return;
    const text = battleConfirmation(kind, callbacks.getUsedItems());
    confirmTitle.textContent = text.title;
    confirmMessage.textContent = text.message;
    apply.textContent = text.action;
    apply.disabled = false;
    show(session, cancel); // 기본 선택은 항상 취소다.
  }

  targetList.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-cell]') : null;
    const session = active;
    if (!button || !targetList.contains(button) || button.disabled || !session || session.kind !== 'targets' || acting) return;
    const index = Number(button.dataset.cell), unit = session.targets.get(index);
    const sameFight = callbacks.getFight() === session.fight && !session.fight.over;
    const valid = sameFight && !!unit && session.fight.cells[index]?.unit === unit && String(unit.id) === button.dataset.unitId;
    // 먼저 닫고 원래 pause를 복구한 뒤 캔버스와 같은 선택 경로를 호출한다.
    closeActive();
    if (valid) {
      acting = true;
      try { callbacks.selectCell(index); } finally { acting = false; }
    }
  });
  targetsClose.addEventListener('click', () => { if (active?.dialog === targets) closeActive(); });
  cancel.addEventListener('click', () => { if (active?.dialog === confirmDialog) closeActive(); });
  apply.addEventListener('click', () => {
    const session = active;
    if (!session || session.dialog !== confirmDialog || session.kind === 'targets' || acting) return;
    const valid = callbacks.getFight() === session.fight && !session.fight.over;
    apply.disabled = true;
    closeActive(false);
    if (valid) {
      acting = true;
      try { callbacks.act(session.kind); } finally { acting = false; }
    } else restoreOpener(session);
  });

  for (const dialog of [targets, confirmDialog]) {
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      if (active?.dialog === dialog) closeActive();
    });
    dialog.addEventListener('close', () => {
      // 이전 close 이벤트가 늦게 도착해 같은 dialog의 새 세션을 닫지 않게 한다.
      if (!dialog.open && active?.dialog === dialog) closeActive();
    });
    dialog.addEventListener('keydown', event => {
      if (active?.dialog !== dialog) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeActive(); return; }
      if (event.key !== 'Tab') return;
      const stops = Array.from(dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]'))
        .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[hidden]') && el.getClientRects().length);
      const first = stops[0], last = stops[stops.length - 1];
      if (!first) { event.preventDefault(); dialog.focus({ preventScroll: true }); }
      else if (!dialog.contains(document.activeElement) || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
        event.preventDefault(); (event.shiftKey ? last : first).focus({ preventScroll: true });
      }
    });
  }
  return {
    showTargets, confirm,
    closeAll() {
      closeActive();
      for (const dialog of [targets, confirmDialog]) if (dialog.open) dialog.close();
    },
  };
}
