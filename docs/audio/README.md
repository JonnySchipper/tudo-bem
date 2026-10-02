# Tudo Bem: the music

Listening copies, rendered offline from the same score and synth the game plays live (`apps/client/src/audio/`). Nothing here is a
sample: the game generates all of it in Web Audio. Each file is normalized for listening on its own (about -16 LUFS); in the game
every place has its own level (see below).

| File | Where it plays |
| --- | --- |
| `theme-intro.mp3` | Title screen and sign-in: the whole 32-bar theme (A, A', B, A''), 112 BPM, in D |
| `padaria-day.mp3` | Padaria by day: the theme as a choro in G (cavaquinho, accordion, clarinet, pandeiro; vibes in the bridge) |
| `padaria-night.mp3` | Padaria after 22:00 (Dona Graça): vibes and a felt pad |
| `kitnet.mp3` | Your kitnet: a music box plays the first eight bars, then the room breathes |
| `academia.mp3` | Academia: a soft samba pulse, the hook on vibes |
| `bout.mp3` | Treino no tatame: batucada and brass on the hook |
| `praca-golden.mp3`, `praca-night.mp3` | Two of the phrases that drift over the Praça (golden hour, night) |
| `sting-*.mp3` | Recado done, daily mission, bout win, bout loss |

## Levels

All loudness lives in `apps/client/src/audio/mix.ts` as targets (integrated LUFS, as the player hears it):

| | LUFS |
| --- | --- |
| Intro | -22.5 |
| Bout | -25.5 |
| Radio (before the window and the distance) | -27 |
| Padaria / Academia / Padaria at night / Kitnet | -28.5 / -29.5 / -30 / -30.5 |
| Praça phrases | -30.5 to -32 |
| Stingers | -23.5 (mission, win) to -31 (RV, door) |

`calibration.json` holds what each one measures at unity gain, so the gain is target minus measurement.

## The lab

```bash
node scripts/audio-lab.mjs calibrate      # after changing any arrangement, instrument or stinger: re-measure → calibration.json
node scripts/audio-lab.mjs levels         # what the player hears: every bed, Praça phrase and stinger, through the master
node scripts/audio-lab.mjs stems intro    # the balance inside one arrangement, voice by voice
node scripts/audio-lab.mjs sfx            # the bout's sound effects, to sit them against the bout music
node scripts/audio-lab.mjs mp3            # these listening copies (needs ffmpeg)
```

It renders offline in headless Chromium (Vite serves `apps/client/tools/audio-lab.html`), so the numbers are the game's own.
