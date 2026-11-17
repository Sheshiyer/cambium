# Library · Cambium reference field

An ordinary Library tab with a 2D Cambium organ atlas and a reference folio. Its saved-link model is source agnostic: X, Reddit, GitHub, Field Theory, export files, and user-shared URLs coexist. Chrome is the current host for native tabs and storage. There is no new sidebar, embedded browser, or new-tab replacement.

The atlas has five stable regions—Taste, Will, Hands, Cortex, Signals—and an Unplaced inlet. Counts reflect current saves. Select a region to open its folio, or search across all regions. Each folio page holds at most 36 saves; opening one shows its provenance, Kimi context, notes, working set, project fits, and review controls. Working sets and Rediscover use the same folio. The map uses static SVG and CSS, with no WebGL or idle animation.

Organ placement is a local review layer. A `cambium:` source tag takes priority, then a category, then saved context. Category and context matches are labeled suggested. You can confirm a region, move a save to Unplaced, or return to the source suggestion. Your decision is stored separately from imported records and survives reimports. Uncertain saves remain in Unplaced.

## Use your saves
1. The 68 links supplied on 27 October are added once as **Shared with Library**, grouped into tentative Cambium Taste, Will, Hands, Cortex, and Signals lanes. Coverage is URL only until reviewed. Import saves → Import latest Field Theory saves brings in X bookmarks, GitHub stars, Reddit saves, shared references, and their Kimi context. Repeat imports merge by URL and preserve your purpose notes, explored status, working sets, and category overrides.
2. Open an idea, describe what you could use it for, and assign a working set around a real outcome.
3. Working sets → Open tabs previews up to 12 references and opens them in a native Chrome tab group. Reopening reuses the named group and its existing matching tabs.
4. Rediscover and Surprise me surface unexplored saves. Small steps reward actual purpose notes, three saves in the same working set, and explored saves. There are no fake scores or streak penalties.

## Kimi and data
Field Theory's existing Kimi Code key stays outside Chrome. The scheduled local update runner ingests the shared-link batch, enriches GitHub, Reddit, and shared references with Kimi, then exports a credential-free `field-theory-library.json`. Import that snapshot in Library when you want the latest context. The exporter reads bookmark records and source caches, never provider keys, cookies, or Chrome profile storage. X browser sync currently requires a macOS Keychain review; the other source stages still run.

Ask Kimi offers a copyable command for the existing Field Theory setup. Direct browser requests are optional and need a separate Kimi Code key in Advanced settings. Leaving the key field empty preserves an existing browser key; Remove saved browser key clears it. Legacy Anthropic `apiKey` settings and Claude model selections are removed when Library loads. No provider call happens merely because you type a search. Direct syncs sort locally when no browser key is configured.

## Field Report bridge
The hourly, bounded local project-fit index compares Library references against a dated Field Report product snapshot. It is a proposal aid: a word match or organ hint does not prove the linked page has been reviewed. Open a save to see its possible project fits, then mark Fits or Not now; feedback changes later suggestions for similar saves.

