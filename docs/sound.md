# Papercut — Sound

_Added in the sound pass (2026-11-01). Code: `src/audio/`._

Papercut's sound is a mix: **free recordings** (CC0, from Kenney) for the big moments where real sound sells the hit, and **sounds made in code** for everything else, including all the music. Every sound has a code-made version, so the game always has sound even before (or without) any recordings.

Sound never touches the fight rules (`src/sim/`), so it can't affect online sync.

## What plays when

| Moment | Sound | Notes |
|---|---|---|
| "Round N" banner | Wooden clappers, speeding up (kabuki hyoshigi) | |
| "Cut!" (fight starts) | Taiko drum + clapper | |
| Heavy slash wind-up | A quiet rising paper creak | Lets you hear the counter-cut opening as well as see it |
| Slash comes out | Whoosh (heavy is lower and longer) | |
| Clash (two slashes meet) | Bright double blade ring + paper snap | Its own sound now; used to share the block sound |
| Block | A duller, shorter knock | |
| Parry | A clean high ring + rising chime | |
| Light hit | A quick paper slice | |
| Heavy hit / riposte | A long paper tear + thump | |
| K.O. | Taiko boom + full tear | |
| Counter cut | The K.O. plus a long blade ring | |
| Feint, jump, dash, landing | Paper fold, hop, soft thud | |
| Last 10 seconds | A wood tick each second, sharper for the last 3 | |
| Time up | A low gong | |
| Round won / lost | A rising / falling pluck | "Won" means you won (seat 0 in practice) |
| Match won / lost | Drum roll + climbing run / a slow fall | |
| Page turn | Paper page | |
| Menu buttons | A soft paper tap | |

Sounds pan left and right with where they happen on the page, and each play varies a little in pitch so repeats don't grate. Big hits briefly lower the music.

## Music

Made in code: taiko drums, a small high drum, a plucked bass and a koto-like melody on a Japanese scale (miyako-bushi on D). It writes fresh melodies as it goes, so no two fights sound quite the same.

| When | Music |
|---|---|
| Menus | Calm and slow |
| "Round N" banner | Drums only |
| Fight | Full, 100 beats a minute |
| Tense (deciding round, either strip at 25 or less, or the last 10 seconds) | Busier drums, 112 beats a minute |
| From a K.O. to the next round | Silent |
| Match over | The win/lose sting, then the menu music after 4 seconds |

## Volume

The **Sound** button (on the title screen next to "How to play", and top-right during a fight) opens **Music** and **Effects** sliders. The browser remembers them.

## Adding the Kenney recordings (one-time, for Marz)

Kenney's site only lets a normal browser download, so this step is manual.

1. Open https://kenney.nl/assets/impact-sounds in your browser.
2. Click **Download**, then **Continue without donating...** (or donate if you like). A zip downloads.
3. Do the same for https://kenney.nl/assets/rpg-audio and https://kenney.nl/assets/interface-sounds.
4. Tell Claude where the three zips are (usually your **Downloads** folder). Claude picks the sounds, copies only those into `public/sfx/`, and lists them below.

## Recordings in the game

_None yet. Each entry: file in `public/sfx/`, what it's used for, source pack, licence._

All Kenney packs are CC0 (public domain): no credit is required, but we credit Kenney here anyway.
