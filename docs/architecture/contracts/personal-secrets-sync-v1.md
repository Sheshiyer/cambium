# Personal secrets sync — design candidate

Status: design only, 2026-09-30. No deployed service, installed listener,
enrolled device, imported secret, or verified Cloudflare account access.
Requested account alias: `9d9d`; resolve its complete account identity before
creating resources. This service is separate from Cambium operational storage.

## Problem and goal

A machine-local Claude dotenv file combines credential entry and consumption.
Copying it to each machine creates stale credentials and unnecessary exposure.
Keep that familiar entry workflow while giving enrolled machines scoped access
through a centrally versioned encrypted vault.

The owner initially selected both local retrieval and provider proxying, then
confirmed the annotated recommendation to ship local retrieval first and
provider proxying later. Both paths remain architectural requirements; only
local retrieval belongs to the initial release.

## Architecture

An installed local agent parses approved dotenv entries, encrypts values, and
calls an authenticated Cloudflare Worker. A dedicated Durable Object serializes
vault writes and stores ciphertext, versions, device records, and bounded audit
events. Devices decrypt locally and inject selected values into child processes.
Use standard reviewed cryptographic libraries and formats; this document is
not a bespoke cryptographic protocol specification.

Each secret has an opaque identity, namespace, provider/account alias,
environment, version, access policy, and consumption modes. Encrypt descriptive
metadata where feasible. The server necessarily sees routing, device identity,
record sizes, timing, and authorization metadata; ciphertext storage does not
hide all metadata.

Local retrieval and proxy invocation are separate permissions. A credential
may be local-only, proxy-only, or available through both paths. In the initial
release only local retrieval is enabled. A later proxy-enabled credential needs
an explicit server-decryptable key envelope. Consequently it is not confidential
from the authorized proxy runtime. Never claim universal end-to-end encryption
for proxy-enabled secrets.

## Save listener

- Watch the parent directory and handle atomic editor replacement saves.
- Debounce events and parse a stable snapshot as data, never shell code.
- Define a supported dotenv grammar; reject unsupported substitutions and
  malformed entries without echoing source lines or values.
- Reject duplicate names for the affected import; do not silently select one.
- Begin with an explicit name allowlist and writer profile. Future matching
  names may auto-sync only within an owner-enabled namespace policy.
- Compare locally using keyed fingerprints; do not publish plaintext hashes
  of low-entropy credentials.
- Upload only changed approved entries, with expected base versions and
  idempotency identifiers. A conflict preserves both candidates and stops
  automatic overwrite. Server acknowledgments are required before marking sync.
- Missing lines do not delete remote records. Deletion is explicit.
- Queue retries encrypted at rest; invalid saves never enter the queue.
- Prevent feedback loops when applying remote changes locally. Default to one
  writer device and subscriber devices; multi-writer is an explicit upgrade.
- Status and logs contain identifiers and outcomes, never values or file bodies.

## Enrollment and recovery

Install a pinned, verifiable client artifact; avoid an unverified shell-pipe
installer. Browser sign-in proves owner identity. An existing trusted device
then approves the new device public key and permitted profiles. Pairing codes
are short-lived and single-use; they do not alone confer access.

Device credentials and private keys live in the OS credential store. Clients
receive no Cloudflare management token. Requests require independent application
authorization even if Cloudflare Access protects the endpoint. Design expiry,
renewal, replay rejection, rate limits, device revocation, and audit retention.

Establish offline recovery before the first real import. Recovery must work
after loss of all devices and must not rely solely on a secret inside this vault.
Revocation blocks future retrieval; already downloaded keys require provider
rotation when exposure is suspected. Define envelope rotation for future versions.

## Consumption

Proposed CLI, not implemented:

```text
secrets login
secrets device enroll
secrets profile attach claude
secrets sync status
secrets run --profile claude -- claude
secrets export --profile claude --output .env
```

Process injection is default. Compatibility export is explicit, uses atomic
writes and restrictive permissions, and excludes unrelated namespaces. Default
offline behavior fails closed; optional bounded encrypted caching has a visible
age limit. Existing running processes retain their old environment until restart.
Personal passwords and infrastructure administrator credentials have separate
profiles from everyday provider keys.

## Future provider proxy

Use provider-specific adapters and fixed upstream origins. The caller chooses
an approved connector and operation; it cannot supply an arbitrary URL or
authorization header. Reject redirects outside the allowlist, redact upstream
errors, scope methods and payload sizes, and enforce spend/rate limits. Stream
responses where required. Model prompts and responses are not logged by default.
Proxy-only devices cannot retrieve plaintext. Returning a provider response must
not inadvertently return its authentication material.

## Delivery sequence and acceptance

1. Implement and review the Worker and client using synthetic fixtures.
2. Verify save-by-rename, duplicate rejection, scoped import, encrypted retry,
   idempotency, version conflicts, injection, and value-free logging.
3. Verify unauthorized retrieval rejection, cross-profile isolation, pairing
   replay rejection, expiry, revocation, and complete-device-loss recovery.
4. Resolve the exact `9d9d` account and prepare dedicated resource configuration,
   cost/retention limits, authentication configuration, and rollback procedure.
5. Deploy after the concrete production configuration is owner-approved; prove
   two-device synthetic sync and rollback before installing the real listener.
6. Import an owner-selected credential subset; do not upload the entire source
   dotenv file. Expand namespaces only after successful readback.
7. Add proxy envelopes/adapters and verify SSRF rejection, invocation/retrieval
   permission separation, redaction, rotation, and provider limits.

Repository source work does not authorize credential-store changes, real secret
uploads, startup-agent installation, or production activation. Existing Cambium
work remains separate; no operational planner or acceptance state is changed
by this design candidate.

## References

- https://developers.cloudflare.com/secrets-store/manage-secrets/
- https://developers.cloudflare.com/secrets-store/integrations/workers/
- https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
- https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/

Cloudflare Secrets Store supports runtime retrieval through configured Worker
bindings; its management API does not return stored plaintext. It is a candidate
for future fixed provider adapters, not the client-encrypted sync data model.
