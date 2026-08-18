# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
