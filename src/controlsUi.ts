// The Controls screen (remap keys and controller buttons), the button names shown in How to play,
// and moving through menus with a controller.

import { ACTIONS, PAD_FIXED, SLOTS, bindKey, bindPad, defaults, keyName, padName, type Action } from './bindings';
import type { Controls } from './input';
import type { Nav } from './pad';
import { sfx } from './audio/sounds';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const kbd = (t: string) => `<kbd>${t}</kbd>`;

/** The names of the keys or buttons for one action on the device in use, e.g. "<kbd>A</kbd> <kbd>←</kbd>". */
export function keysFor(c: Controls, a: Action, pad = c.device === 'pad'): string[] {
  return pad ? c.binds.pad[a].filter((b) => b >= 0).map(padName) : c.binds.keys[a].filter(Boolean).map(keyName);
}

const GUARD_HOW = {
  flick: 'Flick the mouse <b>up</b> to guard high, <b>down</b> to guard low. Only the direction counts, not where the mouse is.',
  cursor: "Move the crosshair <b>above</b> your fighter's waist to guard high, <b>below</b> to guard low.",
  pad: 'Push the left stick <b>up</b> to guard high, <b>down</b> to guard low. It stays where you last pushed it.',
};

/** Fill every [data-keys] prompt with the current keys or controller buttons. */
export function renderPrompts(c: Controls) {
  const pad = c.device === 'pad';
  document.body.classList.toggle('pad', pad);
  for (const el of document.querySelectorAll<HTMLElement>('[data-keys]')) {
    const acts = el.dataset.keys!.split(',') as Action[];
    let names = acts.flatMap((a) => keysFor(c, a, pad));
    if (pad && acts.includes('left')) names = ['Left stick ◀ ▶', ...names];
    el.innerHTML = names.length ? names.map(kbd).join(' ') : '<i>none</i>';
  }
  for (const el of document.querySelectorAll<HTMLElement>('.dash-key')) el.hidden = keysFor(c, 'dash', pad).length === 0;
  for (const el of document.querySelectorAll<HTMLElement>('.hit-key')) el.hidden = keysFor(c, 'hitboxes', pad).length === 0;
  const how = $('#howGuard');
  if (how) how.innerHTML = pad ? GUARD_HOW.pad : GUARD_HOW[c.guardStyle];
}

/** A short label for prompts like "Press R or Rematch". */
export function restartLabel(c: Controls) { return keysFor(c, 'restart')[0] ?? null; }

// ---------- the Controls screen ----------
let lastBind = 0;

