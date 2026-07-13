# Telegram ActionRequest lifecycle

Status: active
Owner: Cambium ActionRequest state machine
Runtime source: `workers/quests/src/action-requests.ts`

## Boundary

A Telegram channel or forum topic is a signal and receipt surface. The Mini App
is a separate WebView launched by the bot, bot menu, or an approved Mini App
link. A channel message can identify where an ActionRequest came from; it does
not contain the Mini App and does not grant signed authority.

`topic.sourceMessageId` is source provenance. It is not an instruction to launch
the Mini App from that message, and it is not automatically the message that a
later receipt will edit. Hermes issue
[`#88`](https://github.com/Sheshiyer/hermes-aws-ts/issues/88) owns the future
separation of source-signal provenance from ActionRequest-card identity.

## Discover current state

Read the current public ActionRequest projection or the authenticated operator
queue before giving instructions:

```bash
curl --fail --silent "$CAMBIUM_PUBLIC_BASE_URL/api/quests/cambium"

curl --fail --silent \
  -H "Authorization: Bearer $QUESTS_PUSH_TOKEN" \
  "$CAMBIUM_PUBLIC_BASE_URL/internal/gate/cambium"
```

Never paste tokens, raw Telegram `initData`, founder identifiers, or private
chat identifiers into an issue, plan, screenshot caption, or proof artifact.

## State transitions

| Current state | Visible authority | Valid next action |
| --- | --- | --- |
| `proposed` | Telegram topic choice | Choose one served option; no execution occurs |
| `awaiting_input` | Telegram topic reply | Supply the requested bounded input |
| `needs_signed_confirmation` | Mini App Gate | Open the Mini App independently, locate the matching ActionRequest id and selected option, review consequence/reversibility, then confirm once |
| `queued` | Authenticated operator queue | Do not confirm again; consume the durable ActionRequest id or supersede it |
| `blocked` | Evidence or safer option | Add the missing proof or choose a safer option |
| `consumed` | Stored consumption receipt | Verify downstream work separately; Cambium consumption itself performs no external mutation |
| `completed` | Story/Inspect receipt | Preserve the receipt as evidence; no further action is implied |
| `superseded` | Newer ActionRequest | Follow only the current request |

The operator consumer accepts `kind: "action-request"` and the durable request
`id`. Repeating a successful consume returns the stored result without adding a
second receipt. Optional Telegram provenance is never the idempotency key.

## Proof boundary

Browser captures prove layout and hit-tested interaction only. Live readiness
requires fresh Telegram WebView evidence and valid signed input. Missing live
evidence remains a blocked proof item; it does not invalidate deterministic
code release, and deterministic release does not claim founder-device proof.
