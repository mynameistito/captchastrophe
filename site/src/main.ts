import './styles/tokens.css';
import './styles/components.css';
import './styles/site.css';
import { h, icons } from './lib/dom.ts';
import { loadIndex } from './lib/index-data.ts';
import { buildLibrary, indexRankings } from './lib/library.ts';
import { createTheme } from './lib/theme.ts';
import type { Entry, SortKey } from './lib/types.ts';
import { createFrameHost, type FrameHost } from './frame-host.ts';
import createVoting, { type Direction } from './voting.ts';

const repo = 'https://github.com/pc-style/captchastrophe';
const view = document.querySelector<HTMLElement>('#view')!;
const theme = createTheme();
const themeButton = document.querySelector<HTMLButtonElement>('#theme')!;
function themeIcon() { themeButton.replaceChildren(theme.current() === 'dark' ? icons.sun() : icons.moon()); themeButton.setAttribute('aria-label', `Switch to ${theme.current() === 'dark' ? 'light' : 'dark'} theme`); }
themeButton.onclick = () => theme.toggle(); themeIcon();
themeButton.hidden = false;
let host: FrameHost | null = null;
let stopVotingListener: (() => void) | undefined;
theme.subscribe(t => { themeIcon(); host?.sendTheme(t); });
let config: { playOrigin: string; entryOrigins: Record<string, string>; voting: boolean } = { playOrigin: import.meta.env.DEV ? 'http://127.0.0.1:5174' : '', entryOrigins: {}, voting: false };
try { const res = await fetch('./data/config.json'); if (res.ok) { const c = await res.json(); config = { playOrigin: import.meta.env.DEV ? 'http://127.0.0.1:5174' : '', entryOrigins: c.entryOrigins && typeof c.entryOrigins === 'object' ? c.entryOrigins : {}, voting: c.voting === true }; } } catch { /* Browsing does not require deployment configuration. */ }
const voting = createVoting(config.voting);
let entries: Entry[] = [];
let rankings = indexRankings(null);
let query = '', sort: SortKey = 'recent', unratedOnly = false;
const button = (text: string, action: () => void, cls = 'soft-button') => h('button', { type: 'button', class: cls, on: { click: action } }, text);
const link = (text: string, href: string) => h('a', { href }, text);

