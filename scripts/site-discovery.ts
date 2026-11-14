import type { Manifest } from './manifest.ts';
import { PRODUCTION_ORIGIN } from './site-origin.ts';

export type GalleryEntry = Manifest & {
  status: 'accepted' | 'pre-review';
  addedAt: string;
  sourceUrl: string;
  prNumber?: number;
};

const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const entryPath = (entry: GalleryEntry) => `/entries/${entry.id}/`;
const status = (entry: GalleryEntry) => entry.status === 'accepted' ? 'Accepted' : 'Pre-review (unapproved)';

export function renderLibrary(entries: readonly GalleryEntry[]): string {
  const group = (state: GalleryEntry['status'], heading: string) => `<section>
    <h2 class="sec">${heading}</h2>
    ${entries.filter(e => e.status === state).map(e => `<article class="entry-head">
      <h3><a href="${entryPath(e)}">${escape(e.title)}</a></h3>
      <p>By @${escape(e.author.github)}</p><p>${escape(e.description)}</p>
    </article>`).join('') || '<p class="sec-empty">No entries in this group.</p>'}
  </section>`;
  return `<section class="hero"><h1>Worst captcha contest</h1>
    <p>Pick one, launch it, regret it. Then tell us whether it was a good entry.</p>
    <p>Captchastrophe is a collection of deliberately terrible verification challenges. Each entry has its own premise, controls and way to pass. Browse the entries below, read their source, or open one in a browser to play. No account is needed to play; GitHub sign-in is only for voting.</p>
    <p>Challenges run on separate origins and only start when you choose Launch. Pre-review entries are unapproved code, not accepted submissions. JavaScript is required to play, search and vote, but not to read this library.</p>
    <p><a href="/docs/agent-access.md">Automation and metadata guide</a> · <a href="/data/index.json">Entry metadata (JSON)</a></p>
  </section><div class="wide">${group('accepted', 'Accepted')}${group('pre-review', 'Pre-review — unapproved')}</div>`;
}

export function withMain(html: string, content: string): string {
  return html.replace(/(<main\b[^>]*>)[\s\S]*?(<\/main>)/, (_, open, close) => open + content + close);
}

export function withCanonical(html: string, pathname: string): string {
  return html.replace('</head>', `<link rel="canonical" href="${PRODUCTION_ORIGIN}${pathname}"></head>`);
}

export function renderEntryPage(shell: string, entry: GalleryEntry): string {
  const body = `<article class="col"><div class="entry-head">
    <a class="back" href="/">← Library</a><p class="badge">${status(entry)}</p>
    <h1>${escape(entry.title)}</h1><p>${escape(entry.description)}</p>
    ${entry.status === 'pre-review' ? '<p class="notice warn">Unapproved submission. Launch only if you want to try unchecked code.</p>' : ''}
    <p><a class="soft-button" href="/#/e/${entry.id}">Open interactive captcha</a></p>
    <p class="small">JavaScript is required to launch the challenge. No account is needed to play. This page describes the entry; it does not complete the captcha.</p>
  </div><dl class="facts">
    <div><dt>Author</dt><dd><a href="https://github.com/${escape(entry.author.github)}">@${escape(entry.author.github)}</a></dd></div>
    <div><dt>Source</dt><dd><a href="${escape(entry.sourceUrl)}">View code</a></dd></div>
    <div><dt>Declared capabilities</dt><dd>${entry.capabilities.length ? entry.capabilities.map(escape).join(', ') : 'None'}</dd></div>
    <div><dt>Added</dt><dd><time datetime="${escape(entry.addedAt)}">${escape(entry.addedAt.slice(0, 10))}</time></dd></div>
  </dl></article>`;
  const html = withMain(shell, body)
    .replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<link\b[^>]*rel="modulepreload"[^>]*>/g, '')
    .replace(/<button\b[^>]*id="theme"[^>]*>[\s\S]*?<\/button>/, '')
    .replace(/(src|href)="\.\//g, '$1="/')
    .replace('href="#/"', 'href="/"')
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escape(entry.title)} — captchastrophe</title>`)
    .replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${escape(entry.description)}">`);
  return withCanonical(html, entryPath(entry));
}

export function renderSitemap(entries: readonly GalleryEntry[]): string {
  const paths = ['/', '/docs/agent-access.md', ...entries.map(entryPath)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p => `<url><loc>${PRODUCTION_ORIGIN}${p}</loc></url>`).join('')}</urlset>
`;
}
