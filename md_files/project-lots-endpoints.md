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
| POST | `/projects/:projectId/lots/import` | admin/subadmin/content | multipart `file` (.xlsx), `?kind=lot\|commercial`. Headers: nLots, area, price, ventor, status (`V` sold, `S` hold, `C` locked); optional stage, stageName, stageOrder. Upsert by `{ kind, stageKey, number }`. Missing stage → `default` / General / 0. Price accepts COP text like `$ 52.000.000`. |

Unique lot key: `{ projectId, kind, stageKey, number }`.

Project inventory config fields (PATCH `/projects/:id`): `nLots`, `nCommercialSpaces`, `baseLotArea`, `baseCommercialArea`, `defaultLotPrice`, `defaultCommercialPrice`.