export function setupControlsScreen(c: Controls) {
  const rows = $('#bindRows'), msg = $('#bindMsg');
  const render = () => {
    rows.innerHTML = ACTIONS.map(({ id, name, note }) => {
      const cell = (dev: 'key' | 'pad', i: number) => {
        const v = dev === 'key' ? keyName(c.binds.keys[id][i]) : padName(c.binds.pad[id][i]);
        const label = `${name}, ${dev === 'key' ? 'keyboard or mouse' : 'controller'} ${i + 1}`;
        return `<td><button class="slot" type="button" data-bind="${id}" data-dev="${dev}" data-slot="${i}" aria-label="${label}: ${v || 'empty'}">${v || '<i>—</i>'}</button></td>`;
      };
      const slots = (dev: 'key' | 'pad') => Array.from({ length: SLOTS }, (_, i) => cell(dev, i)).join('');
      return `<tr><th scope="row">${name}${note ? `<small>${note}</small>` : ''}</th>${slots('key')}${slots('pad')}</tr>`;
    }).join('');
    renderPrompts(c);
  };
  const say = (t: string) => { msg.textContent = t; };
  const finish = () => { c.capture = null; lastBind = performance.now(); render(); };

  rows.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-bind]');
    if (!btn || c.capture || performance.now() - lastBind < 250) return;
    const a = btn.dataset.bind as Action, dev = btn.dataset.dev as 'key' | 'pad', slot = Number(btn.dataset.slot);
    const name = ACTIONS.find((x) => x.id === a)!.name;
    const label = btn.innerHTML;
    btn.classList.add('waiting');
    btn.innerHTML = dev === 'key' ? 'Press a key, or click here…' : 'Press a button…';
    say('');
    c.capture = (got) => {
      const b = structuredClone(c.binds);
      if (got.cancel && got.quiet) {
        // Clicked away: leave the boxes in place so that click still lands (it may pick another box).
        c.capture = null; btn.classList.remove('waiting'); btn.innerHTML = label; say(''); return;
      }
      if (got.cancel) { finish(); say('Unchanged.'); return; }
      if (dev === 'key' && got.key) {
        if (got.key === 'Delete' || got.key === 'Backspace' || got.key === b.keys[a][slot]) { b.keys[a][slot] = ''; c.setBindings(b); finish(); say(`${name}: emptied.`); return; }
        const from = bindKey(b, a, slot, got.key);
        c.setBindings(b); finish();
        say(`${name}: ${keyName(got.key)}.` + (from ? ` Taken off ${ACTIONS.find((x) => x.id === from)!.name}.` : ''));
      } else if (dev === 'pad' && got.pad !== undefined) {
        if (PAD_FIXED.includes(got.pad)) { finish(); say(`${padName(got.pad)} is kept for moving, guarding and the menu.`); return; }
        if (got.pad === b.pad[a][slot]) { b.pad[a][slot] = -1; c.setBindings(b); finish(); say(`${name}: emptied.`); return; }
        const from = bindPad(b, a, slot, got.pad);
        c.setBindings(b); finish();
        say(`${name}: ${padName(got.pad)}.` + (from ? ` Taken off ${ACTIONS.find((x) => x.id === from)!.name}.` : ''));
      } else {
        // The other device was pressed: keep waiting for the right one.
        say(dev === 'key' ? 'That box is for a key or mouse button.' : 'That box is for a controller button.');
      }
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-bind="${a}"][data-dev="${dev}"][data-slot="${slot}"]`)?.focus());
    };
  });
  $('#bindReset').addEventListener('click', () => { c.setBindings(defaults()); render(); say('Back to the defaults.'); });
  render();
  return { render, cancel: () => { if (c.capture) { c.capture = null; render(); } } };
}

// ---------- menus on a controller ----------
const FOCUSABLE = 'button, select, input:not([type=hidden]), a[href]';

/** Focus a button and mark it, so the ring shows even when the browser doesn't draw focus. */
function focusOn(el: HTMLElement) {
  for (const o of document.querySelectorAll('.nav-at')) o.classList.remove('nav-at');
  el.classList.add('nav-at');
  if (document.activeElement !== el) sfx.nav();
  el.focus();
}

function visible(el: HTMLElement) {
  if ((el as HTMLButtonElement).disabled || el.closest('[hidden]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/**
 * Move through the buttons in `root` with the stick or d-pad; A presses, B calls `back`.
 * Left / right change a dropdown or a slider when one has the focus.
 */
export function navigate(n: Nav, root: HTMLElement, back: () => void) {
  const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
  if (!items.length) return;
  const cur = document.activeElement as HTMLElement | null;
  const at = cur ? items.indexOf(cur) : -1;
  if (n === 'back') { back(); return; }
  if (at < 0) { if (n !== 'menu') focusOn(items[0]); return; }
  if (n === 'ok') {
    if (cur instanceof HTMLSelectElement) step(cur, 1);
    else cur!.click();
    return;
  }
  if ((n === 'left' || n === 'right') && cur instanceof HTMLSelectElement) { step(cur, n === 'right' ? 1 : -1); return; }
  if ((n === 'left' || n === 'right') && cur instanceof HTMLInputElement && cur.type === 'range') {
    if (n === 'right') cur.stepUp(); else cur.stepDown();
    cur.dispatchEvent(new Event('input', { bubbles: true })); cur.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  if (n === 'menu') return;
  const d = n === 'down' || n === 'right' ? 1 : -1;
  // A row of choices (the Fighter screen): left / right picks the next one, up / down moves to the next row's pick.
  const group = cur!.closest<HTMLElement>('[data-choices]');
  if (group) {
    const groups = [...root.querySelectorAll<HTMLElement>('[data-choices]')].filter(visible);
    if (n === 'left' || n === 'right') {
      const bs = [...group.querySelectorAll<HTMLButtonElement>('button')];
      const next = bs[(bs.indexOf(cur as HTMLButtonElement) + d + bs.length) % bs.length];
      next.click();
      const again = next.id ? document.getElementById(next.id) : next; // the row may be redrawn by the click
      if (again) focusOn(again);
      return;
    }
    const g = groups[groups.indexOf(group) + d];
    if (g) { focusOn(g.querySelector<HTMLElement>('[aria-pressed="true"]') ?? g.querySelector<HTMLElement>(FOCUSABLE)!); return; }
    // Past the first or last row: carry on to the buttons before or after the rows.
    const inRow = [...group.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const i = items.indexOf(d > 0 ? inRow[inRow.length - 1] : inRow[0]);
    focusOn(items[(i + d + items.length) % items.length]);
    return;
  }
  // In a table (the Controls screen), up and down keep the column.
  const td = cur!.closest('td');
  if (td && (n === 'up' || n === 'down')) {
    const tr = td.parentElement as HTMLTableRowElement;
    const row = (n === 'down' ? tr.nextElementSibling : tr.previousElementSibling) as HTMLTableRowElement | null;
    const target = row?.cells[td.cellIndex]?.querySelector<HTMLElement>(FOCUSABLE);
    if (target) { focusOn(target); return; }
    // Off the top or bottom of the table: carry on to the buttons before or after it.
    const rows = tr.parentElement!.querySelectorAll(FOCUSABLE);
    const edge = n === 'down' ? rows[rows.length - 1] : rows[0];
    const i = items.indexOf(edge as HTMLElement);
    if (i >= 0) { focusOn(items[(i + d + items.length) % items.length]); return; }
  }
  focusOn(items[(at + d + items.length) % items.length]);
}

function step(sel: HTMLSelectElement, d: number) {
  const opts = [...sel.options].filter((o) => !o.disabled && !o.hidden);
  const i = opts.findIndex((o) => o.selected);
  const next = opts[(i + d + opts.length) % opts.length];
  if (!next || next.selected) return;
  sel.value = next.value;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
}
