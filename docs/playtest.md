# Papercut — Playtest guide

_For the first online build (2026-11-01)._

## Open the game

- **Live:** https://papercut.marz.gg. The build number is in the bottom-right corner.
- **Desktop app (Windows, Steam Deck):** download it from a pull request's CI run; click-by-click in [desktop.md](desktop.md).
- **On your PC:** `npm install`, then `npm run dev`, then open http://localhost:5173.

Use a desktop browser with a mouse, or plug in a controller (Xbox-style, PlayStation or Steam Deck). Phones get on-screen buttons, but the game is made for the mouse or a controller.

## Controls

| Action | Input |
|---|---|
| Guard high / low | Flick the mouse up / down (Flick style, default), or the crosshair above / below your fighter's waist (Cursor style). Switch in Settings on the main menu |
| Light slash | Left click |
| Heavy slash | Right click |
| Feint (during a heavy's wind-up) | Left click or Q |
| Walk | A / D |
| Dash / backdash | Double-tap D / A |
| Jump | Space or W |
| Rematch (when the match ends) | R or the Rematch button |
| Hitbox view on / off | H |
| Fullscreen on / off (desktop app) | F11 or Alt+Enter |
| Tuning panel (Practice only) | T (the fight pauses while it's open) |
| Free the mouse / back to the menu | Esc frees the mouse (held during a fight), Esc again or Leave for the menu |

**Controller:** left stick (or d-pad) left / right walks, up / down guards high / low (the guard stays where you last pushed it). RB or X light, RT or Y heavy, B feint, A jump, LB dash (backdash with the stick at rest), View restarts, Menu for the menu. In menus: stick or d-pad moves, A picks, B goes back.

**Change any key or button** on the **Controls** screen (main menu): pick a box, press the new key, click or button. It is saved with your other settings (this browser, or the desktop app).

## Ways to play

1. **Practice vs Sumi:** Sumi is a dummy. Watch for the yellow glint on the blade: Sumi is about to switch guard. R restarts. T opens the tuning panel (below).
2. **Endless:** one bot after another, one round each, on one page (no page turns): each new bot steps in on your left or right. Your strip carries over and refills by half every 5 bots, and the bots get smarter every 5. One lost round ends the run; your best run shows on the title screen.
3. **Fight a friend:** first pick the room's rules (rounds, health, timer), then you get a link and a 4-letter room code. Send the link; the fight starts as soon as they open it. You are Kami (left), they are Sumi (right), each in the look you picked on the "Your fighter" screen. Your name has a yellow "you" tag.
4. **Tournament:** 3 to 8 friends. Pick the rules, type your name, send the link; the host presses *Start tournament*. One fight at a time, everyone else watches it live; the bracket shows between fights.
5. **Find a fight:** pairs you with the next person who presses it (standard rules: best of 5, 80 health, 60 seconds).
6. **Ranked:** rated fights with standard rules. You're paired with someone close to your rating; the search widens the longer you wait. Your first 5 matches are placement, then you get a division: Tissue, Newsprint, Cardstock, Washi, Gold Leaf. Your division and points show under the Ranked button, and a badge sits next to each name in the fight. At the end you see your points change. There's no rematch, and leaving before the end counts as a loss. The server decides the result by re-playing the fight itself. Your ranked identity lives in this browser: a private window, another browser or another PC is a new player.

## Your fighter

On the main menu, **Your fighter** opens the look picker: 6 colour sets, dark or light robe, 3 outfit prints and 4 sword styles, with a 3D preview that turns its guard high and low. **Page** only changes the preview's background, to check the look on each spread. Your pick is saved in this browser and sent to your rival when an online fight starts. One fighter always wears a dark robe and the other a light one: if you both pick the same side, player 2's robe flips. Looks never change the fight (every sword has the same reach). Endless bots wear random looks.

## What to try

- **Guard:** block a light, then a heavy (a heavy chips a sliver of strip through a block).
- **Parry into riposte:** keep the wrong guard, flick the mouse to the right height just before their slash lands ("Parry"), then click at once: your slash is a riposte (fast, heavy damage, can't be parried).
- **Feint bait:** start a heavy (right click) and cancel it with a left click. Does your rival swing into it?
- **Counter cut:** hit someone while their heavy winds up, or right after they miss: instant K.O. The round banner says which it was.
- **Jump a low slash.** Then try a jump-in slash against someone guarding high: after it's blocked you're stuck for a moment on landing, and they can cut you.
- **A full match:** best of 5 (first to 3), the page turns between rounds, the winner stands on the back cover.
- **Custom room:** try best of 1 with 50 health (deadly), or endless rounds with no timer. The status line in the corner shows the room's rules.
- **Tournament:** with 3+ people (or several browser windows), run a bracket to the end. Does watching feel smooth? Does everyone land back on the bracket after each fight, and does everyone see the same champion?
- **The cut-out fighters (2026-11-02):** watch a heavy's wind-up: can you read high from low as quickly as before? Turn around (jump over the dummy): the cards flip. Land a few hits: red slashes cut through the paper. K.O. the dummy: the halves should fly, bounce off the pop-ups and lie flat on the page.
- **Heavy rework (2026-11-02):**
  - Throw a heavy at a guarding Sumi: it should step in, say "Stagger", and knock Sumi's blade up. Click a light right after at the other height: it should land before Sumi can do anything. Does a heavy now feel worth throwing?
  - Have a friend (or Endless bots) try to counter-cut your heavy: it should take a read, not just fast fingers. Too safe now, or still too risky?
  - Miss a heavy on purpose: the rival can still punish it, but only a quick punish is an instant K.O.; a late one is a normal cut.
- **Hitboxes (2026-11-02):** press **H** in a fight to show them. Green boxes are bodies (red while open to a counter cut, gold while stunned or staggered); the blue line is a slash's reach, faint while it winds up. Does every hit you see land, and every miss look like a miss? Note anything that looks off (which move, high or low, how far apart). Air slashes now sail over a standing head at the top of a jump: swing on the way down.
- **Spacing:** fighters start further apart and walk and dash further, so the spacing should feel as before with honest swords. Too roomy or too cramped?
- **Endless:** how far do you get? The cut bots' halves pile up on the page (the last 5 stay). From level 2 (bot 6) the bots block heavies they see coming, punish your misses and swat jumpers.

## Match stats

https://papercut.marz.gg/stats shows the numbers from every finished online match and Endless run (on your PC: http://localhost:5173/stats, kept until the server restarts). Pick a build, the rules and a guard style at the top. Useful questions for tuning:

- **How rounds end:** if counter cuts end most rounds, heavies are too risky; if time ends many, fights are too passive.
- **What each slash does:** how often heavies land, get blocked, parried or feinted, and how often a blocked heavy's stagger is followed by a cut.
- **Kami vs Sumi:** should stay near 50%. If not, one side has an edge.
- **Flick vs Cursor vs controller:** how often each guard style wins against players using a different one.

## What to report

## Tuning the fight (T in Practice)

1. In Practice, press **T**. A yellow legal-pad sheet opens on the right, the fight pauses and the mouse is freed.
2. Drag any slider. The new number shows in red, with the game's own number in a small box next to it: click that box to put one number back. **Reset all** puts every number back.
3. Press **T** (or Esc, or Close) to fight with the new numbers. **R** restarts the match, even with the panel open.
4. Your numbers stay in this browser for Practice, so they're still there next time. The bottom-left line says "(tuned numbers)" while any are changed.
5. When you like a set, click **Copy numbers** and paste it to Claude: it lists each changed number as "game value -> your value", and Claude makes them the game's numbers in a PR.

Online fights, tournament fights and Endless always use the game's own numbers, whatever the panel says. Frames are 1/60 of a second.

- **Feel:** do the slashes, blocks and parries feel crisp? Is anything too fast or too slow to react to?
- **Reading:** can you tell the rival's guard height and when a heavy is coming?
- **Flick vs Cursor guard:** play a few rounds with each (Settings → Guard on the main menu). Is Flick snappy? Does the guard ever switch when you didn't mean it (while clicking or walking), or not switch when you flicked? If it's close, try the Flick sliders in the tuning panel (T in Practice) and tell me the numbers. Keep Flick, or go back to Cursor?
- **Online:** the bottom-left line shows the room and the input delay in frames (2 is great, 8 is the most). Did it feel laggy? Did you ever see "Waiting for your rival's connection" or "Out of sync"? If "Out of sync" shows up, note the frame number and tell Claude.

## Known limits of this build

- Online fights wait for the slower player: if either player's tab is hidden or their connection hiccups, the fight pauses for both.
- The fight numbers are still being tuned: use the tuning panel (T in Practice) and send Claude the numbers you like.
- The K.O. halves use paper physics once it has loaded (a couple of seconds after the page opens); a K.O. before that uses a simpler scripted fall.
