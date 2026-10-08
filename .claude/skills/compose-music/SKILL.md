---
name: compose-music
description: Make or change music in Tudo Bem (a new room bed, a Praça phrase, a stinger, or a new version of an existing piece). Use whenever the request is to compose, arrange, rebalance or add music or a jingle for a place in the game.
---

# Compose music for Tudo Bem

All music in this game is generated live from a score in `apps/client/src/audio/theme.ts`; there are no audio samples.

1. Read `docs/audio/COMPOSING.md` in full before writing any notes. It holds the musical rules (every piece is a relative of the
   "Tudo Bem" theme: keep two or three identity markers, change the rest) and the numbered steps from a brief to the game.
2. Follow its steps in order, including the lab steps (`node scripts/audio-lab.mjs stems | calibrate | levels | mp3`) — the
   levels and `calibration.json` come from measurement, never by hand.
3. Finish with `pnpm typecheck && pnpm test`, the README rows, and the rendered MP3 in `docs/audio/` committed with the code.
