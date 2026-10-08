# Making music for Tudo Bem

How a new piece goes from an idea to the game. Every piece so far (the intro, the padaria, the kitnet, the academia and bout, the
Praça phrases, the stingers, the feira) was made this way. Follow it in order; each step has a check.

The short version: **one theme, many dresses.** Nothing is a sample or an audio file. Every note is data in
`apps/client/src/audio/theme.ts`, played live by the synth band in `synth.ts`, and every place sounds like a relative of "Tudo Bem".

## 1. Where things live

| File | What it holds |
| --- | --- |
| `apps/client/src/audio/theme.ts` | The score, as pure data: chords, melodies, every arrangement (`scoreBar`), the Praça phrases, the stingers |
| `apps/client/src/audio/synth.ts` | The band: instruments (`Inst`), drums (`Drum`), which instrument plays each voice (`VOICE_INST`), the base balance (`VOICE_DB`) |
| `apps/client/src/audio/sequencer.ts` | The feel of each arrangement (`FEELS`: swing, timing, lay-back), per-arrangement balance (`MIX`) and instrument swaps (`SWAPS`) |
| `apps/client/src/audio/mix.ts` | Loudness targets per place (`TARGET_LUFS`) |
| `apps/client/src/audio/calibration.json` | What each piece measures at unity gain. Written by the lab, never by hand |
| `apps/client/src/ambience.ts` | Which bed plays where and when (`target()`), and what else is in the room (murmur, wind, zones) |
| `apps/client/src/audio/theme.test.ts` | The rules below, as tests |
| `scripts/audio-lab.mjs` | Offline renders: loudness, stems, calibration, MP3 listening copies |
| `docs/audio/` | The listening copies and this document |

## 2. The musical rules

The theme: 32 bars, A · A' · B · A'', 112 BPM, D major. The hook is the first two bars: **E F♯ · C♯ D E** (scale degrees 2 3 7 1 2,
`MOTIF` / `MOTIF_DEGREES`). The A section changes are Dmaj9 · Bm9 · Em9 · A13 · F♯m7 · Bm9 · Gmaj9 · A13.

