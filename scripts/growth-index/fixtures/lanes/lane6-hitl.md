# Synthetic decision register (test fixture)

## A. MUST-DECIDE-FIRST (each unblocks the most)

| ID | Question | Options | Recommended default | Who | Unblocks | Deps | Risk / Rev | Source |
|---|---|---|---|---|---|---|---|---|
| D1 | Example policy question | A1; A2 | A1 | F | Example wave | none | Medium | example.md:10 |
| D5 | Approve first calendar row | approve one; hold all | approve one | F | First publish | graded draft | irreversible | example.md:11 |

## B. SAFE-TO-DEFAULT (reversible; founder may veto later)

| ID | Question | Default | Who | Unblocks | Rev | Source |
|---|---|---|---|---|---|---|
| S6 | Example optional mode | Keep disabled | F | nothing | High | example.md:12 |

## C. OWNER-APPROVAL-GATED (deploy, mutation, public posts)

| ID | Action | Gate needed | Who | Depends on | Rev | Source |
|---|---|---|---|---|---|---|
| G1 | Example gated action | Approved manifest | owner | D1 | Reversible | example.md:13 |
