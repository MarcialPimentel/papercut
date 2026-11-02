# Papercut — Sound

_Added in the sound pass (2026-11-01). Code: `src/audio/`._

Papercut's sound is a mix: **free recordings** (CC0, from Kenney) for hits, clashes, paper and clicks, and **sounds made in code** for everything else, including all the music. Every sound has a code-made version, so the game always has sound even before (or without) any recordings.

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

## Recordings in the game

22 files in `public/sfx/` (240 KB in all), from three free Kenney packs, downloaded 2026-11-01. All Kenney packs are CC0 (public domain): no credit is required, but we credit Kenney (www.kenney.nl) anyway. Several files for one sound = one is picked at random each time.

| Sound | Files | Pack | How it's used |
|---|---|---|---|
| Clash | impactMetal_light_000, _001, _003 | Impact Sounds | The hit; a quieter code-made ring adds the sword tail |
| Block | impactPlate_light_000, _002, _003 | Impact Sounds | Slowed a little for heavies |
| Light hit | scratch_001, scratch_002 | Interface Sounds | |
| Heavy hit, K.O. | knifeSlice2, scratch_005 | RPG Audio, Interface Sounds | Plus a code-made thump |
| Counter cut | drawKnife3 | RPG Audio | A sword-draw "shing" on top of the K.O. |
| Page turn | bookFlip2, bookFlip3 | RPG Audio | |
| Feint | cloth4 | RPG Audio | |
| Landing | impactSoft_medium_000, _001, _002 | Impact Sounds | |
| Menu buttons | select_002 | Interface Sounds | |
| Last-10-seconds tick | tick_001, tick_002 | Interface Sounds | Higher for the last 3 seconds |
| Round clappers | impactWood_light_000, _002 | Impact Sounds | Sped up, with a code-made crack on top |

Still code-made: whooshes, the heavy wind-up creak, parry, jump/dash hop, taiko drums, the gong, all stings and all music.

## Swapping a recording

1. Put the new `.ogg` (or `.mp3`) file in `public/sfx/`.
2. In `src/audio/sounds.ts`, change the file names for that sound in `RECORDINGS`.
3. Add it to the table above with its pack and licence. Only use CC0 or clearly free-to-use sounds.

If a file is missing or won't load, the code-made version plays instead, so a bad file never makes the game silent.
