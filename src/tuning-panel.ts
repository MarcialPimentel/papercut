// The tuning panel (#9): a legal-pad sheet of sliders, opened with T in Practice. The fight pauses while it's
// open. Every change applies at once and is kept in this browser for Practice; "Copy numbers" copies the
// changes so they can be made the game's own numbers in a PR.

import { DEFAULTS, KNOBS, changes, copyText, getValue, resetTuning, saveCurrent, setValue, type Knob } from './tuning';

/** "12f", "0.85m", "1.0x": as many decimals as the slider's step has. */
const fmt = (k: Knob, v: number) => v.toFixed((String(k.step).split('.')[1] ?? '').length) + k.unit;

export class TuningPanel {
  readonly el: HTMLElement;
  private rows = new Map<string, { input: HTMLInputElement; val: HTMLElement; row: HTMLElement }>();
  private count: HTMLElement;
  private copyBtn: HTMLButtonElement;
  open = false;
  onClose: () => void = () => {};

  constructor(parent: HTMLElement, private build = '') {
    const el = (this.el = document.createElement('aside'));
    el.className = 'tune';
    el.hidden = true;
    el.setAttribute('aria-label', 'Tuning panel');
    let html = `<header><b>Tuning</b><span class="tcount"></span><button class="tx" data-t="close" aria-label="Close">T</button></header>
      <p class="tnote">Training only: online fights always use the game's numbers. Changes apply at once and are kept in this browser. Frames are 1/60 s.</p>
      <div class="tbody">`;
    let group = '';
    for (const k of KNOBS) {
      if (k.group !== group) { if (group) html += '</section>'; group = k.group; html += `<section><h3>${group}</h3>`; }
      html += `<label class="trow" data-key="${k.key}"><span class="tl">${k.label}</span>
        <input type="range" min="${k.min}" max="${k.max}" step="${k.step}" value="${getValue(k.key)}">
        <span class="tv"></span><button type="button" class="td" title="Back to the game's number">${fmt(k, DEFAULTS[k.key])}</button></label>`;
    }
    html += `</section></div>
      <footer><button class="hbtn" data-t="copy">Copy numbers</button><button class="hbtn" data-t="reset">Reset all</button><button class="hbtn" data-t="close">Close (T)</button></footer>`;
    el.innerHTML = html;
    parent.appendChild(el);
    this.count = el.querySelector('.tcount')!;
    this.copyBtn = el.querySelector('[data-t="copy"]')!;

    for (const row of el.querySelectorAll<HTMLElement>('.trow')) {
      const key = row.dataset.key!;
      const input = row.querySelector('input')!, val = row.querySelector<HTMLElement>('.tv')!;
      this.rows.set(key, { input, val, row });
      input.addEventListener('input', () => { setValue(key, Number(input.value)); this.refresh(key); saveCurrent(); });
      row.querySelector('.td')!.addEventListener('click', (e) => { e.preventDefault(); setValue(key, DEFAULTS[key]); this.refresh(key); saveCurrent(); });
    }
    el.querySelectorAll('[data-t="close"]').forEach((b) => b.addEventListener('click', () => this.toggle(false)));
    el.querySelector('[data-t="reset"]')!.addEventListener('click', () => { resetTuning(); saveCurrent(); this.refresh(); });
    this.copyBtn.addEventListener('click', async () => {
      const text = copyText(this.build);
      try { await navigator.clipboard.writeText(text); this.copyBtn.textContent = 'Copied'; }
      catch { window.prompt('Copy these numbers:', text); }
      setTimeout(() => { this.copyBtn.textContent = 'Copy numbers'; }, 1600);
    });
    // Keep fight keys from reaching the page while a slider has focus (sliders use the arrow keys).
    el.addEventListener('keydown', (e) => { if (e.code.startsWith('Arrow')) e.stopPropagation(); });
    this.refresh();
  }

  /** Show the current values (one row, or all), mark the changed ones, and count them. */
  refresh(only?: string) {
    for (const [key, r] of this.rows) {
      if (only && key !== only) continue;
      const k = KNOBS.find((x) => x.key === key)!, v = getValue(key);
      r.input.value = String(v);
      r.val.textContent = fmt(k, v);
      r.row.classList.toggle('changed', v !== DEFAULTS[key]);
    }
    const n = Object.keys(changes()).length;
    this.count.textContent = n ? `${n} changed` : "game's numbers";
  }

  toggle(open = !this.open) {
    if (open === this.open) return;
    this.open = open;
    this.el.hidden = !open;
    if (open) this.refresh();
    else { (document.activeElement as HTMLElement | null)?.blur?.(); this.onClose(); }
  }
}
