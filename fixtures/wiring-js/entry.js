export default function mount(el, ctx) {
  const log = [];
  Object.assign(window, { __wiringLog: log });
  log.push("mounted");
  ctx.signal.addEventListener("abort", () => log.push("aborted"));
  const button = document.createElement("button");
  button.textContent = "Report success";
  button.addEventListener("click", () => ctx.succeed());
  el.append(button);
  return () => { log.push("cleanup"); button.remove(); };
}
