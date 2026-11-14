export default function mount(el: HTMLElement, ctx: { succeed(): void; signal: AbortSignal }) {
  const log: string[] = [];
  Object.assign(window, { __wiringLog: log });
  log.push("mounted");
  ctx.signal.addEventListener("abort", () => log.push("aborted"));
  const button = document.createElement("button");
  button.textContent = "Report success";
  button.addEventListener("click", () => ctx.succeed());
  el.append(button);
  return () => { log.push("cleanup"); button.remove(); };
}
