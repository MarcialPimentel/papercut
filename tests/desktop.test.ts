// The desktop build's supports: only same-rules players fight online, and saved settings are cleaned.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fightVersion } from '../server/fightVersion';
import { Lobby, MISMATCH_MSG, type Peer } from '../server/lobby';
import type { ToClient } from '../src/net/protocol';
import { DEFAULT_DISPLAY, cleanDisplay, skipFrame } from '../src/settings';

class FakePeer implements Peer {
  inbox: ToClient[] = [];
  rtt = 50;
  constructor(public v?: string) {}
  send(m: ToClient) { this.inbox.push(m); }
  last() { return this.inbox[this.inbox.length - 1]; }
}

describe('fight version', () => {
  it('is the same for Windows and Linux line endings, and changes with the rules', () => {
    const a = mkdtempSync(join(tmpdir(), 'pc-')), b = mkdtempSync(join(tmpdir(), 'pc-'));
    writeFileSync(join(a, 'rules.ts'), 'export const X = 1;\r\nexport const Y = 2;\r\n');
    writeFileSync(join(b, 'rules.ts'), 'export const X = 1;\nexport const Y = 2;\n');
    expect(fightVersion(a)).toBe(fightVersion(b));
    writeFileSync(join(b, 'rules.ts'), 'export const X = 1;\nexport const Y = 3;\n');
    expect(fightVersion(a)).not.toBe(fightVersion(b));
  });

  it('the server turns away games on other rules, and pairs the rest', () => {
    const lobby = new Lobby(Math.random, setTimeout, 'aaaa1111');
    const old = new FakePeer('0000beef'), none = new FakePeer(), a = new FakePeer('aaaa1111'), b = new FakePeer('aaaa1111');
    for (const p of [old, none]) {
      for (const t of ['quick', 'host', 'tourney'] as const) {
        lobby.message(p, { t });
        expect(p.last()).toEqual({ t: 'err', msg: MISMATCH_MSG });
      }
    }
    lobby.message(a, { t: 'host' });
    const room = a.last();
    if (room.t !== 'room') throw new Error('no room');
    lobby.message(old, { t: 'join', code: room.code });
    expect(old.last()).toEqual({ t: 'err', msg: MISMATCH_MSG });
    lobby.message(b, { t: 'join', code: room.code });
    expect(b.last()).toMatchObject({ t: 'start', seat: 1 });
  });
});

describe('display settings', () => {
  it('keeps known values and replaces anything else with the defaults', () => {
    expect(cleanDisplay(null)).toEqual(DEFAULT_DISPLAY);
    expect(cleanDisplay({ fullscreen: false, scale: 0.75, fps: 144, vsync: false })).toEqual({ fullscreen: false, scale: 0.75, fps: 144, vsync: false });
    expect(cleanDisplay({ fullscreen: 'yes', scale: 7, fps: 61 })).toEqual(DEFAULT_DISPLAY);
  });

  it('the frame cap skips refreshes that come too soon, and never at "match the screen"', () => {
    expect(skipFrame(0, 1)).toBe(false);
    expect(skipFrame(60, 16.6)).toBe(false); // a 60 Hz screen with a 60 cap draws every refresh
    expect(skipFrame(60, 6.9)).toBe(true); // a 144 Hz screen with a 60 cap skips some
    expect(skipFrame(30, 16.7)).toBe(true);
    expect(skipFrame(30, 33.4)).toBe(false);
  });
});
