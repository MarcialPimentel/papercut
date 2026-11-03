# Papercut — Sound

_Added in the sound pass (2026-11-01). Code: `src/audio/`._

Papercut's sound is a mix: **free recordings** (CC0, from Kenney) for hits, clashes, paper and clicks, and **sounds made in code** for everything else, including all the music. Every sound has a code-made version, so the game always has sound even before (or without) any recordings.

Sound never touches the fight rules (`src/sim/`), so it can't affect online sync.

## What plays when

| Moment | Sound | Notes |
|---|---|---|
| "Round N" banner | Wooden clappers, speeding up (kabuki hyoshigi) | |
| "Cut!" (fight starts) | Taiko drum + clapper | |
| Heavy slash wind-up | A paper fold, the same for a real heavy and a feint | Lets you hear a heavy coming without telling you if it's a feint (#29) |
| Slash comes out | Whoosh (heavy is lower and longer) | |
| Clash (two slashes meet) | Bright double blade ring + paper snap | Its own sound now; used to share the block sound |
| Block | A duller, shorter knock | |
| Parry | A clean high ring + rising chime | |
| Light hit | A quick paper slice | |
| Heavy hit / riposte | A long paper tear + thump | |
| K.O. | Taiko boom + full tear | |
| Counter cut | The K.O. plus a long blade ring | |
| Jump, dash, landing | Hop, soft thud | The feint's cancel is silent (#29) |
| Last 10 seconds | A wood tick each second, sharper for the last 3 | |
| Time up | A low gong | |
| Round won / lost | A rising / falling pluck | "Won" means you won (seat 0 in practice) |
| Match won / lost | Drum roll + climbing run / a slow fall | |
| Page turn | Paper page | |
| Menu buttons | A soft paper tap | |

Sounds pan left and right with where they happen on the page, and each play varies a little in pitch so repeats don't grate. Big hits briefly lower the music.

## Music

All made in code (`src/audio/music.ts`), from the same paper-theatre band: taiko drums, a small high drum, wooden clappers (a recording), a temple bell (a recording), a plucked bass, a koto-like pluck and a bamboo flute, on Japanese five-note scales. It writes fresh melodies as it goes (a new phrase every eight bars), so no two fights sound quite the same. Each part of the game has its **own track**, so a session never loops one tune (#39).

| Track | Plays on | Feel | Tempo (normal / tense), scale | Lead and extras |
|---|---|---|---|---|
| Menu | Title screen and menus | Open and unhurried | 72, yo scale on D | Koto, soft wind |
| Dojo | Graph Paper Dojo (rounds 1 and 4) | Steady, the original track | 100 / 112, miyako-bushi on D | Koto |
| Courtyard | Ruled Courtyard (rounds 2 and 5) | Brighter and lighter | 108 / 120, yo scale on E | Bamboo flute, clappers on the offbeat |
| Grove | Legal Pad Grove (round 3) | Darker and slower | 84 / 96, in-sen scale on A | Sparse koto, a low drone, the temple bell every 4 bars, wind |
| Endless | Every Endless fight | Restless, builds with each bot level (below) | 92 to 112, kumoi scale on C | Koto, then the flute |
| Tournament | Every tournament fight and the bracket screen | Festival drums | 116 / 128 (bracket 90), yo scale on F | Flute and koto together, clappers on the backbeat |
| Back cover | After a match, once the win/lose sting has played | Still and wistful | 64, hirajoshi on A | Koto, the bell, wind |

Within every fight track, the music still follows the fight:

| When | Music |
|---|---|
| "Round N" banner | That page's drums only |
| Fight | The full track |
| Tense (deciding round, either strip at 30% or less, or the last 10 seconds) | Busier drums and faster. A **tournament final** is tense from the first round |
| From a K.O. to the next round | Silent. The next page's track starts with its "Round N" |
| Match over | The win/lose sting, then the back cover track after 4 seconds |

**Endless levels.** The bots level up every 5 bots cut, and the music adds a layer and 4 beats a minute each level, topping out at level 6:

| Level | Bots cut | Adds |
|---|---|---|
| 1 | 0-4 | Taiko on beats 1 and 3, bass, a sparse koto |
| 2 | 5-9 | High ticks |
| 3 | 10-14 | The high drum on the backbeat |
| 4 | 15-19 | Wooden clappers |
| 5 | 20-24 | Busier taiko; the flute joins the koto |
| 6 | 25+ | Fast ticks and the temple bell |

To change a track: each one is a block in `TRACKS` in `src/audio/music.ts` (scale, key, tempo, which sixteenths each drum plays on, lead instruments, how many melody notes play, bell, wind, drone). `tests/music.test.ts` checks that every page has its own track, tense is faster and busier, and Endless keeps building.

## Volume

The **Sound** button (on the title screen next to "How to play", and top-right during a fight) opens **Music** and **Effects** sliders. The browser remembers them.

## Recordings in the game

21 files in `public/sfx/`, from three free Kenney packs, downloaded 2026-11-01. All Kenney packs are CC0 (public domain): no credit is required, but we credit Kenney (www.kenney.nl) anyway. Several files for one sound = one is picked at random each time.

| Sound | Files | Pack | How it's used |
|---|---|---|---|
| Clash | impactMetal_light_000, _001, _003 | Impact Sounds | The hit; a quieter code-made ring adds the sword tail |
| Block | impactPlate_light_000, _002, _003 | Impact Sounds | Slowed a little for heavies |
| Light hit | knifeSlice2 | RPG Audio | Played faster and quieter, with a soft code-made paper snip |
| Heavy hit, K.O. | knifeSlice2 | RPG Audio | Played slower, with a soft code-made paper tear and thump. The Interface pack's scratch sounds were dropped after the #19 playtest: they squeaked |
| Counter cut | drawKnife3 | RPG Audio | A sword-draw "shing" on top of the K.O. |
| Page turn | bookFlip2, bookFlip3 | RPG Audio | |
| Feint | cloth4 | RPG Audio | |
| Landing | impactSoft_medium_000, _001, _002 | Impact Sounds | |
| Menu buttons | select_002 | Interface Sounds | |
| Last-10-seconds tick | tick_001, tick_002 | Interface Sounds | Higher for the last 3 seconds |
| Round clappers | impactWood_light_000, _002 | Impact Sounds | Sped up, with a code-made crack on top. Also the music's clappers (Courtyard, Tournament, Endless level 4+) |
| Temple bell (music) | impactBell_heavy_000, _001 | Impact Sounds | Grove, the back cover and Endless level 6. Code-made bell if missing |

Still code-made: whooshes, parry, jump/dash hop, taiko drums, the gong, all stings, and all music apart from the clappers and the bell.

## Swapping a recording

1. Put the new `.ogg` (or `.mp3`) file in `public/sfx/`.
2. In `src/audio/sounds.ts`, change the file names for that sound in `RECORDINGS`.
3. Add it to the table above with its pack and licence. Only use CC0 or clearly free-to-use sounds.

If a file is missing or won't load, the code-made version plays instead, so a bad file never makes the game silent.
