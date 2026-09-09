# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.16] - Unreleased

### Fixed
- **Review Gallery search silently overrode the "Hide ASNAP" toggle** — the search term and ASNAP exclusion were combined into one `fulltext` filter with OR instead of AND semantics, so typing a search term re-showed ASNAP events even with the toggle active; the same gap meant Review Map/Replay never picked up a Gallery search term, since the search handler didn't call `eventUpdateReviewReplay()` the way the ASNAP toggle did

### Security
- Pinned `qs` (pulled in transitively via `webpack-dev-server`'s `express` dependency, dev-server only) to `^6.16.0` via `overrides`, resolving 2 moderate-severity advisories (GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g) that `npm audit fix` couldn't reach because `express@4.22.2` pins `qs` below the patched version

### Internal
- Removed unused dependencies: `jquery`, `eslint-plugin-import`, `eslint-plugin-react-hooks`, `@fortawesome/fontawesome-common-types`, `@fortawesome/fontawesome-free`
- Declared `prop-types` and `history` as explicit dependencies — both were imported directly throughout the app but only ever resolved transitively via other packages
- Moved `@babel/runtime`, `@fontsource/open-sans`, `@fortawesome/fontawesome-svg-core`, `@fortawesome/free-solid-svg-icons`, and `@fortawesome/react-fontawesome` from `devDependencies` to `dependencies`, since they ship in and run from the production bundle rather than being build-only tooling

## [2.4.15] - 2026-09-08

No functional changes. Version bump only, to keep release numbering aligned with `sealog-client-vehicle` (whose 2.4.15 fixes were already included here as part of [2.4.14](#2414---2026-09-08)).

## [2.4.14] - 2026-09-08

### Fixed
- **Event Management filter form didn't filter events** — `fetchEvents()` read the retired `eventFilter.value` field instead of `eventFilter.fulltext`, and spread `author`/`datasource` as unsplit comma-joined strings instead of arrays, so filtering by full text, author, or datasource had no effect
- **Event History search box didn't filter events** — `buildEventQuery()` and `event_history.js`'s event-export fallback query still sent the search term under the retired `value` query param instead of `fulltext`, so search terms had no effect on the server
- **Export dropdown produced an empty file when the event filter form had values** — `export_dropdown.js` still referenced the retired `eventFilter.value` field and spread `fulltext`/`author`/`datasource` as raw comma-joined strings instead of arrays, so filtered exports matched zero events on the server
- **Review Gallery "Hide ASNAP" toggle didn't filter images** — `initCruiseImages()` sent the ASNAP exclusion under the retired `value` query param instead of merging it into `fulltext` alongside the search box's term, so the server never applied it and ASNAP-tagged images stayed visible regardless of the toggle
- **Review Gallery's full-text filter wasn't retained when navigating from Review Map/Replay** — the gallery's search box kept its term in local component state, disconnected from the shared `eventFilter` Redux state that Review Map/Replay read and wrote via `EventFilterForm`, so a filter set on one page was silently lost when switching to the gallery

## [2.4.13] - 2026-09-08

### Added
- **Warning that button name isn't stored** — a note beside the Button Name and Event Value fields in the event template form clarifies that the button label isn't part of the saved event data or exports

### Fixed
- **Deleted event attachments not removed from other clients' view** — the server publishes a `deleteEventAuxData` websocket event when an aux_data record is deleted, but `EventHistory` only subscribed to the `new`/`update` variants, so a deleted attachment lingered in the UI for other connected clients until they manually refreshed
- **Event timestamp validation used the obsolete `event_ts` field** — the event-options modal stores a manually adjusted timestamp in `ts`, but its validator still read/wrote `event_ts`, so an invalid manual timestamp reached the server unvalidated
- **Failed attachment deletion could still remove its metadata** — `handle_image_file_delete` passed its callback into the file-delete helper's `id` argument, so the caller removed the aux_data record without waiting for the file request to complete, letting a failed physical file delete still remove the attachment from Sealog while the file remained on disk
- **Pressing Enter cleared gallery searches** — the gallery search field lived in a form with no submit handler, so Enter reloaded the page and cleared the active search even though results already update live as you type
- **Imported template categories bypassed case normalization** — templates imported from JSON skipped the lowercasing the form applies on save, letting mixed-case categories (e.g. imported `ROV` alongside form-edited `rov`) split what should be one category
- **Gallery attachment keys could collide for events with multiple images** — gallery items were keyed only by data source and event id, so an event with more than one attachment in the same source could get duplicate React keys, letting the wrong thumbnail be reused on re-render; the key now also includes the attachment's filepath
- **Template JSON import dropped visibility/styling fields** — exported templates carry `admin_only`, `disabled`, and `event_button_color`, but re-importing them silently reset `admin_only`/`disabled` to `false` and dropped `event_button_color`
- **Long custom vocabulary could crash clipboard export** — cruise clipboard formatting right-pads labels to a fixed column width sized for the default "Cruise" wording; a longer `CUSTOM_CRUISE_NAME` made the padding count go negative, and `String.repeat()` throws on a negative count
- **`SERVER_TLS` missing from `client_settings.js.dist` export** — the variable was defined but never exported, so any deployment configured off the `.dist` template had `SERVER_TLS` come through as `undefined`
- **Duplicated event template name prepended "Copy of"** — `handleEventTemplateDuplicate` now appends " Copy" to the button name instead

### Internal
- Updated `axios`, `css-loader`, `html-webpack-plugin`, `prettier`, `sass`, `webpack`, and `webpack-cli` to their latest versions within existing semver ranges

## [2.4.12] - 2026-08-18

### Added
- **Toast on failed event submission** — `createEvent`/`updateEvent` previously swallowed REST failures silently, so an event that never reached the server (or was rejected) was indistinguishable from a successful submission; failures now surface as a transient toast
- **Websocket connection status in footer** — the footer now shows "Server: Connected"/"Disconnected", reflecting the status of the websocket connection used for live status updates

### Security
- Bumped `nanoid` to 3.3.18 to fix an indefinite-loop DoS advisory (GHSA-2v37-7h3g-55p8)

## [2.4.10] - 2026-08-06

### Fixed
- **System users table pagination expanded instead of paginating** — the users table's row slicing always used the non-system table's page state for the start index regardless of which table was being paged, so paging the system users table grew the visible range instead of moving to the next page, and paging the non-system table could make the system table appear to show 0 records
- **Non-system user count used the wrong filtered list** — the displayed count for non-system users read from the system users' filtered list instead of its own

## [2.4.9] - 2026-08-06

### Fixed
- **Event template CSV validation** — comma-separated option/default values in event templates were split without trimming whitespace, causing valid defaults to fail validation and all but the first checkbox default to go unchecked

## [2.4.8] - 2026-07-30

### Fixed
- **CSS output filename** — `MiniCssExtractPlugin`'s `filename` option had a duplicated leading bracket, producing CSS asset files with a literal `[` in the name and a broken, URL-encoded `href` in `index.html` that failed to load in production
- **Self-hosted fonts** — removed a leftover live `@import` of Open Sans from `fonts.googleapis.com` in `_bootswatch.scss`; the font is already bundled and served from the same origin via `@fontsource/open-sans`, so the external request broke styling on network-restricted deployments

### Security
- Added an explicit `fast-uri` override (`^3.1.4`) to guard against Dependabot alert #86 regressing

## [2.4.7] - 2026-07-25

### Added
- **Full text search in the review gallery** — a debounced search field filters images by event tag, free text, and event option values via the server's `fulltext` query param

### Security
- Resolved 5 npm audit findings (1 low, 4 high) in transitive build-tooling dependencies (`body-parser`, `brace-expansion`, `fast-uri`, `immutable`, `postcss`) via `npm audit fix`

## [2.4.6] - 2026-07-16

### Added
- **Color-coded button color picker** — the event template "Button Color" field now renders as a dropdown where each option is shown in its own Bootstrap variant color, previewing what the button will look like

### Security
- Pinned `uuid` to `11.1.1` to resolve Dependabot alert #75 (transitively pulled in via `webpack-dev-server` → `sockjs`)

## [2.4.5] - 2026-07-14

### Added
- **Duplicate button for event templates** — a copy icon on each row in both the System and non-system event template tables creates a new template identical to the original with "Copy of " prepended to the event name
- **Per-template event button color** — event templates can set an `event_button_color` field to override the button's Bootstrap variant in the event logging UI, falling back to the new `DEFAULT_EVENT_TEMPLATE_BUTTON_COLOR` client setting (defaults to `primary`, preserving prior behavior) when unset

### Internal
- Updated `axios`, `@babel/*`, `concurrently`, `eslint-plugin-prettier`, `prettier`, `sass`, `webpack`, `webpack-cli`, and `webpack-dev-server`

## [2.4.4] - 2026-05-21

### Added
- **Gallery view with Attached Images tab** — new Review Gallery fetches all configured image aux data sources across the cruise; `eventFileAttachments` are grouped under a single "Attached Images" tab while other sources (e.g. framegrabber) are tabbed by camera name; includes an ASNAP toggle, per-page image count selector, and keyboard navigation

### Changed
- Event file attachments now store FilePond's server-returned `serverId` (prefixed with `{event_id}_`) instead of the local filename in aux_data records
- `eventFileAttachments` aux_data now stores a `source` (original filename) + `filename` (prefixed) pair instead of `camera_name`, so the original filename displays as the label in the event comment modal and image preview title while the prefixed name is used for the image URL

### Fixed
- Attachment delete in the event comment modal now removes `source`+`filename` pairs by position rather than matching on `data_value`, which broke once the two entries held different values

### Docs
- Rewrote README with full feature documentation
- Rewrote INSTALL.md with accurate and complete instructions

### Internal
- Removed dead `event_files` code path from `updateEventRequest` (unreachable — no component ever set it)
- Updated `axios`, `webpack`, `webpack-dev-server`, and other dependencies to latest patch versions

## [2.4.3] - 2026-04-11

### Changed
- Icons and action buttons across event history, event management, cruises, users, review map, and replay now render with `role="button"` and a pointer cursor
- Clickable text throughout the app shows a pointer cursor instead of the default cursor
- Event list items' clickable area now spans the full row width (up to the comment icon) rather than just the text length
- Event image cards show a pointer cursor and dim on hover to signal interactivity
- Active event list items show white text; hovered items show primary-colour text
- Removed underline-on-hover from `.clickable` elements

### Internal
- Upgraded `babel-loader` to v10, `eslint-config-prettier` to v10, `sass-loader` to v16, `webpack-cli` to v7
- Updated `webpack.config.js.dist`: sass-loader modern API, suppressed Dart Sass deprecation warnings from Bootstrap (`quietDeps`, `silenceDeprecations`), disabled bundle size hints
- Updated build scripts to use `--config-node-env` flag (webpack-cli v7)

## [2.4.2] - 2026-04-10

### Added
- **Event file attachments** — events can now have files attached via the event template options modal; attached files are stored as `eventFileAttachments` aux data records
- **Attachment previews in comment modal** — file attachments are displayed as thumbnail image previews with filename and delete controls in the event comment modal
- **Login via email** — users can now log in using either their username or email address
- **POWER_LOGGER user role** — new role added for users who need elevated event logging permissions
- **WebSocket live updates in Event Management** — the event list now updates in real time as events are created, modified, or deleted

### Fixed
- **Newest event not displaying** — race condition in event history caused the most recent event to not appear on load
- **Event history card stability** — the newest event card no longer changes when navigating to older pages; it always reflects the most recent event
- **Review replay stale state** — playback controls (play, fast-forward, reverse, start, end) were advancing to the wrong event due to stale state reads after `setState`; all fixed
- **Review replay timer leak** — slider debounce timer was stored in component state, preventing proper cleanup on unmount
- **Gallery tab timer** — pagination debounce timer moved from component state to instance variable, eliminating stale state reads
- **Event management pagination** — page number now adjusts correctly after an event is deleted
- **WebSocket disconnect** — execute modal now properly disconnects its WebSocket client on unmount

### Security
- Resolved all npm audit vulnerabilities
- Upgraded `@hapi/nes` to v14

### Internal
- Extracted shared utilities (`resolveStartTS`, `connectWSClient`, `buildEventQuery`) into `src/utils.js`; adopted across event history, event management, event template list, and footer
- Removed unused `lowering_dropdown.js` component
- Removed pointless `connect(null, null)` Redux wrappers from `CustomPagination` and `ExportDropdown`
- Eliminated state-mirroring-props pattern in `ExportDropdown`; extracted triplicated query building into `buildQuery()`
- Extracted repeated `findCurrentCruise()` helper in `CruiseMenu`
- Removed empty constructor and unused import in `EventLogging`
- Removed unused `replayEventIndex` state and dead code branch in `ReviewGallery`
- Updated `prettier`, `concurrently`, and `sass` to latest
