// The flat paper HUD over the scene: health strips, the clock, round diamonds and banners.

import { PAGES, RULES } from './sim/rules';
import type { State } from './sim/sim';
import { LOOKS } from './render/common';

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;
/** Health as a share of the full strip, in %. */
const pct = (hp: number) => (hp / RULES.maxHp) * 100;

/** The round-end line. A counter cut says why it was an instant K.O., so players learn the rule. */
function howText(s: State, loser: string) {
  if (s.how !== 'Counter cut') return s.how;
  return s.why === 'wind'
    ? `Counter cut! ${loser} was hit while winding up a heavy: instant K.O.`
    : `Counter cut! ${loser} was hit right after missing a slash: instant K.O.`;
}

export class Hud {
  private bars = [$('#bar0'), $('#bar1')];
  private clock = $('#clock');
  private banner = $('#banner');
  private bannerText = $('#bannerText');
  private rematchBtn = $<HTMLButtonElement>('#rematch');
  private lastBanner = '';
  private lastClock = -1;
  /** Your seat online (shows "you" on your name), or null offline. */
  you: number | null = null;
  online = false;

  constructor() {
    // One round diamond per win needed.
    for (const bar of this.bars) bar.querySelector('.pips')!.innerHTML = '<b></b>'.repeat(RULES.winsNeeded);
  }

  setNames() {
    this.bars.forEach((bar, i) => {
      const nm = bar.querySelector('.nm')!;
      nm.textContent = LOOKS[i].name;
      bar.classList.toggle('you', this.you === i);
    });
  }

  strip(seat: number, hpLeft: number, lostHp: number) {
    const strip = this.bars[seat].querySelector('.strip')!;
    const hp = pct(hpLeft), lost = pct(lostHp);
    (strip.querySelector('i') as HTMLElement).style.width = hp + '%';
    if (lost > 0) {
      const s = document.createElement('span'); s.className = 'sliver'; s.style.width = lost + '%';
      s.style[seat === 0 ? 'left' : 'right'] = hp + '%';
      strip.appendChild(s); setTimeout(() => s.remove(), 950);
    }
  }

  /** Bring the HUD in line with the fight (cheap to call every frame). */
  update(s: State, mySeat: number | null) {
    s.f.forEach((f, i) => {
      (this.bars[i].querySelector('.strip i') as HTMLElement).style.width = pct(f.hp) + '%';
      this.bars[i].querySelectorAll('.pips b').forEach((b, k) => b.classList.toggle('on', k < f.wins));
    });
    const secs = Math.ceil(s.clock / 60);
    if (secs !== this.lastClock) { this.clock.textContent = String(secs); this.lastClock = secs; }

    let html = '';
    const name = (i: number) => LOOKS[i].name + (this.you === i ? ' (you)' : '');
    if (s.phase === 'intro') html = s.phaseT < RULES.introCut ? `Round ${s.round}<small>${PAGES[s.page].name}</small>` : 'Cut!';
    else if (s.phase === 'ko' && s.phaseT > 54) {
      html = s.roundWinner >= 0 ? `${name(s.roundWinner)} takes round ${s.round}<small>${howText(s, LOOKS[1 - s.roundWinner].name)}</small>`
        : `Draw<small>${s.how === 'Time' ? 'Time ran out with the strips level.' : s.how} The round is replayed.</small>`;
    } else if (s.phase === 'over') {
      const w = s.f[0].wins > s.f[1].wins ? 0 : 1;
      const waiting = mySeat !== null && s.rematch[mySeat];
      const hint = !this.online ? 'Press R or Rematch for a new match.' : waiting ? 'Waiting for your rival to say yes…' : 'Press R or Rematch to fight again.';
      html = `${name(w)} wins<small>${s.f[w].wins}-${s.f[1 - w].wins}. ${hint}</small>`;
    }
    if (html !== this.lastBanner) {
      this.lastBanner = html;
      this.banner.hidden = !html;
      if (html) this.bannerText.innerHTML = html;
    }
    this.rematchBtn.hidden = s.phase !== 'over' || (mySeat !== null && s.rematch[mySeat]);
  }
}
