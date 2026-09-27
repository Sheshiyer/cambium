# UI onboarding playbook (Explee AutoGTM)

Source: 2026-09-11 recon (API + public UI; authenticated dashboard was login-walled in headless browser).

## Prerequisites
- Operator logged into https://explee.com (Logto: work email or LinkedIn)
- Prefer ChatGPT IAB `http://127.0.0.1:5173` when available; else Superset pane / operator browser
- Do not Start prospecting / raise budget during recon

## Create project (UI — API cannot)
Path A (website):
1. Homepage hero → paste domain (e.g. `iverif.fr`)
2. Confirm company suggestion → Launch
3. Review research pipeline: Company → Competitors → Campaigns → Companies → People → Emails
4. Customize campaigns; STOP before Start prospecting if dry-run
5. If org already has projects: use **Add new project**

Path B (no website dialog):
- What do you sell?
- Who is ideal customer?
- Which markets/geography?
- CTA: Generate my campaigns (do not submit during recon unless intentional)

## Post-create (API bind)
1. `GET /autogtm/projects` → capture `{id, domain, daily_budget_usd}`
2. Snapshot campaigns / autopilot / budget / analytics
3. Recommended freeze: autopilot off, auto-reply off, budget 0 until armed
4. Prefer FR CEE campaign definition; avoid cloning old Public Agencies ICP

## Pitfalls
- Import campaigns can auto-start within project budget
- Autopilot ON → agent owns starts + budget split
- Auto-reply ON → unreviewed replies
- Logged-out Launch does not create a project
