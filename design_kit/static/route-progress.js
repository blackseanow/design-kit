/* Top progress bar. createRouteProgress / createPageProgress drive a 2px bar
   in 200ms linear steps; it never claims completion while a request is pending,
   then fills and fades.
   The DOM wiring below is for multi-page Flask apps:
   - the bar starts on same-origin link clicks and form submits;
   - the first page load is a shared "bootstrap" ticket that ends on window load;
   - Kit.pageProgress.track(fn) wraps fetch() calls made by page scripts.
   Mark links that trigger downloads with data-no-progress. */
(function (root) {
  function createRouteProgress({ render, schedule = setTimeout, cancel = clearTimeout, reducedMotion = () => false }) {
    let state = { phase: 'idle', progress: 0 };
    let sequence = 0;
    const pending = new Set();
    const paint = (phase, progress = state.progress) => {
      state = { phase, progress };
      render({ ...state });
    };
    const clear = () => { pending.forEach(cancel); pending.clear(); };
    const later = (callback, delay, token) => {
      const timer = schedule(() => {
        pending.delete(timer);
        if (token === sequence) callback();
      }, delay);
      pending.add(timer);
    };
    const advance = token => {
      if (state.phase !== 'loading' || reducedMotion()) return;
      const step = state.progress < .2 ? .1 : state.progress < .5 ? .04 : state.progress < .8 ? .02 : .008;
      // The pending phase never claims completion.
      paint('loading', state.progress >= .94 ? state.progress : Math.min(.94, state.progress + step));
      later(() => advance(token), 200, token);
    };
    const start = () => {
      clear();
      const token = ++sequence;
      // Overlapping loads keep their progress; a new cycle must not inherit 100%.
      paint('loading', state.phase === 'loading' ? state.progress : .08);
      later(() => advance(token), 200, token);
      return token;
    };
    const finish = token => {
      if (token !== sequence || state.phase !== 'loading') return;
      clear();
      paint('settling', 1);
      const duration = reducedMotion() ? 0 : 200;
      later(() => {
        paint('fading');
        later(() => paint('idle', 0), duration, token);
      }, duration, token);
    };
    const dispose = () => { clear(); sequence++; paint('idle', 0); };
    return { start, finish, cancel: finish, dispose, snapshot: () => ({ ...state }) };
  }

  function createPageProgress(control, { page = '', bootstrap = false } = {}) {
    let generation = 0, serial = 0, activeToken = null;
    const pending = new Map();
    const sync = () => {
      if (pending.size && activeToken === null) activeToken = control.start();
      if (!pending.size && activeToken !== null) {
        control.finish(activeToken);
        activeToken = null;
      }
    };
    const begin = ({ shared = false } = {}) => {
      const id = ++serial;
      pending.set(id, shared ? null : generation);
      sync();
      return {
        finish: () => { if (pending.delete(id)) sync(); },
        bindPage: () => { if (pending.has(id)) pending.set(id, generation); },
      };
    };
    let bootstrapTicket = bootstrap ? begin({ shared: true }) : null;
    return {
      begin,
      navigate: nextPage => {
        if (nextPage !== page) {
          page = nextPage;
          generation++;
          // Abandoned page reads must not hold a new page open.
          for (const [id, owner] of pending) if (owner !== null) pending.delete(id);
        }
        return begin();
      },
      claimBootstrap: () => {
        const ticket = bootstrapTicket || begin({ shared: true });
        bootstrapTicket = null;
        return ticket;
      },
      track: async action => {
        const ticket = begin();
        try { return await action(); }
        finally { ticket.finish(); }
      },
      snapshot: () => ({ page, pending: pending.size }),
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { createRouteProgress, createPageProgress };
  if (!root.document) return;
  const element = root.document.querySelector('[data-route-progress]');
  if (!element) return;
  const bar = element.querySelector('.route-progress-bar');
  const bootstrap = element.hasAttribute('data-progress-bootstrap');
  let previous = 'idle';
  const control = createRouteProgress({
    reducedMotion: () => root.matchMedia('(prefers-reduced-motion: reduce)').matches,
    render: state => {
      const fresh = previous === 'idle' && state.phase === 'loading';
      element.hidden = state.phase === 'idle';
      element.removeAttribute('data-progress-bootstrap');
      element.dataset.phase = state.phase;
      if (fresh) bar.style.transition = 'none';
      bar.style.transform = `translate3d(${(state.progress - 1) * 100}%, 0, 0)`;
      if (fresh) {
        // Commit the initial short segment before subsequent 200ms transitions.
        bar.getBoundingClientRect();
        bar.style.transition = '';
      }
      previous = state.phase;
    },
  });
  const pageProgress = createPageProgress(control, { page: root.document.body?.dataset.page || '', bootstrap });
  root.Kit = root.Kit || {};
  root.Kit.progress = control;
  root.Kit.pageProgress = pageProgress;

  if (bootstrap) {
    const ticket = pageProgress.claimBootstrap();
    if (root.document.readyState === 'complete') ticket.finish();
    else root.addEventListener('load', () => ticket.finish(), { once: true });
  }

  // Multi-page navigation: the next document replaces this one, so only start.
  const sameDocument = url => url.origin === root.location.origin && url.pathname === root.location.pathname && url.search === root.location.search;
  root.document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || link.hasAttribute('data-no-progress') || (link.target && link.target !== '_self')) return;
    // In-page anchors and script links never navigate; a started bar would never finish.
    const raw = (link.getAttribute('href') || '').trim();
    if (!raw || raw.startsWith('#') || /^javascript:/i.test(raw)) return;
    let url;
    try { url = new URL(link.href, root.location.href); } catch { return; }
    if (url.origin !== root.location.origin || (url.hash && sameDocument(url))) return;
    control.start();
  });
  root.document.addEventListener('submit', event => {
    const form = event.target;
    if (event.defaultPrevented || form.hasAttribute('data-no-progress') || (form.target && form.target !== '_self')) return;
    control.start();
  });
  // Restored from the back/forward cache: no navigation is pending any more.
  root.addEventListener('pageshow', event => { if (event.persisted) control.dispose(); });
})(typeof window !== 'undefined' ? window : globalThis);
