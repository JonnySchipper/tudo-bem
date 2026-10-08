# Decisions

## 2026-10-08 — Jev model layer: a small in-process toxicity classifier, not an LLM judge

**Ask (Jonny):** a quick, dedicated "Jev-type" chat-safety model on the server, not Grok or another big general model as the judge.

**Chosen:** [Horizon-Labs/multilingual-toxicity-small](https://huggingface.co/Horizon-Labs/multilingual-toxicity-small), pinned at revision `3baf773`.

| | |
|---|---|
| License | Apache-2.0 (commercial use OK) |
| Size | mmBERT-small, 141M params; ONNX with int8 embeddings, 268 MB on disk, 34 MB tokenizer |
| Languages | 34 incl. Portuguese and English (trained on Civil Comments + translations) |
| Labels | Detoxify set: toxicity, severe_toxicity, obscene, threat, insult, identity_attack, sexual_explicit |
| Context | 8k-token encoder; we feed the sender's last ≤3 room lines + the new one as one block |
| Speed | box (1 thread): p50 28 ms, p95 38 ms per cold check over 200 lines; well under the 300 ms budget |
| Memory | server RSS ~430 MB steady with the model, ~630 MB peak while loading (external-weights ONNX halves ORT's copy) |
| Runtime | `onnxruntime-node` (native, glibc) + `@huggingface/tokenizers` (pure JS). No Python at runtime, no network calls |

**Rejected:**
- *Grok / any hosted LLM judge*: ruled out by Jonny; also adds network latency, cost per message and an outage path.
- *OpenAI omni-moderation*: free and multilingual, but external (every chat line leaves the box), needs an OpenAI account, and has no conversation context.
- *Llama Guard 3 1B / ShieldGemma 2B*: context-aware, but ~1–3 s per check on a shared CPU and 2–5 GB RAM. Too slow and too big for the Fly machine.
- *gravitee/onnx-community distilbert-multilingual-toxicity* (OpenRAIL++, 136 MB): no Portuguese in training; on our fixtures it scored plain PT orders ("um guaraná e um suco, por favor") as 0.99 toxic.
- *unitary/multilingual-toxic-xlm-roberta* (Apache-2.0, 279 MB quantized): includes pt but one label only and weaker (TextDetox AUC 0.68 vs 0.84); no threat/insult split.
- *textdetox xlmr-large* (OpenRAIL++, 560M): best TextDetox scores but 2× the size and no Portuguese in its training set.
- *Further int8 quantization of the matmuls* (142 MB): broke scores on short texts ("fala" → 0.998). Kept the authors' validated int8-embedding export.

**Shape:** stub first (PII → overlays → blocklists, now with de-obfuscation; also the client's instant feedback), then the model on whatever the stub allows or warns, server-side only. The model can only make a verdict stricter. Chat is never rewritten. On load failure, error or a 400 ms timeout the stub verdict stands and the fallback is logged; for an under-13 sender (design-only, Phase 0 is 18+) an unconfirmed warn is held for review instead.

**Thresholds** (`JEV_THRESHOLDS`, apps/server/src/services/jevModel.ts): the model scores friendly banter ("você é fera", "you're a beast", "vou acabar com você no jiu-jitsu") and PT idioms ("quero matar essa saudade" → toxicity 0.88, threat 0.92) high, so:
- addressed to someone (você / seu / you …) + an insult cue word (lixo, nojo, vergonha, worthless …): block ≥ 0.70, warn ≥ 0.60
- addressed to someone: block ≥ 0.88, warn ≥ 0.77
- not addressed: block ≥ 0.95, warn ≥ 0.90
- threat: escalate ≥ 0.88 when addressed, ≥ 0.97 otherwise
- context block (own recent lines + this one): judged with the same rules, only if it scores ≥ 0.30 above the earlier lines alone

Tuned so every v0.1 fixture keeps its action, the PT-slang false-block KPI stays 0%, and `content/safety/phase0/jev/model-pack.json` (catches + banter guards) passes, all checked in CI with the real model.

**Fly:** `shared-cpu-1x` 256 MB → 1 GB (`fly.toml`). +$4.51/month if always on ($2.19 → $6.70, iad); less with auto-stop.

**Known gaps:** contextless social harassment the model scores low ("everyone hates you, just leave", "I know where you live"); context from *other* players isn't read; scores for PT are calibrated on translated English data. Next step: fine-tune on reviewed `moderation.jsonl` rows.
