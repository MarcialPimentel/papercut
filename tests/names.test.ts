// Player names: the shared name rule, names travelling online, and the saved name on the Fighter screen.
import { beforeEach, describe, expect, it } from 'vitest';
import { Lobby, type Peer } from '../server/lobby';
import { cleanName, type ToClient } from '../src/net/protocol';

class FakePeer implements Peer {
  inbox: ToClient[] = [];
  send(m: ToClient) { this.inbox.push(m); }
  last<K extends ToClient['t']>(t: K) {
    for (let i = this.inbox.length - 1; i >= 0; i--) if (this.inbox[i].t === t) return this.inbox[i] as Extract<ToClient, { t: K }>;
    return undefined;
  }
}

describe('the name rule', () => {
  it('keeps letters, numbers, spaces and _ . \' -', () => {
    expect(cleanName("O'Brien-San_2", 'x')).toBe("O'Brien-San_2");
    expect(cleanName('Ñandú 侍', 'x')).toBe('Ñandú 侍');
  });
  it('drops anything else, squeezes spaces and cuts to 14', () => {
    expect(cleanName('<b>Kenji</b>!!', 'x')).toBe('bKenjib');
    expect(cleanName('  A    B  ', 'x')).toBe('A B');
    expect(cleanName('Abcdefghijklmnopq', 'x')).toBe('Abcdefghijklmn');
    expect(cleanName('Abcdefghijklm nop', 'x')).toBe('Abcdefghijklm'); // no space left dangling at the cut
  });
  it('falls back when nothing is left', () => {
    expect(cleanName('<>!!', 'Kami')).toBe('Kami');
    expect(cleanName(42, 'Kami')).toBe('Kami');
    expect(cleanName(undefined, '')).toBe('');
  });
});

describe('names online', () => {
  it('both players see both names when an invite room starts', () => {
    const lobby = new Lobby(), a = new FakePeer(), b = new FakePeer();
    lobby.message(a, { t: 'host', name: 'Marz' });
    lobby.message(b, { t: 'join', code: a.last('room')!.code, name: 'Kenji' });
    for (const p of [a, b]) expect(p.last('start')!.names).toEqual(['Marz', 'Kenji']);
  });

  it('quick match carries names, cleans them, and falls back to Kami / Sumi', () => {
    const lobby = new Lobby(), a = new FakePeer(), b = new FakePeer();
    lobby.message(a, { t: 'quick', name: '<script>' });
    lobby.message(b, { t: 'quick' });
    expect(a.last('start')!.names).toEqual(['script', 'Sumi']);
    const c = new FakePeer(), d = new FakePeer();
    lobby.message(c, { t: 'quick', name: '!!!' });
    lobby.message(d, { t: 'quick', name: 'Ronin 4F2A' });
    expect(d.last('start')!.names).toEqual(['Kami', 'Ronin 4F2A']);
  });
});

describe('your saved name', () => {
  let saved: Record<string, string>;
  beforeEach(() => {
    saved = {};
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => saved[k] ?? null,
      setItem: (k: string, v: string) => { saved[k] = v; },
    };
  });

  it('a first-time player gets a Ronin name that sticks', async () => {
    const { myName } = await import('../src/name');
    const n = myName();
    expect(n).toMatch(/^Ronin [0-9A-F]{4}$/);
    expect(myName()).toBe(n);
    expect(saved['papercut.name']).toBe(n);
  });

  it('a typed name is cleaned and saved; an empty one becomes a new Ronin name', async () => {
    const { myName, saveName } = await import('../src/name');
    expect(saveName('  Marz <3 ')).toBe('Marz 3');
    expect(myName()).toBe('Marz 3');
    expect(saveName('   ')).toMatch(/^Ronin [0-9A-F]{4}$/);
  });

  it('a name saved by an older build (or edited by hand) is cleaned on the way out', async () => {
    const { myName } = await import('../src/name');
    saved['papercut.name'] = '<i>Old</i>';
    expect(myName()).toBe('iOldi');
  });
});
