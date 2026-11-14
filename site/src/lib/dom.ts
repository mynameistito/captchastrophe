export type Child = Node | string | number | null | undefined | false | Child[];

export interface Props {
  class?: string;
  on?: { [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void };
  [attr: string]: unknown;
}

const PROPERTY_ATTRS = new Set(['value', 'checked', 'disabled', 'hidden', 'selected', 'tabIndex']);

/** Tiny element builder. Strings become text nodes, never HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null) continue;
      if (key === 'class') el.className = String(value);
      else if (key === 'on') {
        for (const [type, handler] of Object.entries(value as Record<string, EventListener>)) el.addEventListener(type, handler);
      } else if (PROPERTY_ATTRS.has(key)) (el as unknown as Record<string, unknown>)[key] = value;
      else if (value === false && !key.startsWith('aria-')) continue;
      else el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  append(el, children);
  return el;
}

function append(parent: Node, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else parent.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Decorative inline icon from path data. Hidden from assistive technology. */
export function icon(paths: string[], extra?: { circle?: [number, number, number] }): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  if (extra?.circle) {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', String(extra.circle[0]));
    c.setAttribute('cy', String(extra.circle[1]));
    c.setAttribute('r', String(extra.circle[2]));
    svg.appendChild(c);
  }
  for (const d of paths) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  }
  return svg;
}

export const icons = {
  up: () => icon(['M12 19V5M5 12l7-7 7 7']),
  down: () => icon(['M12 5v14M19 12l-7 7-7-7']),
  search: () => icon(['M20 20l-4-4'], { circle: [11, 11, 6.5] }),
  sun: () => icon(['M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4'], { circle: [12, 12, 4] }),
  moon: () => icon(['M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z']),
};
