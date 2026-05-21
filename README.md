# sealog-client-vessel

A React/Redux single-page application for real-time scientific event logging during research vessel cruises. This client is designed around a single **Cruise** level — events are recorded directly against the cruise without a sub-dive hierarchy.

It communicates with a [Sealog Server](https://github.com/OceanDataTools/sealog-server) backend via REST API and WebSocket.

![Main Page](/docs/sealog_main.png)
![Event Template](/docs/sealog_event_template.png)
![Cruise Selection](/docs/sealog_cruise_select.png)
![Cruise Map](/docs/sealog_cruise_map.png)
![Edit Cruise Metadata](/docs/sealog_edit_cruise.png)
![Edit Event Template](/docs/sealog_edit_template.png)

For installation instructions please refer to [INSTALL.md](./INSTALL.md)

[Live Demo](https://sealog-vessel.oceandatatools.org) — admin account: `admin` / `demo`

---

## Features

### Event Logging
- Real-time event submission using configurable **Event Templates** (custom fields, categories, sort order)
- Free-text comment field on every event
- **File attachments** — attach images or documents to events via drag-and-drop (FilePond); previewed as thumbnails in the comment modal
- Live event history with keyword filtering, pagination, and ASNAP event toggle
- WebSocket-driven live updates — new/modified/deleted events appear instantly without page refresh
- Hold Shift while clicking an event template to force the options dialog open
- **POWER_LOGGER** role allows submitting admin-only event templates from the main logging view

### Post-Cruise Review
- **Replay View** — synchronized playback through all cruise events with full auxiliary data (navigation, sensor data, imagery) and playback controls (play, fast-forward, reverse)
- **Map View** — interactive Leaflet map showing the vessel trackline with selectable tile layers and event overlays; events can be browsed and commented on directly from the map
- **Gallery View** — paginated image gallery browsable by source (e.g. camera name); images attached via `eventFileAttachments` are grouped under an **Attached Images** tab

### Data Management
- **Cruise Management** — create, edit, and manage cruises; attach files; copy cruise metadata to clipboard
- **Event Management** — search, filter, inline-edit, and delete events across the full cruise; export to CSV/JSON
- **Event Template Management** — create and organise event templates with categories, field types, and visibility rules

### User & Access Management
- Role-based access control: `admin`, `cruise_manager`, `event_manager`, `event_logger`, `power_logger`, `guest`
- Optional per-cruise access control (must match server `useAccessControl` setting)
- User registration, password reset, and profile management
- Login via username **or** email address
- Optional reCaptcha bot protection on login/registration

### Customisation
- Configurable terminology — rename "cruise" to suit your programme
- Optional cruise ID format validation via regex
- Configurable auxiliary data source display order and label overrides
- Configurable image/framegrab sources and position data sources
- Read-only mode (`DISABLE_EVENT_LOGGING`) for post-cruise review instances
- Customisable login page text and image; customisable main screen header/text

---

## User Roles

| Role | Description |
|------|-------------|
| `admin` | Full access to all features and administration |
| `cruise_manager` | Manage cruises and users |
| `event_manager` | Manage event templates; edit/delete any event |
| `event_logger` | Submit and edit own events |
| `power_logger` | Submit events from admin-only event templates |
| `guest` | Read-only access |

---

## Configuration

Copy the template files before first use:

```bash
cp src/client_settings.js.dist src/client_settings.js
cp src/map_tilelayers.js.dist src/map_tilelayers.js
cp webpack.config.js.dist webpack.config.js
```

Key settings in `src/client_settings.js`:

| Setting | Description |
|---------|-------------|
| `SERVER_HOSTNAME` / `SERVER_PORT` / `SERVER_TLS` | Sealog Server connection |
| `ROOT_PATH` | URL path where the client is hosted |
| `USE_ACCESS_CONTROL` | Must match `useAccessControl` on the server |
| `POSITION_DATASOURCES` | Aux data sources used as vessel position |
| `IMAGES_AUX_DATA_SOURCES` | Aux data sources rendered as imagery |
| `EXCLUDE_AUX_DATA_SOURCES` | Aux data sources hidden from the UI |
| `AUX_DATA_SORT_ORDER` | Display order of aux data cards |
| `AUX_DATA_DATASOURCE_REPLACE` | Human-readable labels for aux data source names |
| `CUSTOM_CRUISE_NAME` | Override "cruise" terminology |
| `DISABLE_EVENT_LOGGING` | Set `true` for read-only review instances |
| `RECAPTCHA_SITE_KEY` | Enable reCaptcha on login/register |

---

## Common Commands

```bash
npm install          # Install dependencies
npm start            # Dev server on port 8080
npm run start-devel  # Dev server + concurrent linting (watch mode)
npm run build        # Production build → dist/
npm run lint         # ESLint check
npm run lint-fix     # Auto-fix ESLint issues
```

---

## Requirements

- [Sealog Server](https://github.com/OceanDataTools/sealog-server) v2.x
- Node.js ≥ 20.x

---

## Current Users
- R/V Falkor operated by the Schmidt Ocean Institute
- R/V OceanXplorer1 operated by OceanX
- E/V Nautilus operated by Ocean Exploration Trust
- R/V Western Flyer operated by the Florida Institute of Oceanography

---

## Thanks and Acknowledgments

Sealog exists thanks to financial support from all of its users and continues to evolve thanks to the UNOLS community who have helped since the beginning by sharing their wealth of experience and technical ability.
