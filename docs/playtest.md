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

## Three ways to play

1. **Practice vs Sumi:** Sumi is a dummy. Watch for the yellow glint on the blade: Sumi is about to switch guard. R restarts.
2. **Fight a friend:** you get a link and a 4-letter room code. Send the link; the fight starts as soon as they open it. You are Kami (left, indigo sash), they are Sumi (right, gold sash). Your name has a yellow "you" tag.
3. **Find a fight:** pairs you with the next person who presses it.

## What to try

- **Guard:** block a light, then a heavy (a heavy chips a sliver of strip through a block).
- **Parry into riposte:** keep the wrong guard, flick the cursor to the right height just before their slash lands ("Parry"), then click at once: your slash is a riposte (fast, heavy damage, can't be parried).
- **Feint bait:** start a heavy (right click) and cancel it with a left click. Does your rival swing into it?
- **Counter cut:** hit someone while their heavy winds up, or right after they miss: instant K.O. The round banner says which it was.
- **Jump a low slash.** Then try a jump-in slash against someone guarding high: after it's blocked you're stuck for a moment on landing, and they can cut you.
- **A full match:** best of 5 (first to 3), the page turns between rounds, the winner stands on the back cover.

## What to report

- **Feel:** do the slashes, blocks and parries feel crisp? Is anything too fast or too slow to react to?
- **Reading:** can you tell the rival's guard height and when a heavy is coming?
- **Cursor guard:** precise or twitchy? Does the guard ever switch when you didn't mean it?
- **Online:** the bottom-left line shows the room and the input delay in frames (2 is great, 8 is the most). Did it feel laggy? Did you ever see "Waiting for your rival's connection" or "Out of sync"? If "Out of sync" shows up, note the frame number and tell Claude.

## Known limits of this build

- Online fights wait for the slower player: if either player's tab is hidden or their connection hiccups, the fight pauses for both.
- The fight numbers are the mock-up's placeholders; the tuning panel comes next.
- The K.O. halves tumble on a script; real physics comes with the hit-feel work.
