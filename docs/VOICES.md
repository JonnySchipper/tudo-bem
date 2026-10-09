# Voices: how spoken dialogue gets a real voice

Everything the game says aloud plays a **prebaked neural clip** (free Microsoft Edge pt-BR voices, no paid TTS). The browser's built-in
speech synthesis (the robot) is only the last-resort fallback for text that cannot be known ahead of time.

## When you code new dialogue

1. Write it where the game already keeps dialogue: `npcTalk.ts` (greetings), `feira.ts` (vendors, prices), `juliaTalk.ts`, `hotspots.ts`
   (signs), `carlos.ts` / `conversa.ts` (the counter), `challenges.ts` (listening drills), `cards.json`.
2. If a **new NPC** speaks, add them to `content/voices.json` (pick Antonio or Francisca, then a `rate` / `pitch` so they don't sound like
   a twin). Call `speak(text, { speaker: npcId })` wherever the line is spoken.
3. Run **`pnpm tts`**. It finds every spoken line in the game data, bakes only the ones without a clip, and updates
   `apps/client/src/audio/manifest.json`. Commit the new `apps/client/public/audio/tts/*.mp3` with it.

`pnpm test` fails with the exact missing lines if you forget step 3. `pnpm tts:check` lists them without needing the network.

Requirements for `pnpm tts`: `pip install edge-tts` (or `EDGE_TTS=/path/to/edge-tts`) and outbound access to `speech.platform.bing.com`.
Cloud sessions: allow that host in the environment's network settings; the bake passes the session's `HTTPS_PROXY` to edge-tts.

## What is and isn't found automatically

- **Found by walking the data** (`packages/shared/src/spokenLines.ts`): NPC greetings (every hour of day), Júlia's guide, every feira
  greeting / price / total / change line, the whole Seu Carlos / Dona Graça counter scene (all names, orders, hours), Conversa openers and
  offline replies, signs and menus, Caderno words, Me vê um… orders, listening drills.
- **Names are never spoken.** A line with the player's name is baked without it (`spokenNameless`); the name still shows on screen. One
  clip serves every player.
- **Not enumerable** (correria and bout feedback, anything generated at runtime): list them in `content/tts/extra-lines.json`. In a dev
  build, play the feature and run `ttsMissing()` in the console: it prints the lines that fell back to the robot, as JSON to paste there.
  AI-written Conversa turns can't be prebaked; they use the best pt-BR system voice (natural / online voices are preferred).

## Changing how someone sounds

Edit their entry in `content/voices.json` and run `pnpm tts`: a changed `rate` / `pitch` re-bakes that speaker. A changed `voice` needs
`pnpm tts -- --speaker=<id>`; `-- --force` re-bakes everything.
