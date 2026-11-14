import { expect, it } from 'vitest';
import { createFrameHost, parseFrameMessage, type IncomingMessage } from './frame-host.ts';
it('ignores vote actions, forged origins and other frames', () => {
  let receive!: (e: IncomingMessage) => void;
  const seen: unknown[] = [], sent: unknown[] = [];
  const target = { postMessage: (m: unknown) => { sent.push(m); } };
  const host = createFrameHost({ playOrigin: 'https://play.example', onMessage: m => seen.push(m), listen: fn => { receive = fn; return () => {}; } });
  host.attach({ contentWindow: target });
  receive({ source: target, origin: 'https://evil.example', data: { v: 1, type: 'success' } });
  receive({ source: {}, origin: 'https://play.example', data: { v: 1, type: 'success' } });
  receive({ source: target, origin: 'https://play.example', data: { v: 1, type: 'vote', direction: 'up' } });
  expect(seen).toEqual([]);
  receive({ source: target, origin: 'https://play.example', data: { v: 1, type: 'success' } });
  expect(seen).toEqual([{ type: 'success' }]);
  host.sendReset(); host.sendMute(true); host.sendTheme('dark');
  expect(sent).toEqual([{v:1,type:'reset'},{v:1,type:'mute',muted:true},{v:1,type:'theme',theme:'dark'}]);
  host.detach(); receive({ source: target, origin: 'https://play.example', data: { v: 1, type: 'success' } });
  expect(seen).toHaveLength(1);
});
it('rejects malformed messages and clamps layout', () => {
  expect(parseFrameMessage({v:1,type:'layout',height:999999})).toEqual({type:'layout',height:900});
  expect(parseFrameMessage({v:1,type:'layout',height:NaN})).toBeNull();
  expect(parseFrameMessage({v:1,type:'success',token:'secret'})).toBeNull();
});
