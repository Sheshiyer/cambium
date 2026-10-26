# Connected profile contract

`get_connected_profile` is the single OpenAI profile tool for this plugin. It
exists only when Cortex MCP is in complete OAuth mode and a separate
`MCP_PROFILE_ID_KEY` secret is present with 32–512 non-whitespace bytes.

## Discovery

The tool is OAuth-protected and read-only. Its input is an empty, closed object.
Its output follows OpenAI's standard connected-profile shape:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "id": { "type": "string", "pattern": "^prf_[a-f0-9]{64}$" },
    "name": { "type": "string" },
    "email": { "type": "string" },
    "nickname": { "type": "string" }
  },
  "required": ["id"]
}
```

Discovery marks `_meta["openai/profile"]` as `true`. All four MCP annotations
are explicit: read-only and idempotent are true; destructive and open-world are
false. When the profile key is absent or malformed, the tool is not advertised.

## Identity derivation

Cortex accepts no profile identity argument. Middleware first verifies the
OAuth access token, issuer, audience, expiry, scopes, client, and claims. The
tool then derives its ID as:

`prf_` + lowercase hex HMAC-SHA-256(`exact_verified_issuer + NUL + exact_subject`)

The HMAC key is `MCP_PROFILE_ID_KEY`. The issuer must be an HTTPS URL without
credentials, query, or fragment. The subject must be present, bounded, and free
of control characters. A missing or malformed verified identity returns only
`verified_profile_identity_required`; it never invents an identity.

The same verified issuer and subject produce the same ID across token refreshes
while the configured key is unchanged. A different issuer or subject produces a
different ID. Key rotation intentionally changes every derived ID and therefore
requires a separately reviewed connection-migration plan.

## Privacy and authority

The result contains only `id`. It never returns the raw subject, email, token,
tenant list, session identifier, credential, key, or machine-local path. The
tool does not call Workers AI, Vectorize, R2, the provenance reader, Cambium
Gate, D1, Hermes, or any provider binding.

Profile recognition grants no tenant, scope, founder, approval, execution,
writer, or canonical-completion authority. Every subsequent read or action is
re-authorized independently against its own verified claims and contract.

Source presence is not live configuration proof. Installing the key, deploying
the runtime, connecting the plugin, and verifying the exact deployed version
remain separate owner-approved gates.
