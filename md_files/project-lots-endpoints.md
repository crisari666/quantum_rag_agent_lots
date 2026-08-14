# Project lots inventory API

Prefix: **`/rag`**. Auth: `TOKEN` header (office JWT) unless noted.

Levels: **admin** `0`, **subadmin** `1`, **content** `9`.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/projects/lot-inventory` | admin/subadmin/content | Hub: projects + status summaries |
| GET | `/projects/:projectId/lots` | admin/subadmin/content | `?kind=lot\|commercial\|all` + summary |
| GET | `/projects/:projectId/lots/public` | **public** | `{ number, area, price, status, kind }` + summary (no ventor) |
| POST | `/projects/:projectId/lots/generate` | admin/subadmin | Body optional overrides: nLots, nCommercialSpaces, baseLotArea, baseCommercialArea, defaultLotPrice, defaultCommercialPrice. Creates missing numbers only. |
| PATCH | `/projects/:projectId/lots/:lotId` | admin/subadmin/content | area, price, status, ventorName, soldBy |
| PATCH | `/projects/:projectId/lots/bulk-status` | admin/subadmin/content | `{ lotIds, status, ventorName?, soldBy? }` |
| POST | `/projects/:projectId/lots/import` | admin/subadmin/content | multipart `file` (.xlsx), `?kind=lot\|commercial`. Headers: nLots, area, price, ventor, status (`V` sold, `S` hold, `C` locked). Upsert by number. |

Project inventory config fields (PATCH `/projects/:id`): `nLots`, `nCommercialSpaces`, `baseLotArea`, `baseCommercialArea`, `defaultLotPrice`, `defaultCommercialPrice`.
