# ARCHIVED — DO NOT SEND

Retired 2026-09-11T13:36:22.452002+00:00 because Explee project **16763** is historical-only. Hot queue dropped. Await new project ID.

---

# Outreach pack — LinkedIn FR + manual email (send-gated)

Created: 2026-09-11T13:34:16.368605+00:00

All 6 Public Agencies hot personIds have draft copy. **send_ready=false** until you mark `qualified_fr_operator`.

## Pause drift
- Operator claim: pause done
- GET at 2026-09-11T13:32:39.988Z: auto_reply=True, budgets>0 for 9 campaigns
- Re-verify in Explee UI before sending anything.

## Candidates

| ID | personId | replies | latestReplyAt | send_ready | File |
|---|---|---:|---|---|---|
| iverif-fr-out-01 | `40b873da-d4dc-4ea3-8a8b-5a74af73f7ea` | 2 | 2026-07-17T09:44:06Z | false | `iverif-fr-out-01.md` |
| iverif-fr-out-02 | `0ae6da64-ff7a-47a3-92ec-7e8aa83edb00` | 2 | 2026-07-17T06:17:06Z | false | `iverif-fr-out-02.md` |
| iverif-fr-out-03 | `27f0b52c-005b-4a14-bfb7-334d72a60a65` | 1 | 2026-07-09T15:33:59Z | false | `iverif-fr-out-03.md` |
| iverif-fr-out-04 | `4d2abc82-9bc3-41c4-85a2-c5bbd6588f2b` | 1 | 2026-07-07T12:40:56Z | false | `iverif-fr-out-04.md` |
| iverif-fr-out-05 | `c04b057b-82b4-40da-9d8e-e41da41f321a` | 1 | 2026-06-25T09:12:42Z | false | `iverif-fr-out-05.md` |
| iverif-fr-out-06 | `6b737f33-8c14-4751-a008-d75940f70cd6` | 1 | 2026-06-22T08:52:59Z | false | `iverif-fr-out-06.md` |

## Shared FR frames

### LinkedIn connection
Bonjour {{prenom}}, je travaille sur la validation de dossiers CEE / Primes Énergie avant dépôt (contrôles inter-documents + piste d’audit). Si vous gérez un back-office délégataire / ops, je serais preneur d’un échange court.

### LinkedIn follow-up
Contexte: beaucoup d’équipes perdent du temps sur des incohérences de pièces découvertes trop tard. iverif.fr aide à signaler les écarts avant dépôt — sans se substituer à l’obligé / délégataire. Seriez-vous ouvert à une démo de 20 minutes sur un dossier type ?

### Email subjects
- `Validation dossiers CEE avant dépôt`
- `Back-office Primes Énergie — contrôle inter-documents`

### Email body

```
Bonjour {{prenom}},

Je me permets de vous écrire au sujet du contrôle des dossiers d’aides énergie (CEE / Primes Énergie) avant dépôt.

Beaucoup de back-offices croisent 10 à 20 pièces par dossier; les écarts trouvés trop tard coûtent cher et fragilisent la piste d’audit.

iverif (iverif.fr) aide les opérateurs à valider pièces et champs contre des règles de programme, avec une trace horodatée — sans transformer votre organisation en obligé ou délégataire.

Seriez-vous disponible pour une démo FR de 20 minutes sur un dossier type ?

Cordialement,
{{signature}}
```

## Next

1. Re-check auto-reply off + budgets 0 (API still disagreed).
2. Mark each candidate qualified_fr_operator or reject.
3. Tell me verdicts — I will flip send_ready only for qualified rows and refresh organ-export stages.
