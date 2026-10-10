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
| `feira.mp3` | Feira Livre while it is open (06:00-13:00): "Baião da Feira", the theme's forró cousin in A mixolydian (sanfona, pife, zabumba, triângulo); it opens with the hook in one baião bar and its bridge is the theme's own A section changes |
| `voo.mp3` | The flight in (the new-account cutscene, night cabin to the seatbelt sign): "Céu de Madrugada", a slow toada at 76 BPM (flute, felt-piano ripples, strings, star bells, no drums) that quotes the hook once, then sings its own tune over the theme's A changes and its bridge, under the engines' hum |
| `praca-golden.mp3`, `praca-night.mp3` | Two of the phrases that drift over the Praça (golden hour, night) |
| (shared bed) | The Praia and the party deck play the outdoor Praça bed for now (`ambience.ts` `target()`), with the synthesized `waves` zone (pink noise through a slow lowpass LFO, loud along the shore and at the pier end) and `gulls` zone (short filtered chirps on the costão by day) mixed up so the beach sounds like itself. A beach bed of its own ("Maré Mansa") and a festa arrangement for the deck are later work (PRAIA-PLAN.md §11), through `COMPOSING.md` |
| `sting-*.mp3` | Recado done, daily mission, bout win, bout loss, `sting-pouso` (the plane touching down in Brazil: the whole hook on flute and vibes at 96 BPM, a strummed Dmaj9 and a surdo on the landing) |
| `sting-diario` (no MP3 yet) | The journal reveal in the arrivals hall (a new player's first word): the hook's five pitches as a slow music box at 92 BPM over Dmaj9 → Gmaj9 → Dmaj9, answered by A F♯ E falling home to D. The arrivals hall (`desembarque`) itself plays the kitnet's quiet bed |

## Levels

All loudness lives in `apps/client/src/audio/mix.ts` as targets (integrated LUFS, as the player hears it):

| | LUFS |
| --- | --- |
| Intro | -22.5 |
| The flight in (cutscene, under Lia's voice) | -26 |
| Bout | -25.5 |
| Radio (before the window and the distance) | -27 |
| Padaria / Feira / Academia / Padaria at night / Kitnet | -28.5 / -29 / -29.5 / -30 / -30.5 |
| Praça phrases | -30.5 to -32 |
| Stingers | -23.5 (mission, win) to -31 (RV, door); the journal reveal -26; the touchdown -24 |

`calibration.json` holds what each one measures at unity gain, so the gain is target minus measurement.

## Making a new piece

The whole process (the musical rules every piece follows, and the steps from a brief to the game) is in
[COMPOSING.md](COMPOSING.md).

## The lab

```bash
node scripts/audio-lab.mjs calibrate      # after changing any arrangement, instrument or stinger: re-measure → calibration.json
node scripts/audio-lab.mjs levels         # what the player hears: every bed, Praça phrase and stinger, through the master
node scripts/audio-lab.mjs stems intro    # the balance inside one arrangement, voice by voice
node scripts/audio-lab.mjs sfx            # the bout's sound effects, to sit them against the bout music
node scripts/audio-lab.mjs mp3            # these listening copies (needs ffmpeg)
node scripts/audio-lab.mjs mp3 docs/audio feira   # just one of them
```

It renders offline in headless Chromium (Vite serves `apps/client/tools/audio-lab.html`), so the numbers are the game's own.
