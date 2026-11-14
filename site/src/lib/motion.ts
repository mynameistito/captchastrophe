// Selective soft dissolve, ported from the soft-design reference (motion.js).
// Apply to the smallest region whose content changes. Never to live media (the captcha iframe),
// focused forms, or things the user is typing in. Initial render passes animate = false.

const active = new Map<Element, () => void>();
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
/** Copying computed styles into the snapshot is linear in node count; very large regions just swap. */
const MAX_ANIMATED_NODES = 600;

export function dissolveFrames(incoming: boolean, blur: string): Keyframe[] {
  const clear = { opacity: 1, filter: 'blur(0px)' };
  const soft = { opacity: 0, filter: `blur(${blur})` };
  return incoming ? [soft, clear] : [clear, soft];
}

/**
 * Replaces the children of `element` with whatever `fill` appends to the staging element it is handed.
 * The new content is live immediately; the old content is a visual-only, inert snapshot that fades out.
 * Identical content is a no-op, rapid calls supersede each other.
 */
export function replaceContent(element: HTMLElement, fill: (staging: HTMLElement) => void, animate = true): void {
  for (const [target, finish] of active) {
    if (target === element || element.contains(target)) finish();
  }
  const staging = document.createElement(element.tagName.toLowerCase());
  fill(staging);
  if (staging.innerHTML === element.innerHTML) return;

  const style = getComputedStyle(element);
  const duration = parseFloat(style.getPropertyValue('--content-duration'));
  const canAnimate =
    animate && !reduced.matches && duration > 0 && element.childNodes.length > 0 && element.querySelectorAll('*').length < MAX_ANIMATED_NODES;
  if (!canAnimate) {
    element.replaceChildren(...staging.childNodes);
    return;
  }

  const snapshot = element.cloneNode(true) as HTMLElement;
  const sources = [element, ...element.querySelectorAll('*')];
  const copies = [snapshot, ...snapshot.querySelectorAll('*')] as HTMLElement[];
  sources.forEach((source, index) => {
    const computed = getComputedStyle(source);
    for (const property of computed) copies[index]!.style.setProperty(property, computed.getPropertyValue(property));
    copies[index]!.style.transition = 'none';
    copies[index]!.style.animation = 'none';
  });
  const width = element.getBoundingClientRect().width;
  Object.assign(snapshot.style, { margin: '0', position: 'static', width: `${width}px`, maxWidth: 'none' });
  const overlay = document.createElement('span');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.inert = true;
  overlay.style.cssText = `position:absolute;top:0;left:0;width:${width}px;pointer-events:none;display:block;`;
  // IDs and semantics in the snapshot stay outside the live document.
  overlay.attachShadow({ mode: 'closed' }).append(snapshot);

  const fresh = document.createElement(element.matches('h1,h2,h3,p,span') ? 'span' : 'div');
  fresh.style.display = 'block';
  fresh.append(...staging.childNodes);
  element.replaceChildren(fresh, overlay);
  const position = element.style.position;
  if (style.position === 'static') element.style.position = 'relative';

  const blur = style.getPropertyValue('--content-blur').trim();
  const options: KeyframeAnimationOptions = { duration, easing: style.getPropertyValue('--content-ease').trim(), fill: 'both' };
  const animations = [overlay.animate(dissolveFrames(false, blur), options), fresh.animate(dissolveFrames(true, blur), options)];
  const finish = () => {
    if (active.get(element) !== finish) return;
    active.delete(element);
    animations.forEach((animation) => animation.cancel());
    overlay.remove();
    fresh.replaceWith(...fresh.childNodes);
    element.style.position = position;
  };
  active.set(element, finish);
  Promise.all(animations.map((animation) => animation.finished)).then(finish).catch(() => {});
}

function finishAll(): void {
  for (const finish of [...active.values()]) finish();
}
reduced.addEventListener('change', finishAll);
window.addEventListener('resize', finishAll);
