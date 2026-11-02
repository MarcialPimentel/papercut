# Papercut — Playtest guide

_For the first online build (2026-11-01)._

## Open the game

- **Live:** https://papercut.marz.gg. The build number is in the bottom-right corner.
- **On your PC:** `npm install`, then `npm run dev`, then open http://localhost:5173.

Use a desktop browser with a mouse. Phones get on-screen buttons, but the game is made for the mouse.

## Controls

| Action | Input |
|---|---|
| Guard high / low | Cursor above / below your fighter's waist |
| Light slash | Left click |
| Heavy slash | Right click |
| Feint (during a heavy's wind-up) | Left click or Q |
| Walk | A / D |
| Dash / backdash | Double-tap D / A |
| Jump | Space or W |
| Rematch (when the match ends) | R or the Rematch button |
| Free the mouse / back to the menu | Esc frees the mouse (held during a fight), Esc again or Leave for the menu |

## Ways to play

1. **Practice vs Sumi:** Sumi is a dummy. Watch for the yellow glint on the blade: Sumi is about to switch guard. R restarts.
2. **Endless:** one bot after another, one round each, on one page (no page turns): each new bot steps in on your left or right. Your strip carries over and refills by half every 5 bots, and the bots get smarter every 5. One lost round ends the run; your best run shows on the title screen.
3. **Fight a friend:** first pick the room's rules (rounds, health, timer), then you get a link and a 4-letter room code. Send the link; the fight starts as soon as they open it. You are Kami (left, indigo sash), they are Sumi (right, gold sash). Your name has a yellow "you" tag.
4. **Tournament:** 3 to 8 friends. Pick the rules, type your name, send the link; the host presses *Start tournament*. One fight at a time, everyone else watches it live; the bracket shows between fights.
5. **Find a fight:** pairs you with the next person who presses it (standard rules: best of 5, 80 health, 60 seconds).

## What to try

- **Guard:** block a light, then a heavy (a heavy chips a sliver of strip through a block).
- **Parry into riposte:** keep the wrong guard, flick the cursor to the right height just before their slash lands ("Parry"), then click at once: your slash is a riposte (fast, heavy damage, can't be parried).
- **Feint bait:** start a heavy (right click) and cancel it with a left click. Does your rival swing into it?
- **Counter cut:** hit someone while their heavy winds up, or right after they miss: instant K.O. The round banner says which it was.
- **Jump a low slash.** Then try a jump-in slash against someone guarding high: after it's blocked you're stuck for a moment on landing, and they can cut you.
- **A full match:** best of 5 (first to 3), the page turns between rounds, the winner stands on the back cover.
- **Custom room:** try best of 1 with 50 health (deadly), or endless rounds with no timer. The status line in the corner shows the room's rules.
- **Tournament:** with 3+ people (or several browser windows), run a bracket to the end. Does watching feel smooth? Does everyone land back on the bracket after each fight, and does everyone see the same champion?
- **Endless:** how far do you get? From level 2 (bot 6) the bots block heavies they see coming, punish your misses and swat jumpers.

## What to report

- **Feel:** do the slashes, blocks and parries feel crisp? Is anything too fast or too slow to react to?
- **Reading:** can you tell the rival's guard height and when a heavy is coming?
- **Cursor guard:** precise or twitchy? Does the guard ever switch when you didn't mean it?
- **Online:** the bottom-left line shows the room and the input delay in frames (2 is great, 8 is the most). Did it feel laggy? Did you ever see "Waiting for your rival's connection" or "Out of sync"? If "Out of sync" shows up, note the frame number and tell Claude.

## Known limits of this build

- Online fights wait for the slower player: if either player's tab is hidden or their connection hiccups, the fight pauses for both.
- The fight numbers are the mock-up's placeholders; the tuning panel comes next.
- The K.O. halves tumble on a script; real physics comes with the hit-feel work.
