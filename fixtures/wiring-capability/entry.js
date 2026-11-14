export default function mount(el, ctx) {
  const button = document.createElement('button');
  button.textContent = 'Request camera';
  button.onclick = async () => { try { await ctx.requestCamera(); } catch { /* The shared runtime explains the permission state. */ } };
  el.append(button);
  return () => button.remove();
}
