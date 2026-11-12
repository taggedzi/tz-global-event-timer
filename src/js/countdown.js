function countdownState(target, now) {
  if (!Number.isFinite(target) || !Number.isFinite(now)) throw new Error('Countdown requires finite timestamps.');
  const total = Math.max(0, Math.ceil((target - now) / 1000));
  return { started: target <= now, days: Math.floor(total / 86400),
    hours: Math.floor(total % 86400 / 3600), minutes: Math.floor(total % 3600 / 60), seconds: total % 60 };
}
function startCountdown({ target, now, setInterval, clearInterval, window, render }) {
  let timer = null;
  let destroyed = false;
  function refresh() {
    if (destroyed) return;
    const state = countdownState(target, now());
    render(state);
    if (state.started && timer !== null) { clearInterval(timer); timer = null; }
    if (!state.started && timer === null) timer = setInterval(refresh, 1000);
  }
  window.addEventListener('focus', refresh);
  window.document.addEventListener('visibilitychange', refresh);
  refresh();
  return () => {
    if (destroyed) return;
    destroyed = true;
    if (timer !== null) clearInterval(timer);
    window.removeEventListener('focus', refresh);
    window.document.removeEventListener('visibilitychange', refresh);
  };
}
module.exports = { countdownState, startCountdown };