function table(list: Entry[], empty: string) {
  if (!list.length) return h('div', { class: 'empty' }, h('p', { class: 'strong' }, empty), h('p', { class: 'small' }, query || unratedOnly ? 'Try a different search or clear the filter.' : 'No filler entries. Yours could be the first.'), link('Make a submission →', repo + '/blob/main/CONTRIBUTING.md'));
  return h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ...['Entry', 'Author', 'Added', 'Approval'].map((name, i) => h('th', { scope: 'col', class: i === 1 || i === 2 ? 'hm' : i === 3 ? 'r-end' : '' }, name)))), h('tbody', null, list.map(e => {
    const r = rankings?.get(e.id); const total = r ? r.up + r.down : 0;
    return h('tr', null, h('td', { class: 't' }, link(e.title, '#/e/' + e.id), h('span', { class: 'meta' }, '@' + e.author)), h('td', { class: 'hm mute au' }, '@' + e.author), h('td', { class: 'hm mute' }, new Date(e.addedAt).toLocaleDateString()), h('td', { class: 'r-end num' }, !rankings ? 'Unavailable' : total ? `${Math.round(r!.up / total * 100)}% · ${total}` : 'Unrated'));
  })));
}
function library() {
  const lists = h('div');
  const note = h('p', { class: 'rank-note', role: 'status' });
  const renderLists = () => {
    const data = buildLibrary(entries, { query, sort, unratedOnly }, rankings);
    note.textContent = rankings ? 'Top balances approval and voting evidence. Trending uses recent distinct voters.' : 'Voting data is unavailable. Showing recent entries.';
    lists.replaceChildren(h('h2', { class: 'sec' }, 'Accepted', h('span', { class: 'count' }, data.accepted.length)), table(data.accepted, entries.length ? 'Nothing matches.' : 'Nothing accepted yet.'), h('section', { class: 'pre-wrap' }, h('h2', { class: 'sec' }, 'Pre-review', h('span', { class: 'count' }, 'Unapproved. Votes don’t imply acceptance.')), table(data.preReview, 'No pre-review entries.')));
  };
  const search = h('input', { id: 'search', type: 'search', placeholder: 'Search entries or authors', value: query, on: { input: e => { query = (e.target as HTMLInputElement).value; renderLists(); } } });
  const select = h('select', { class: 'select', 'aria-label': 'Sort entries', on: { change: e => { sort = (e.target as HTMLSelectElement).value as SortKey; renderLists(); } } }, ...(['recent', 'top', 'trending'] as const).map(s => h('option', { value: s, selected: s === sort, disabled: s !== 'recent' && !rankings }, s[0].toUpperCase() + s.slice(1))));
  const unrated = button('Unrated only', () => { unratedOnly = !unratedOnly; unrated.setAttribute('aria-pressed', String(unratedOnly)); renderLists(); }, 'chip');
  unrated.disabled = !rankings; unrated.setAttribute('aria-pressed', String(unratedOnly));
  view.replaceChildren(h('section', { class: 'hero' }, h('h1', null, 'Worst captcha contest'), h('p', null, 'Pick one, launch it, regret it. Then tell us whether it was a good entry.')), h('div', { class: 'wide' }, h('div', { class: 'filters' }, h('div', { class: 'search' }, h('label', { for: 'search', class: 'sr' }, 'Search entries'), icons.search(), search), select, unrated), note, lists));
  renderLists();
}
function entry(e: Entry) {
  let frame: HTMLIFrameElement | null = null, muted = true, launched = false;
  const stage = h('div', { class: 'stage' });
  const state = h('p', { class: 'frame-status', role: 'status' });
  const voteSection = h('section', { class: 'col vote-sec', hidden: true });
  let mine: Direction | null = null;
  const voteMessage = h('p', { class: 'vote-msg', role: 'status' });
  const controls = h('div', { class: 'vote', role: 'group', 'aria-label': 'Rate the contest submission' });
  const drawVote = () => {
    const unavailable = voting.status() === 'unavailable';
    controls.replaceChildren(...(['up', 'down'] as const).map(d => {
      const b = button(d === 'up' ? '↑ Good entry' : '↓ Weak entry', () => { void cast(d); });
      b.setAttribute('aria-pressed', String(mine === d)); b.disabled = unavailable; return b;
    }));
    voteSection.replaceChildren(h('h2', null, 'Was it a good entry?'), h('p', { class: 'lede' }, 'Good means a good contest submission. Weak means a weak one. Annoying you is the job.'), unavailable ? h('p', { class: 'vote-off' }, 'Voting is unavailable here. You can still play.') : controls, voteMessage);
  };
  async function cast(d: Direction) {
    if (voting.status() === 'signed-out') {
      voteMessage.replaceChildren('Sign in with GitHub to vote. You’ll come back here without casting a vote. ', button('Sign in with GitHub', () => { void voting.signIn(location.hash).catch(() => { voteMessage.textContent = 'Sign-in is unavailable. Try again later.'; }); })); return;
    }
    controls.querySelectorAll('button').forEach(b => { b.disabled = true; });
    const result = await voting.vote(e.id, mine === d ? null : d);
    if (result.ok) { mine = result.vote; voteMessage.textContent = mine ? 'Vote saved.' : 'Vote removed.'; }
    else voteMessage.textContent = ({ 'account-too-new': 'Your GitHub account needs to be at least 7 days old.', 'eligibility-pending': 'Still checking your GitHub account age. Try again shortly.', 'rate-limited': 'Too many vote changes. Give it a minute.', suspended: 'Voting is suspended for this account.', 'unknown-submission': 'This entry is not open for voting.', 'signed-out': 'Sign in with GitHub to vote.', unavailable: 'Voting is unavailable. Try again later.' })[result.reason];
    drawVote();
  }
  const reset = button('Reset', () => host?.sendReset());
  const exit = button('Exit captcha', () => { host?.detach(); frame?.remove(); frame = null; gate(); state.textContent = 'Exited. The captcha is no longer running.'; });
  const mute = button('Muted', () => { muted = !muted; mute.textContent = muted ? 'Muted' : 'Mute'; mute.setAttribute('aria-pressed', String(muted)); host?.sendMute(muted); });
  mute.setAttribute('aria-pressed', 'true');
  function gate() {
    reset.disabled = exit.disabled = mute.disabled = true;
    stage.classList.remove('live');
    stage.replaceChildren(h('span', { class: 'stage-label' }, 'Captcha area'), h('div', { class: 'stage-gate' }, h('p', null, 'Everything in this box is the captcha’s problem.'), button(e.status === 'pre-review' ? 'Launch anyway' : launched ? 'Launch again' : 'Launch', launch, 'soft-button primary')));
  }
  function launch() {
    let origin: string;
    try { const u = new URL(config.entryOrigins[e.id] ?? config.playOrigin); if (u.origin === location.origin || !(u.protocol === 'https:' || (u.hostname === 'localhost' || u.hostname === '127.0.0.1') && u.protocol === 'http:')) throw new Error(); origin = u.origin; }
    catch { state.textContent = 'The isolated play host is not configured. This entry cannot launch yet.'; return; }
    host?.dispose();
    frame = h('iframe', { title: e.title, sandbox: 'allow-scripts allow-same-origin', referrerpolicy: 'no-referrer' });
    const delegation = e.capabilities.flatMap(c => c === 'motion' ? ['accelerometer', 'gyroscope', 'magnetometer'] : c === 'audio' ? ['autoplay'] : [c]);
    frame.allow = ['camera', 'microphone', 'accelerometer', 'gyroscope', 'magnetometer', 'fullscreen', 'autoplay'].map(c => `${c} ${delegation.includes(c) ? origin : "'none'"}`).join('; ');
    frame.style.height = '480px';
    host = createFrameHost({ playOrigin: origin, onMessage(message) {
      if (message.type === 'ready') { host?.sendTheme(theme.current()); host?.sendMute(muted); state.textContent = 'Running. Exit stays outside the captcha.'; }
      if (message.type === 'layout' && frame) frame.style.height = `${message.height}px`;
      if (message.type === 'success') state.textContent = 'Verified. You can vote whether you finished or not.';
      if (message.type === 'capability-denied') state.textContent = `${message.capability}: ${message.reason ?? 'unavailable'}. This entry may need that capability to work.`;
    } });
    frame.src = `${origin}/${config.entryOrigins[e.id] ? '' : encodeURIComponent(e.id) + '/'}?theme=${theme.current()}`;
    stage.replaceChildren(frame); stage.classList.add('live'); host.attach(frame);
    launched = true; reset.disabled = exit.disabled = mute.disabled = false; voteSection.hidden = false;
    state.textContent = 'Loading captcha…';
    void voting.myVote(e.id).then(v => { mine = v; drawVote(); });
  }
  gate(); drawVote();
  stopVotingListener = voting.subscribeStatus(() => { void voting.myVote(e.id).then(v => { mine = v; drawVote(); }); });
  const warning = e.status === 'pre-review' ? h('div', { class: 'notice warn' }, h('p', null, 'Not reviewed. This is an unapproved submission. Launch it only if you want to try unchecked code.')) : null;
  const report = `${repo}/issues/new?template=report.yml&title=${encodeURIComponent('Report: ' + e.id)}`;
  view.replaceChildren(h('div', { class: 'col' }, h('div', { class: 'entry-head' }, h('a', { class: 'back', href: '#/' }, '← Library'), h('span', { class: 'badge ' + (e.status === 'pre-review' ? 'pre' : '') }, e.status === 'pre-review' ? 'Pre-review' : 'Accepted'), h('h1', null, e.title), h('p', null, e.description), warning)), h('div', { class: 'stagewrap' }, stage, h('div', { class: 'under' }, h('div', { class: 'actions' }, reset, exit), mute), state), voteSection, h('div', { class: 'col' }, h('dl', { class: 'facts' }, h('div', null, h('dt', null, 'Author'), h('dd', null, link('@' + e.author, 'https://github.com/' + e.author))), h('div', null, h('dt', null, 'Source'), h('dd', null, link('View code', e.sourceUrl ?? repo + '/tree/main/submissions/' + e.id))), e.prNumber ? h('div', null, h('dt', null, 'Pull request'), h('dd', null, link('#' + e.prNumber, repo + '/pull/' + e.prNumber))) : null, h('div', null, h('dt', null, 'Problem?'), h('dd', null, link('Report broken / rule violation', report))))));
}
function route() {
  host?.dispose(); host = null;
  stopVotingListener?.(); stopVotingListener = undefined;
  const id = location.hash.match(/^#\/e\/([a-z0-9-]+)$/)?.[1];
  const e = entries.find(e => e.id === id);
  if (e) entry(e); else if (id) view.replaceChildren(h('div', { class: 'hero' }, h('h1', null, 'Entry not found'), link('Back to the library', '#/'))); else library();
  view.setAttribute('aria-busy', 'false');
}
async function start() {
  try { entries = (await loadIndex()).entries; route(); rankings = indexRankings(await voting.rankings()); if (!location.hash.startsWith('#/e/')) library(); }
  catch { view.replaceChildren(h('div', { class: 'hero' }, h('h1', null, 'Couldn’t load the library'), h('p', null, 'The site is supposed to be the easy part. Try again.'), button('Retry', () => { void start(); }))); view.setAttribute('aria-busy', 'false'); }
}
addEventListener('hashchange', () => { route(); view.focus(); });
const authControl = button('Sign in', () => {
  const action = voting.status() === 'signed-in' ? voting.signOut() : voting.signIn(location.hash);
  void action.catch(() => { authControl.textContent = 'Sign-in unavailable'; });
}, 'l');
document.querySelector('header nav')?.prepend(authControl);
const updateAuth = () => { authControl.hidden = voting.status() === 'unavailable'; authControl.textContent = voting.status() === 'signed-in' ? 'Sign out' : 'Sign in'; };
voting.subscribeStatus(updateAuth); updateAuth();
setInterval(() => { void voting.rankings().then(r => { rankings = indexRankings(r); if (!location.hash.startsWith('#/e/')) library(); }); }, 600000);
void start();
