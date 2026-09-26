# Report / Mute / Kick — Phase 0 Ops Policy

GDD §12.6. Stub expectations for Phase 0. Real human queue comes later.

## Player report

- **Surfaces:** chat bubbles, player profiles (and later: NPC abuse reports if players can flag bad generation).
- **Reasons (minimum set):** harassment, slur/hate, sexual, PII / off-platform, scam / RMT, alcohol / prohibited, dating / flirting, other.
- **Flow:** report → message/profile snapshot frozen → `escalate` flag on stub queue (log + DB row). Do **not** auto-ban on single report in Phase 0.

## Automation vs human

| Path | Phase 0 behavior |
|------|------------------|
| Client regex PII hit | auto **block** send |
| Slur / hard profanity blocklist | auto **block** send |
| Stub Jev `block` | auto **block** send |
| Stub Jev `escalate` | allow or soft-hide per toxicity; always enqueue |
| Player report | always enqueue; no auto-permaban |

## Moderator actions (schema ready; UI may be stub)

1. **Mute** — user cannot send public chat for N minutes (default 10 / 60 / 1440).
2. **Kick instance** — remove from current shard/instance; can rejoin.
3. **Temp ban** — account cannot enter world for duration (e.g. 1d / 7d / 30d).
4. **Permaban** — permanent; requires human confirmation (not stub-auto).

Mute/kick may be applied by trusted ops tools when wired; Phase 0 stub can no-op the effect but **must** record the intended action + reason for metrics.

## Escalation queue (stub)

- Fields: `report_id`, `reporter_id`, `target_id`, `surface`, `reason`, `snapshot_text`, `jev_labels`, `toxicity`, `created_at`, `status=pending`.
- Later: human review UI, SLA, appeal. Phase 0: write-only log acceptable if documented.

## Transparency

- Blocked senders get a short, non-lecturing toast (EN+PT): e.g. “Essa mensagem não pode ser enviada. / That message can’t be sent.”
- Do not reveal exact blocklist terms in client UI (evasion aid).

## Metrics KPI

- False-block rate on `allowlist-pt-slang.json`
- PII catch rate on `pii/regex-fixtures.json` examples
- Report → action latency (informational until humans online)