1. **Every piece is related to the theme.** A listener who knows the intro should recognize the family within a few bars.
2. **Keep two or three identity markers, change the rest.** The markers to choose from:
   - the hook (its pitches, its contour 2 3 7 1 2, or its rhythm: a pickup into a long note);
   - the harmony (the A section changes, or the bridge's IV and borrowed Gm6);
   - the seven notes of D major (another mode on them, like A mixolydian, keeps the colour while moving home);
   - an instrument or texture that already belongs to a place (the accordion of the padaria, the vibes, the music box).
   The things to change: groove and genre, tempo, home note, instruments, and the melody after the first quote.
3. **Quote, then answer.** A piece may state the hook (or a transformation of it) once near the top. After that it should say
   something new: sequence it a step down, invert it, answer it with a phrase the theme never plays. A bar lifted whole from
   the theme's melody (other than the deliberate opening quote) is a sign the piece is becoming a cover.
4. **Stay in the key set.** Melodies and chords use D major's notes (pitch classes 2 4 6 7 9 11 1), plus the Gm6's B♭ in the
   bridge. An arrangement in another key says so with `transpose` / `melShift`, and the in-key test checks it with that shift.
   Stingers play in the key of the bed under them (`Ambience.sting`), so a bed outside D major needs a `transpose`.
5. **Fit the place.** Brazilian styles that belong to the location: bossa for the intro, choro at the padaria, samba and batucada
   at the academia, baião/forró at the feira. A bed sits under speech and the world: sparse enough that a voice line is clear.
6. **Loops end where they start.** The last bar of a loop leads back into bar 0 (a pickup, a cadence on the home chord).
   Phrases that are played once end on the tonic.
7. **Ranges.** Bass at or below MIDI 62. Theme melody at or below 83 (a high lead can be played an octave up by the arrangement).

## 3. Step by step: a new bed

Using the feira as the worked example (`kind: 'feira'`, "Baião da Feira").

1. **Write the brief, in a comment, before any notes.** What it keeps from the theme, what it changes, who plays, where and when
   it is heard. The feira's: *keeps the hook's five pitches as the opening bar, the D major note set, and the theme's A changes as
   its bridge; changes the groove to baião, home to A (mixolydian), the band to sanfona, pife, zabumba and triângulo.*
2. **Name it.** Add the kind to `ArrangementKind` and an entry in `ARRANGEMENTS` (bpm, transpose, melShift, loopBars).
3. **Write the harmony and the melody** in `theme.ts` as `Chord[]` and `Phrase[]` (one phrase per bar, `[step, midi, dur]`,
   16 steps a bar). Comment the musical intent of each phrase the way the theme does.
4. **Write the arrangement**: a branch in `scoreBar` (or a helper like `feiraBar`) that returns the notes of one bar. Change
   the band by section so the loop develops (who has the tune, what joins in the bridge, a fuller last section).
5. **New sounds, if needed.** A new voice goes in the `Voice` union (and `PERCUSSION` if it is a drum), `VOICE_INST` or
   `playDrum`, `VOICE_DB`, and `VOICE_ID` in the sequencer. A new instrument is a function in `synth.ts` plus a case in
   `playInst`. Reuse first: an arrangement can swap any voice's instrument in `SWAPS`.
6. **The feel**: an entry in `FEELS` (bossa and samba swing about 0.12-0.16; forró sits straighter, about 0.06).
7. **Tests** in `theme.test.ts`: the existing ones run every arrangement through the key, bar and loop checks automatically.
   Add the piece to "plays the hook everywhere the theme is the bed" if it quotes the hook, and a test of its own brief
   (the feira's checks the quote, the borrowed bridge, the home note, and that no bar of melody is copied from the theme).
   `npx vitest run apps/client/src/audio`
8. **Balance the band** with stems: `node scripts/audio-lab.mjs stems feira`. Aim for the tune on top (about -24 to -25 LUFS
   per lead stem), bass about 3 dB under it, chords and comping 8-10 dB under, percussion as texture (-30 to -40). Adjust with
   `MIX[kind]` trims (at most ±8 dB, the mix test checks) or, if an instrument is new, its base level in `playInst`.
9. **Set the level of the place**: a target in `TARGET_LUFS.bed` (rooms -28.5 to -30.5, the intro -22.5 stays the loudest),
   add the kind to `BEDS` in `scripts/audio-lab.mjs`, then measure:
   `node scripts/audio-lab.mjs calibrate` (rewrites `calibration.json`; the other entries should not move)
   `node scripts/audio-lab.mjs levels` (the new bed should print its target).
10. **Wire it into the world** in `ambience.ts`: `target()` decides which bed plays (the feira's only while it is open,
    06:00-13:00, and the Praça's outdoor bed otherwise); `buildBed` builds the room around the band (murmur, wind, outdoor
    zones); `setWorld` re-checks the target when the clock can change it.
11. **Listen.** Add it to the `mp3` list in the lab and render it: `node scripts/audio-lab.mjs mp3 docs/audio feira`. Listen to it
    next to `theme-intro.mp3`: does it sound like family? Does it sound like a different song? Then in the game (`pnpm dev`),
    at the place, with a voice line playing over it.
12. **Document it**: a row in the table in `docs/audio/README.md` and in the levels table, and a line in the header comments of
    `theme.ts` and `ambience.ts`.
13. **Check and commit**: `pnpm typecheck && pnpm test`. Commit the code, `calibration.json` and the MP3 together.

## 4. Other kinds of piece

- **A Praça phrase**: add a `PhraseId` range in `PHRASES` (bars of the form) and list it in `MOOD_PHRASES` (conductor). A new
  mood is a `MoodDef` in `MOODS`, a target in `TARGET_LUFS.phrase`, and a calibrate run.
- **A stinger**: a case in `stingNotes` (under 6 seconds, in D major, made of the hook or the home chord), a `StingKind`, a target
  in `TARGET_LUFS.sting` (a little above the bed it interrupts), `STINGS` in the lab, calibrate.
- **A new version of an existing bed**: same steps 3-13 without the naming; re-run `stems` and `calibrate` after any change.

## 5. Running the lab

It needs Chromium (pre-installed in the cloud sessions at `/opt/pw-browsers/chromium`, or set `CHROMIUM`) and, for MP3s,
ffmpeg. Everything renders offline through the same code the game runs, so the numbers are the game's own. A full `levels` or
`calibrate` run takes a few minutes.
