/** Modal sheets are redrawn with their screen. Keep focus and background state across that redraw. */
const interactive = 'button, input, select, textarea, a[href], [tabindex], [role="button"]';
const releases = new Set<() => void>();

function visible(el: HTMLElement): boolean {
  return !!el.getClientRects().length && !el.closest('[hidden], [inert]') && !el.matches(':disabled');
}
function stops(scope: HTMLElement): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(interactive)).filter(el => visible(el) && el.tabIndex >= 0);
}
type Mark = { selector: string; index: number };
function mark(el: Element | null, scope: HTMLElement): Mark | null {
  if (!(el instanceof HTMLElement) || !scope.contains(el) || el === scope) return null;
  const control = el.closest<HTMLElement>(interactive);
  if (!control || !scope.contains(control)) return null;
  const attrs = Array.from(control.attributes).filter(a => a.name.startsWith('data-'));
  const selector = control.id ? `#${CSS.escape(control.id)}`
    : attrs.length ? control.tagName.toLowerCase() + attrs.map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('')
    : control.getAttribute('name') ? `${control.tagName.toLowerCase()}[name="${CSS.escape(control.getAttribute('name')!)}"]` : '';
  return { selector, index: stops(scope).indexOf(control) };
}
function restore(scope: HTMLElement, saved: Mark | null | undefined): boolean {
  if (!saved) return false;
  const el = saved.selector ? scope.querySelector<HTMLElement>(saved.selector) : stops(scope)[saved.index];
  if (!el || !visible(el)) return false;
  el.focus({ preventScroll: true });
  return document.activeElement === el;
}

/** Screen transitions must not leave a hidden sheet's inert background behind. */
export function releaseSheetDialogs(): void { releases.forEach(release => release()); }

/** Fixed app shells never scroll; each screen owns its inner scroll area. */
export function resetShellScroll(): void {
  for (const id of ['app', 'viewport']) {
    const el = document.getElementById(id);
    if (el) { el.scrollTop = 0; el.scrollLeft = 0; }
  }
}

export function sheetDialog(root: HTMLElement, close: () => void) {
  let dialog: HTMLElement | null = null;
  let path: string[] = [];
  let before: Mark | null = null;
  let interaction: Mark | null = null;
  let openers: (Mark | null)[] = [];
  const scrolls = new Map<string, number>();
  const inert = new Map<HTMLElement, boolean>();
  const thaw = () => { inert.forEach((was, el) => { el.inert = was; }); inert.clear(); };
  const release = () => { thaw(); dialog = null; path = []; before = interaction = null; openers = []; scrolls.clear(); };
  releases.add(release);

  root.addEventListener('click', e => {
    interaction = mark(e.target instanceof Element ? e.target : null, dialog || root);
  }, true);

  document.addEventListener('keydown', e => {
    if (!dialog || root.hidden || !dialog.isConnected) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const list = stops(dialog), first = list[0], last = list[list.length - 1], active = document.activeElement;
    if (!first) { e.preventDefault(); dialog.focus({ preventScroll: true }); }
    else if (!dialog.contains(active) || active === dialog || e.shiftKey && active === first || !e.shiftKey && active === last) {
      e.preventDefault(); (e.shiftKey ? last : first).focus({ preventScroll: true });
    }
  }, true);
  document.addEventListener('focusin', e => {
    if (dialog && !root.hidden && dialog.isConnected && !dialog.contains(e.target as Node)) dialog.focus({ preventScroll: true });
  });

  return {
    beforeRender() {
      before = mark(document.activeElement, dialog || root) || interaction;
      if (dialog) scrolls.set(path.join('/'), dialog.scrollTop);
      thaw();
      dialog = null;
    },
    /** A nested item uses ['bag', 'item:id']; closing it restores its bag button. */
    sync(next: HTMLElement | null, nextPath: string[]) {
      const same = path.join('/') === nextPath.join('/');
      const closing = nextPath.length < path.length;
      const back = closing ? openers[nextPath.length] : null;
      if (!same && !closing) openers[nextPath.length - 1] = before;
      openers.length = nextPath.length;
      path = nextPath;
      dialog = next;
      if (dialog) {
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.tabIndex = -1;
        // Inert siblings at each ancestor, never the ancestor that contains the sheet.
        for (let branch: HTMLElement | null = dialog; branch && branch !== document.body; branch = branch.parentElement) {
          for (const sibling of Array.from(branch.parentElement?.children || [])) {
            if (!(sibling instanceof HTMLElement) || sibling === branch || sibling.matches('.sheet-dim, script, style')) continue;
            inert.set(sibling, sibling.inert); sibling.inert = true;
          }
        }
        dialog.scrollTop = scrolls.get(path.join('/')) || 0;
        if (!(closing && restore(dialog, back)) && !(same && restore(dialog, before))) dialog.focus({ preventScroll: true });
      } else if (closing && !root.hidden) {
        if (!restore(root, back)) stops(root)[0]?.focus({ preventScroll: true });
        scrolls.clear();
      }
      resetShellScroll();
      before = interaction = null;
    },
  };
}
