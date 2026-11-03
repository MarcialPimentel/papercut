// The flat paper HUD over the scene: health strips, the clock, round diamonds and banners.

import { DEFAULT_CFG, ENDLESS, type MatchCfg } from './sim/config';
import { PAGES, RULES } from './sim/rules';
import { matchWinner, type State } from './sim/sim';
import { LOOKS } from './render/common';

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;
/** Endless: the bot's level (1, 2, 3…) after `cut` bots. */
export const botLevel = (cut: number) => Math.floor(cut / ENDLESS.healEvery) + 1;

/** The round-end line. A counter cut says why it was an instant K.O., so players learn the rule. */
function howText(s: State, loser: string) {
  if (s.how === 'Time') return `Time ran out: ${loser} had less strip left.`;
  if (s.how !== 'Counter cut') return s.how;
  return s.why === 'wind'
    ? `Counter cut! ${loser} ${loser === 'You' ? 'were' : 'was'} hit while winding up a heavy: instant K.O.`
    : `Counter cut! ${loser} ${loser === 'You' ? 'were' : 'was'} hit just after missing a slash: instant K.O.`;
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
  /** A tournament fight: no rematch; the bracket comes next. */
  tourney = false;
  /** Player names for the two bars (tournaments); null = the fighters' own names. */
  names: [string, string] | null = null;
  /** The tutorial: no round tally, and a K.O. banner that only says why. */
  tutorial = false;
  /** Endless: your best run before this one, for the end banner. */
  best = 0;
  /** The key or button that restarts, for "Press R or Rematch" (null if none is bound). Set by main. */
  restartKey: string | null = 'R';
  private again(what: string) { return this.restartKey ? `Press ${this.restartKey} or Rematch to ${what}.` : `Rematch to ${what}.`; }
  private cfg: MatchCfg = DEFAULT_CFG;
  private lastTally = '';

  /** Health as a share of the full strip, in %. */
  private pct(hp: number) { return (hp / this.cfg.maxHp) * 100; }

  /** Set up for a match's rules: one round diamond per win needed, or a counter when rounds are endless. */
  setRules(cfg: MatchCfg) {
    this.cfg = cfg; this.lastTally = ''; this.lastClock = -1;
    for (const bar of this.bars) bar.querySelector('.pips')!.innerHTML = cfg.wins > 0 ? '<b></b>'.repeat(cfg.wins) : '<span class="tally"></span>';
  }

  setNames() {
    this.bars.forEach((bar, i) => {
      const nm = bar.querySelector('.nm')!;
      nm.textContent = this.names?.[i] ?? LOOKS[i].name;
      bar.classList.toggle('you', this.you === i);
    });
  }

  strip(seat: number, hpLeft: number, lostHp: number) {
    const strip = this.bars[seat].querySelector('.strip')!;
    const hp = this.pct(hpLeft), lost = this.pct(lostHp);
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
      (this.bars[i].querySelector('.strip i') as HTMLElement).style.width = this.pct(f.hp) + '%';
      this.bars[i].querySelectorAll('.pips b').forEach((b, k) => b.classList.toggle('on', k < f.wins));
    });
    const g = s.cfg.gauntlet, cut = s.f[0].wins;
    if (s.cfg.wins === 0) {
      const t = this.tutorial ? ['', ''] : g ? [`Bots cut: ${cut}`, `Level ${botLevel(cut)}`] : [`Rounds: ${s.f[0].wins}`, `Rounds: ${s.f[1].wins}`];
      const key = t.join('|') + (g ? `|Bot ${cut + 1}` : '');
      if (key !== this.lastTally) {
        this.lastTally = key;
        this.bars.forEach((bar, i) => { (bar.querySelector('.tally') as HTMLElement).textContent = t[i]; });
        if (g) this.bars[1].querySelector('.nm')!.textContent = `Bot ${cut + 1}`;
      }
    }
    const secs = s.cfg.roundSecs > 0 ? Math.ceil(s.clock / 60) : -2;
    if (secs !== this.lastClock) { this.clock.textContent = secs === -2 ? '∞' : String(secs); this.lastClock = secs; }

    let html = '';
    const name = (i: number) => (this.names?.[i] ?? LOOKS[i].name) + (this.you === i ? ' (you)' : '');
    if (s.phase === 'intro') {
      html = s.phaseT >= RULES.introCut ? 'Cut!'
        : g ? `Bot ${cut + 1}<small>Level ${botLevel(cut)} · ${PAGES[s.page].name}</small>`
        : `Round ${s.round}<small>${PAGES[s.page].name}</small>`;
    } else if (s.phase === 'ko' && s.phaseT > 30 && this.tutorial && s.roundWinner >= 0) {
      const why = howText(s, s.roundWinner === 0 ? LOOKS[1].name : 'You').replace(/^Counter cut! /, '').replace(/: instant K\.O\.$/, '.');
      html = `Counter cut<small>${why} Instant K.O.</small>`;
    } else if (s.phase === 'ko' && s.phaseT > 54 && g && s.roundWinner >= 0) {
      html = s.roundWinner === 0 ? `Bot ${cut} cut<small>${howText(s, `Bot ${cut}`)}</small>` : `Cut down<small>${howText(s, 'You')}</small>`;
    } else if (s.phase === 'ko' && s.phaseT > 54) {
      html = s.roundWinner >= 0 ? `${name(s.roundWinner)} takes round ${s.round}<small>${howText(s, this.names?.[1 - s.roundWinner] ?? LOOKS[1 - s.roundWinner].name)}</small>`
        : `Draw<small>${s.how === 'Time' ? 'Time ran out with the strips level.' : s.how} The round is replayed.</small>`;
    } else if (s.phase === 'over' && g) {
      html = `Run over<small>${cut} bot${cut === 1 ? '' : 's'} cut. ${cut > this.best ? 'A new best!' : `Best: ${this.best}.`} ${this.again('run again')}</small>`;
    } else if (s.phase === 'over') {
      const w = matchWinner(s);
      const waiting = mySeat !== null && s.rematch[mySeat];
      const hint = this.tourney ? 'Back to the bracket in a moment…' : !this.online ? this.again('start a new match') : waiting ? 'Waiting for your rival to say yes…' : this.again('fight again');
      html = `${name(w)} wins<small>${s.f[w].wins}-${s.f[1 - w].wins}. ${hint}</small>`;
    }
    if (html !== this.lastBanner) {
      this.lastBanner = html;
      this.banner.hidden = !html;
      if (html) this.bannerText.innerHTML = html;
    }
    this.rematchBtn.hidden = this.tourney || s.phase !== 'over' || (mySeat !== null && s.rematch[mySeat]);
  }
}