For a durable cross-surface handoff, select saves and choose **Field Report ↗**. The Library downloads up to 100 proposal links, without provider keys. In the owner-private [Field Report Source archive](https://field-report.witnessalchemist.chatgpt.site/details.html?district=sources), open Find and import that packet. Review it there; **Export review for Library ↗** returns a feedback packet, which Library → Sources → Apply Field Report review can use. This is an explicit file bridge, not a silent cloud upload. Field Report keeps reference proposals separate from commit-backed research, missions, approvals and publication.

## Existing companion features
- Command+K searches tabs, history and bookmarks on ordinary pages. Command+Shift+L opens Library; Command+Shift+D saves the current page. Shortcut availability depends on Chrome conflicts.
- Right-click an ordinary web page → Customize this site (Boost). Preview changes there, then save, reset, or cancel in Library.
- Option+Shift+Right cycles native tab groups.
- Optional 12-hour archive covers unpinned, ungrouped, inactive, silent web tabs only. Archived tabs can reopen URLs, not unsaved page state.
- Direct GitHub and Chrome sync can run hourly when enabled. Social DOM harvesters are manual and depend on current site markup and login state.

## Lightweight rendering
The Library uses local CSS, inline SVG, two selected Cambium concept images (4.7 MB total, source hashes in `visual-assets/SOURCES.md`), and bundled Satoshi/Panchang fonts copied from the Field Report design source. It displays at most 36 saves per page. Search and storage refreshes are debounced; listeners and timers are cleaned up when the page closes. No WebGL scene, render loop, background music, or remote thumbnail downloads are needed. Dark and paper reading palettes, keyboard focus, and reduced-motion support are included.

## Update
The existing unpacked installation points to `~/arc-chrome`. Reload its card at `chrome://extensions`, then reopen Library from its toolbar button. An update uses the same extension ID and profile storage. Keep the existing permissions and default Chrome profile.

## Verification and limits
The actual view model and worker pass offline checks for source filters, 36-save paging, URL validation, Field Theory merges, organ placement priority and persistence, user context preservation, serialized writes, remove/restore, sender restrictions, and native group reuse after URL redirects. Desktop and 390 px sample previews cover the atlas and folio, search, working sets, simulated group opening, imports, and reading palettes.

The preview is explicitly labeled, uses synthetic saves, and simulates browser actions. The unpacked extension was reloaded in the default Chrome profile and its installed atlas opened with real saves. One native group was created and reopened after a Figma URL redirect; it stayed at one tab after the reuse fix. The latest Field Theory snapshot was imported in that profile. Live social DOM selectors and optional direct Kimi requests remain unverified in this redesign.

`preview-runtime.js` is development-only and is not used for extension pages. A distributable should exclude that file and all local Field Theory snapshots, shared-link batches, and personal exports. Never publish a snapshot containing personal saves.

## 0.4.4 — Field Report atlas and folio
The installed extension is now named Cambium Library. The map and right folio replace the previous hero, quests, and card grid. Counts come from current saves; Unplaced retains uncertain and held references. Local acceptance or rejection survives source imports. The source and category remain unchanged by organ review. Working sets, Rediscover, bulk controls, source filters, Field Report packets, and native tab groups stay available in the folio. Redirected links reuse their existing group tabs through a bounded local item-to-tab association.


## 0.4.0 — Exploration, bulk gardening, and Grok handoffs
- Explore mode displays 12 saves per page on a lightweight trail board; Shelf mode retains 36-card browsing. Compact mode stays available.
- Select this page or all matching saves (up to 500). Category supports existing or new categories. More actions clears working-set assignments or marks explored/unexplored. Remove previews the exact selected scope and keeps records in Recently removed (latest 500). Undo is available after bulk operations.
- Grok handoff prepares a local, reviewable packet for up to 50 selected references and the chosen native Grok Bot agent. Specify a research/compare/experiment/plan task, then copy or download Markdown. Delivery to the native agent conversation is manual; no undocumented deep-link message command is assumed.
- Native group creation now explicitly targets the same Chrome window as its tabs. Tests cover a second window and repeated opening. This addresses a real targeting gap; the originally reported installed-profile failure has not yet been confirmed resolved. A persistent error appears in the group dialog if it fails again.
- Additional offline and Chrome synthetic-preview checks passed: bulk category and Undo; bulk remove/restore; local handoff generation, task update, and clipboard copy. No preview console warnings/errors were observed.


## 0.4.1 — Personal collection and durable removal
Library now checks its worker capabilities before enabling the app. If files and the loaded worker differ, it gives a reload instruction instead of failing silently. The visible personal-collection summary includes version 0.4.1.

On the first open after this update, the worker reads Chrome bookmarks through `chrome.bookmarks.getTree()` and imports the supplied private Arc Markdown export. It merges these with existing saves, keeps original folder paths and personal context, and sorts uncategorized imports locally without an API request. Chrome + Arc is the opening view. Refresh Chrome + Arc rereads these sources explicitly. Existing social-source data remains available under its source filters.

Every card now has Open original and Remove. Single and bulk removal record a persistent local suppression ID so source sync/import cannot resurrect the removed save. Undo or Recently removed restores the record and clears suppression. Removal affects the Library only; source bookmark folders and Chrome tabs are not deleted. The latest 500 removed records remain recoverable.

`personal-arc-export.md` contains personal source data; keep this unpacked installation private. Do not include it in a public release.

Verified: actual Arc export parses as 311 entries / 277 unique URLs; folder paths merge. Tests exercise Chrome API import using a controlled fixture, capability handshake, refresh, durable single and bulk removals, and restore. Chrome synthetic preview exercises per-card removal without selection and Undo (28→27→28 personal sample saves), with no console warnings/errors. The real Chrome bookmark count and installed-profile behavior require the updated extension to run in the user's profile.

## 0.4.2 — Source failure and save visibility
Chrome and Arc import reads now fail independently. An unavailable source is reported without locking the existing Library. Failed preparation is retryable. Manual saves switch to the manual-source view so a new link is visible immediately; explicitly saving a removed URL restores it and applies its new purpose. Regression and sample-browser checks passed. The installed summary identifies version 0.4.2.
