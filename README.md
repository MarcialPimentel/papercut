# Papercut

A 3D sword-fighting game in folded paper. Two papercraft samurai duel on a pop-up notebook; every hit cuts the paper, and one greedy swing can end the round.

**Play:** https://papercut.marz.gg · **Status:** first online build: practice against a dummy, or fight a friend online by invite link or quick match.

- Design: [docs/GDD.md](docs/GDD.md) · Art: [docs/art-direction.md](docs/art-direction.md) · Blender: [docs/blender-pipeline.md](docs/blender-pipeline.md) · Plan: [docs/roadmap.md](docs/roadmap.md)
- Playtest: [docs/playtest.md](docs/playtest.md) · Hosting: [docs/deploy.md](docs/deploy.md)

## Develop

```bash
npm install
npm run dev        # game on http://localhost:5173, rooms server on 8790
npm test           # fight rules, rooms and online sync
npm run build      # the game into dist/
npm start          # serve dist/ and the rooms on port 8790
npm run desktop    # the desktop app (Electron); see docs/desktop.md
npm run build:desktop  # Windows zip + Linux tar.gz into release/
```

TypeScript, Vite, Three.js; a small Node server (`server/`) for rooms. The fight itself is in `src/sim/` (plain, tested, the same on every computer); drawing is in `src/render/`.
