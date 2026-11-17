# Approve route Access policy

This is a description for a later, separate attachment. This repository does not call the Access API and does not attach a policy, an application, or a service token.

## Decision

Allow.

## Include

One identity: the runtime value of `MAGE_ACCESS_IDENTITY`. The value is not stored in this repository.

## Application

`POST /v1/approve` on the non-production Worker `curious-api-dev`, when an owner later attaches a policy.

## Excluded

- Any bearer token, including a token held by Aletheios
- Aletheios
- A service token
- Any scope named `approve`. The token catalog has no such scope

The Worker also refuses the route when `Authorization` is present, when `MAGE_ACCESS_IDENTITY` or `CURIOUS_ACCESS_HMAC_KEY` is unset, or when the Access-shaped JWT does not verify. Those environment names are placeholders. Signature material is not committed.

`CURIOUS_ACCESS_AUD`, when set, must match the JWT `aud` claim. No audience value is committed here.
