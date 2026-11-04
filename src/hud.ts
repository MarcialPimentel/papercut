// The flat paper HUD over the scene: health strips, the clock, round diamonds and banners.

import type { RankInfo } from './net/protocol';
import { botLevel } from './sim/endless';
import { DEFAULT_CFG, type MatchCfg } from './sim/config';
import { DEFENCE, PAGES, RULES } from './sim/rules';
import { matchWinner, type State } from './sim/sim';
import { LOOKS } from './render/common';

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** Endless: the bot's level (1, 2, 3…) after `cut` bots. */
export { botLevel };

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
  /** Playing back a saved fight: no rematch. */
  replay = false;
  /** Player names for the two bars (tournaments); null = the fighters' own names. */
  names: [string, string] | null = null;
  /** The tutorial: no round tally, and a K.O. banner that only says why. */
  tutorial = false;
  /** Endless: your best run before this one, for the end banner. */
  best = 0;
  /** A ranked match: both players' divisions (shown beside their names); no rematch. */
  ranks: [RankInfo, RankInfo] | null = null;
  /** Endless: where the finished run put you on the leaderboard (or why it wasn't posted). */
  placeNote = '';
  /** Ranked: the result once the server has counted it, e.g. "+18 · Cardstock 1518". */
  rankNote = '';
  /** The key or button that restarts, for "Press R or Rematch" (null if none is bound). Set by main. */
  restartKey: string | null = 'R';
  private again(what: string) { return this.restartKey ? `Press ${this.restartKey} or Rematch to ${what}.` : `Rematch to ${what}.`; }
  private cfg: MatchCfg = DEFAULT_CFG;
  private lastTrack = '';
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
      let rk = bar.querySelector<HTMLElement>('.rk');
      if (!rk) { rk = document.createElement('span'); rk.className = 'rk'; nm.after(rk); }
      const r = this.ranks?.[i];
      rk.hidden = !r;
      rk.textContent = r ? (r.placed ? `${r.division} ${r.points}` : r.division) : '';
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
    const g = s.cfg.gauntlet, cut = s.f[0].wins, def = !!s.cfg.defence, cuts = def || !!s.cfg.training;
    if (s.cfg.wins === 0) {
      const t = this.tutorial ? ['', ''] : g ? [`Bots cut: ${cut}`, `Level ${botLevel(cut)}`]
        : cuts ? [`Cuts: ${s.f[0].wins}`, `Cuts: ${s.f[1].wins}`] : [`Rounds: ${s.f[0].wins}`, `Rounds: ${s.f[1].wins}`];
      const key = t.join('|') + (g ? `|Bot ${cut + 1}` : '');
      if (key !== this.lastTally) {
        this.lastTally = key;
        this.bars.forEach((bar, i) => { (bar.querySelector('.tally') as HTMLElement).textContent = t[i]; });
        if (g) this.bars[1].querySelector('.nm')!.textContent = `Bot ${cut + 1}`;
      }
    }
    let html = '';
    const name = (i: number) => (this.names?.[i] ?? LOOKS[i].name) + (this.you === i ? ' (you)' : '');
    const plain = (i: number) => this.names?.[i] ?? LOOKS[i].name;
    if (def) {
      // Dojo Defense: the five spreads instead of a clock, the one being fought on lit, and who has the way.
      const key = `d${s.zone}|${s.way}|${this.names?.join()}`;
      if (key !== this.lastTrack) {
        this.lastTrack = key; this.lastClock = -1;
        const cells = [-2, -1, 0, 1, 2].map((z) => `<i class="${z === s.zone ? 'on' : ''}${Math.abs(z) === DEFENCE.goal ? ' goal' : ''}"></i>`).join('');
        const way = s.way === 0 ? `${esc(plain(0))} →` : s.way === 1 ? `← ${esc(plain(1))}` : 'Cut to take the way';
        this.clock.classList.add('track');
        this.clock.innerHTML = `<span class="cells">${cells}</span><small>${way}</small>`;
      }
    } else {
      if (this.lastTrack) { this.lastTrack = ''; this.clock.classList.remove('track'); this.lastClock = -1; }
      const secs = s.cfg.roundSecs > 0 ? Math.ceil(s.clock / 60) : -2;
      if (secs !== this.lastClock) { this.clock.textContent = secs === -2 ? '∞' : String(secs); this.lastClock = secs; }
    }

    if (s.phase === 'intro') {
      html = s.phaseT >= RULES.introCut ? 'Cut!'
        : g ? `Bot ${cut + 1}<small>Level ${botLevel(cut)} · ${PAGES[s.page].name}</small>`
        : def ? `Dojo Defense<small>Cut them down, then run for their cover. ${esc(plain(0))} runs right, ${esc(plain(1))} runs left.</small>`
        : s.cfg.training ? `Training<small>${PAGES[s.page].name}</small>`
        : `Round ${s.round}<small>${PAGES[s.page].name}</small>`;
    } else if (def && s.phase === 'fight' && s.respawnT > 30 && s.roundWinner >= 0) {
      const w = s.roundWinner;
      html = `${name(w)} has the way<small>${howText(s, plain(1 - w)).replace(/\.$/, '')}. Run ${w === 0 ? 'right' : 'left'} for ${esc(plain(1 - w))}'s cover!</small>`;
    } else if (s.phase === 'ko' && s.phaseT > 30 && this.tutorial && s.roundWinner >= 0) {
      const why = howText(s, s.roundWinner === 0 ? LOOKS[1].name : 'You').replace(/^Counter cut! /, '').replace(/: instant K\.O\.$/, '.');
      html = `Counter cut<small>${why} Instant K.O.</small>`;
    } else if (s.phase === 'ko' && s.phaseT > 54 && g && s.roundWinner >= 0) {
      html = s.roundWinner === 0 ? `Bot ${cut} cut<small>${howText(s, `Bot ${cut}`)}</small>` : `Cut down<small>${howText(s, 'You')}</small>`;
    } else if (s.phase === 'ko' && s.phaseT > 54) {
      html = s.roundWinner >= 0 ? `${name(s.roundWinner)} takes round ${s.round}<small>${howText(s, this.names?.[1 - s.roundWinner] ?? LOOKS[1 - s.roundWinner].name)}</small>`
        : `Draw<small>${s.how === 'Time' ? 'Time ran out with the strips level.' : s.how} The round is replayed.</small>`;
    } else if (s.phase === 'over' && g) {
      html = `Run over<small>${cut} bot${cut === 1 ? '' : 's'} cut. ${cut > this.best ? 'A new best!' : `Best: ${this.best}.`} ${this.placeNote || 'Checking the leaderboard…'} ${this.again('run again')}</small>`;
    } else if (s.phase === 'over') {
      const w = matchWinner(s);
      const waiting = mySeat !== null && s.rematch[mySeat];
      const hint = this.replay ? 'End of the replay. Esc for your replays.' : this.ranks ? `${this.rankNote || 'Counting the result…'} Esc for the menu.` : this.tourney ? 'Back to the bracket in a moment…' : !this.online ? this.again('start a new match') : waiting ? 'Waiting for your rival to say yes…' : this.again('fight again');
      html = def
        ? `${name(w)} wins<small>Across ${esc(plain(1 - w))}'s cover with ${s.f[w].wins} cut${s.f[w].wins === 1 ? '' : 's'} to ${s.f[1 - w].wins}. ${hint}</small>`
        : `${name(w)} wins<small>${s.f[w].wins}-${s.f[1 - w].wins}. ${hint}</small>`;
    }
    if (html !== this.lastBanner) {
      this.lastBanner = html;
      this.banner.hidden = !html;
      if (html) this.bannerText.innerHTML = html;
    }
    this.rematchBtn.hidden = this.tourney || this.replay || !!this.ranks || s.phase !== 'over' || (mySeat !== null && s.rematch[mySeat]);
  }
}
