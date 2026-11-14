// Mock-only behavior. Every entry below is a placeholder, not a contest idea.
const ENTRIES = [
  { id: 'a1', name: 'Placeholder entry one', author: 'handle-one', status: 'accepted', up: 41, down: 3, added: '2 days ago', blurb: 'One plain sentence about what the player does.' },
  { id: 'a2', name: 'Placeholder entry two', author: 'handle-two', status: 'accepted', up: 18, down: 1, added: '1 week ago', blurb: 'One plain sentence about what the player does.' },
  { id: 'a3', name: 'Placeholder entry three', author: 'handle-three', status: 'accepted', up: 6, down: 4, added: '3 weeks ago', blurb: 'One plain sentence about what the player does.' },
  { id: 'a4', name: 'Placeholder entry four', author: 'handle-four', status: 'accepted', up: 0, down: 0, added: 'yesterday', blurb: 'One plain sentence about what the player does.' },
  { id: 'p1', name: 'Placeholder entry five', author: 'handle-five', status: 'pre', up: 3, down: 0, added: '4 hours ago', blurb: 'One plain sentence about what the player does.', pr: 128 },
  { id: 'p2', name: 'Placeholder entry six', author: 'handle-six', status: 'pre', up: 0, down: 0, added: '2 days ago', blurb: 'One plain sentence about what the player does.', pr: 121 },
];

const ICON = {
  up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>',
};

const score = e => e.up - e.down;
// Mock ranking only. Real formulas live in the docs once Convex is wired up.
const wilson = e => { const n = e.up + e.down; if (!n) return 0; const z = 1.96, p = e.up / n; return (p + z*z/(2*n) - z*Math.sqrt((p*(1-p) + z*z/(4*n))/n)) / (1 + z*z/n); };
const SORTS = {
  recent: (a, b) => a.id < b.id ? 1 : -1,
  top: (a, b) => wilson(b) - wilson(a),
  trending: (a, b) => (b.up + 2) / (b.down + 3) - (a.up + 2) / (a.down + 3),
};

function filterEntries({ q = '', status = 'accepted', sort = 'top', unrated = false } = {}) {
  q = q.trim().toLowerCase();
  return ENTRIES
    .filter(e => status === 'all' || e.status === status)
    .filter(e => !unrated || e.up + e.down === 0)
    .filter(e => !q || (e.name + ' ' + e.author + ' ' + e.blurb).toLowerCase().includes(q))
    .sort(SORTS[sort]);
}

// Theme: follow system, allow override. Persisted locally for the mock only.
function initTheme(btn) {
  const root = document.documentElement;
  const saved = localStorage.getItem('mock-theme');
  const sys = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const url = new URLSearchParams(location.search).get('theme');
  const set = t => { root.dataset.theme = t; if (btn) { btn.innerHTML = t === 'dark' ? ICON.sun : ICON.moon; btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'); } };
  set(url || saved || sys);
  btn && btn.addEventListener('click', () => { const t = root.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('mock-theme', t); set(t); });
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 2200);
}

// Vote widget: local state only, signed-out first so the sign-in path is visible.
function voteWidget(host, entry, state) {
  const render = () => {
    const mine = state.vote;
    host.innerHTML = `
      <div class="vote" role="group" aria-label="Rate this submission as a contest entry">
        <button type="button" data-v="up" aria-pressed="${mine === 'up'}">${ICON.up}<span>Good entry</span></button>
        <button type="button" data-v="down" aria-pressed="${mine === 'down'}">${ICON.down}<span>Weak entry</span></button>
      </div>`;
  };
  render();
  host.addEventListener('click', ev => {
    const b = ev.target.closest('button[data-v]'); if (!b) return;
    if (!state.signedIn) return state.needSignIn();
    const v = b.dataset.v;
    state.vote = state.vote === v ? null : v;
    render(); state.changed && state.changed();
  });
}
