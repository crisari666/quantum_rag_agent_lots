# Project lots inventory API

Prefix: **`/rag`**. Auth: `TOKEN` header (office JWT) unless noted.

Levels: **admin** `0`, **subadmin** `1`, **content** `9`.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/projects/lot-inventory` | admin/subadmin/content | Hub: projects + status summaries |
| GET | `/projects/:projectId/lots` | admin/subadmin/content | `?kind=lot\|commercial\|all` `&stage=stageKey` + summary. Sort: stageOrder, number. |
| GET | `/projects/:projectId/lots/public` | **public** | `{ projectId, projectTitle, lots[{ number, area, price, status, kind, ventorName, holdUntil, stageKey, stageName, stageOrder }], summary }` (no soldBy). `?stage=` optional. Expired holds released on read. |
| POST | `/projects/:projectId/lots/generate` | admin/subadmin | Body optional overrides: nLots, nCommercialSpaces, baseLotArea, baseCommercialArea, defaultLotPrice, defaultCommercialPrice. Creates missing numbers only on stage `default` / General. |
| PATCH | `/projects/:projectId/lots/:lotId` | admin/subadmin/content | area, price, status, ventorName, soldBy, holdUntil, stageKey, stageName, stageOrder |
| PATCH | `/projects/:projectId/lots/bulk-status` | admin/subadmin/content | `{ lotIds, status, ventorName?, soldBy?, holdUntil? }` (hold defaults now+24h) |
| POST | `/projects/:projectId/lots/import` | admin/subadmin/content | multipart `file` (.xlsx), `?kind=lot\|commercial`. Headers: **stage** (required; empty/`default`/`general` → `1`), nLots, area, price, status (`V` sold, `S` hold, `C` locked); optional ventor, stageName, stageOrder. Upsert by `{ kind, stageKey, number }` (stage `1` also updates legacy `default`). Price accepts COP text like `$ 52.000.000`. |

Unique lot key: `{ projectId, kind, stageKey, number }`.

Project inventory config fields (PATCH `/projects/:id`): `nLots`, `nCommercialSpaces`, `baseLotArea`, `baseCommercialArea`, `defaultLotPrice`, `defaultCommercialPrice`.

### Lot map (KML → GeoJSON)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/projects/:projectId/lots/map/kml` | admin/subadmin | multipart `file` (.kml) + optional form `swapStages=true`. Saves KML + GeoJSON on project (`lotsMapKml`, `lotsMapGeojson`). Stage from ExtendedData or name `1-12` / `2-3`; legacy plain numbers → west/east by centroid lon. `swapStages` swaps keys `1`↔`2`. Upserts missing `project_lots` only. |
| GET | `/projects/:projectId/lots/map` | admin/subadmin/content | Painted FeatureCollection: each feature gets live `status`, `lotId`, area, price, ventorName, holdUntil, soldBy, stage*. |
| GET | `/projects/:projectId/lots/map/public` | **public** | Same paint without `soldBy`. |
| DELETE | `/projects/:projectId/lots/map` | admin/subadmin | Clears map asset filenames and deletes files. |

Join key for paint: `` `${stageKey}::${lotNumber}` ``. Stage `1` also matches legacy `default` lots (prefers non-available when both exist). Unmatched polygons → `status: null` (default style).
