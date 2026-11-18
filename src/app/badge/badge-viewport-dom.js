// Deliberate exception to the Toolcraft product boundary (user request:
// "fix it, break rules, this should be the only view of the app like this,
// locked viewport"). The runtime offers no option to stop wheel/pinch
// navigation, so these window listeners do it for the badge canvas only.
// Kept in a small JS module so the rest of the product stays under the
// code-health boundary; see docs/toolcraft/agent-worklog.md (pass-002).

const BLOCKED = ["wheel", "gesturestart", "gesturechange", "gestureend"];
const OPTIONS = { capture: true, passive: false };

/** Adds `handler` on the window for every event type; returns the cleanup. */
function listenWindow(types, handler, options) {
  for (const type of types) window.addEventListener(type, handler, options);
  return () => {
    for (const type of types) window.removeEventListener(type, handler, options);
  };
}

/** Stops wheel and pinch events aimed at `getTarget()` before canvas navigation sees them. */
export function blockBadgeViewportNavigation(getTarget) {
  const block = (event) => {
    const target = getTarget();
    if (!target || event.target !== target) return;
    event.preventDefault();
    event.stopPropagation();
  };
  return listenWindow(BLOCKED, block, OPTIONS);
}

/** Calls `onChange` with the window size now and on every resize. */
export function watchBadgeWindowSize(onChange) {
  const read = () => onChange({ height: window.innerHeight, width: window.innerWidth });
  read();
  return listenWindow(["resize"], read, { passive: true });
}
