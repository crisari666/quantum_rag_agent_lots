# Lot map: paint KML polygons from `project_lots.status`

Handoff for the lot-stock agent. Goal: color each lot polygon on the map using **DB status**, not the random/default fill.

Related API: `md_files/project-lots-endpoints.md`. Collection: `project_lots` (`omega_rag`). Unique key: `{ projectId, kind, stageKey, number }`.

## Files

- Source drawing: `/Users/kdev999/Downloads/prueba numeracion.kml` (lines + numbered points; **no polygons**).
- Map-ready KML: `/Users/kdev999/Downloads/prueba numeracion poligonos.kml` (closed LineStrings → Polygon + lot number).

Do **not** store status in the KML as source of truth. Status lives in Mongo. Paint at read/render time.

## KML contract (Valle del Sol / stage-lot nomenclature)

Each lot Placemark:

- `name` = `{stageKey}-{lotNumber}` (e.g. `"1-12"`, `"2-3"`)
- `styleUrl` = `#status-{status}`
- `ExtendedData` / `LotSchema`:
  - `lotNumber` — lot number only (e.g. `"12"`)
  - `stageKey` — stage id (`"1"` / `"2"`)
  - `status` — `default` | `available` | `hold` | `locked` | `sold`

Parser priority: ExtendedData → name `stage-lot` → legacy plain number + west/east centroid.

Initial export: all lots `status=default`, `styleUrl=#status-default` (white faded).

Shared styles (KML color **AABBGGRR**, alpha `73` ≈ 45%):

| DB `ProjectLotStatus` | `styleUrl` | Fill | UI ref (admin chips) |
|-----------------------|------------|------|----------------------|
| *(no match / unset)* | `#status-default` | `73ffffff` white | — |
| `available` | `#status-available` | `73059669` green | `#059669` |
| `hold` | `#status-hold` | `730677d9` amber | `#D97706` |
| `locked` | `#status-locked` | `73695547` slate | `#475569` |
| `sold` | `#status-sold` | `73481de1` rose | `#E11D48` |

To paint one lot: set `SimpleData name="status"` **and** `styleUrl` to the matching `#status-*`. Keep the same alpha; only the RGB changes.

## DB join

```
GET /rag/projects/:projectId/lots?kind=lot
GET /rag/projects/:projectId/lots/public?kind=lot   // map / ventor; no soldBy
```

Lot fields needed: `number`, `status`, `kind`, `stageKey`, `stageName`, `holdUntil`. Expired holds are released on public read.

Join: `kml.lotNumber` → `project_lots.number` where `kind=lot`.

### Stages and duplicate numbers

Join key must be `{ number, stageKey }`, never `number` alone. Current Valle del Sol KML uses names `1-*` / `2-*` plus ExtendedData `stageKey`/`lotNumber` (e.g. stage 1 ≈ 310 lots, stage 2 ≈ 51).

## Suggested paint flow

1. Load polygons (KML or convert once to GeoJSON and persist on `Project` if you add a map asset).
2. Fetch lots for that `projectId` (`kind=lot`).
3. Index DB rows by `${stageKey}::${number}`.
4. For each polygon: resolve stage + number → `status` → style/color above. Unknown → `#status-default`.
5. Re-paint when inventory PATCH/bulk-status/import changes (invalidate the same query used by lot-inventory).

Do not duplicate status onto polygon documents. Geometry is static; status is live.

## Out of scope / not done

- ~~KML is not uploaded to a project yet (no `kml`/`geojson` field on `Project`).~~ **Done:** `lotsMapKml` / `lotsMapGeojson` + `POST .../lots/map/kml`.
- ~~Polygons have no `stageKey` / `lotId`.~~ **Done on upload:** ExtendedData or `1-N`/`2-N` names → stageKey; legacy west/east fallback; paint attaches `lotId` live.
- Open CAD lines (vías) are in folder `Lineas abiertas` (hidden); ignore for stock.
- 5 closed rings have no marker (`sin-numero-*`); not lots.

## Frontend surfaces (if painting in-app)

- Admin: `crm_lots_agents` `src/features/project/lot-inventory/`
- Public/ventor catalog already uses `/lots/public`

Prefer GeoJSON + map lib (Leaflet/Mapbox) over mutating KML in the client. KML styles are for Google Earth preview and as the color contract.
