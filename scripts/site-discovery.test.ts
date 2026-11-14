import { describe, expect, it } from 'vitest';
import { entryPath, renderEntryPage, renderLibrary, renderSitemap, withMain, type GalleryEntry } from './site-discovery.ts';
import { PRODUCTION_ORIGIN } from './site-origin.ts';

const entry: GalleryEntry = {
  id: 'test-entry', title: 'A strange captcha', description: 'Draw something inconvenient.',
  author: { github: 'pc-style' }, entry: 'entry.ts', capabilities: [],
  concept: { action: 'Draw.', sequence: 'Submit.', difficulty: 'Stay patient.', success: 'Finish.' },
  status: 'accepted', addedAt: '2026-11-14T12:00:00Z',
  sourceUrl: 'https://github.com/pc-style/captchastrophe/tree/main/submissions/test-entry',
};
const shell = `<!doctype html><html><head><title>Library</title><meta name="description" content="Library">
<script type="module" crossorigin src="./assets/app.js"></script><link rel="modulepreload" href="./assets/chunk.js">
<link rel="stylesheet" href="./assets/app.css"><script src="./theme-init.js"></script></head>
<body><a class="brand" href="#/">captchastrophe</a><button id="theme">Theme</button><main id="view">Loading</main></body></html>`;

describe('static discovery', () => {
  it('exposes entries as real links and separates unapproved submissions', () => {
    const pending = { ...entry, id: 'pending-entry', title: 'Unchecked', status: 'pre-review' as const };
    const html = renderLibrary([entry, pending]);
    const accepted = html.slice(html.indexOf('<h2'), html.lastIndexOf('<h2'));
    expect(accepted).toContain(`href="${entryPath(entry)}"`);
    expect(accepted).not.toContain(pending.title);
    expect(html.slice(html.lastIndexOf('<h2'))).toContain(`href="${entryPath(pending)}"`);
    expect(html).toContain('href="/data/index.json"');
    expect(renderLibrary([])).not.toContain('<article');
  });

  it('escapes contestant HTML and preserves replacement-like text literally', () => {
    const hostile = { ...entry, title: '$& <img src=x onerror=alert(1)>', description: '</p><script>alert(1)</script>', sourceUrl: 'https://github.com/" onclick="alert(1)' };
    const html = renderEntryPage(shell, hostile);
    expect(html).toContain('$&amp; &lt;img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('" onclick="');
    expect(withMain(shell, '$&')).toContain('<main id="view">$&</main>');
  });

  it('keeps static entry information readable without running the app or challenge', () => {
    const html = renderEntryPage(shell, { ...entry, status: 'pre-review' });
    expect(html).toContain(`<h1>${entry.title}</h1>`);
    expect(html).toContain(`href="/#/e/${entry.id}"`);
    expect(html).toContain('Unapproved submission');
    expect(html).toContain('href="/assets/app.css"');
    expect(html).toContain('src="/theme-init.js"');
    expect(html).toContain(`href="${PRODUCTION_ORIGIN}${entryPath(entry)}"`);
    expect(html).not.toMatch(/type="module"|modulepreload|id="theme"|<iframe/);
  });

  it('lists only addressable documents in the sitemap', () => {
    const xml = renderSitemap([entry]);
    expect(xml).toContain(`<loc>${PRODUCTION_ORIGIN}/</loc>`);
    expect(xml).toContain(`<loc>${PRODUCTION_ORIGIN}${entryPath(entry)}</loc>`);
    expect(xml).toContain('/docs/agent-access.md</loc>');
    expect(xml).not.toContain('#');
  });
});
