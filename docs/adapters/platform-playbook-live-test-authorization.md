# Platform-playbook live-test authorization boundary

**Status:** authorization template only
**Authority:** Cambium validates readiness-chain inputs. Channel adapters perform any future transport under their own scoped authorization.

## Boundary

A Stage 3 or Stage 4 readiness receipt makes a later external test reviewable. It does not authorize that request. A live test requires a new one-test authorization record bound to one exact channel, account, destination, message digest, readiness receipt digest, policy review, managed credential presence check, operator, expiry, and containment path.

The authorization expires within 30 minutes and covers one request only. It cannot be reused for retries, another recipient, another platform, a different message, a scheduled send, paid activity, account changes, template creation, or a rollout.

## Receipt distinction

| Receipt | What it proves |
| --- | --- |
| Stage 3 readiness | A local Telegram proposal, approval binding, and exact route are internally coherent. |
| Stage 4 messaging consent | Local consent and policy inputs are internally coherent. |
| One-test authorization | A human has approved one exact external attempt. |
| Transport receipt | The provider accepted or rejected that one request. |
| Outcome evidence | A separately sourced post-send observation. |

Current adapter work remains dry-run only. It creates no authorization record, transport request, account connection, recipient record, provider request, or scheduled job.
