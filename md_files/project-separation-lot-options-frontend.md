# Projects: `separation` and `lotOptions` (frontend / agent integration)

This document describes the new project fields **`separation`** and **`lotOptions`** for create, update, and read responses. Use it when wiring forms, admin UIs, or agents that call the Omega RAG **Projects** API.

## Base URL

- Global API prefix: `/rag`
- Projects routes: `/rag/projects`

## Field semantics

| Field | Type | Description |
|--------|------|-------------|
| `separation` | `number` | Non-negative value representing separation for the development (e.g. distance between lots). **Exact business meaning is product-defined** (meters, feet, etc.); keep labels consistent in the UI. |
| `lotOptions` | `{ area: number; price: number }[]` | List of purchasable lot variants. Each item has **`area`** (non-negative; e.g. m²) and **`price`** (non-negative sale price for that option). Subdocuments are stored **without** MongoDB `_id` on each element. |

Defaults when **omitted on create**:

- `separation` → `0`
- `lotOptions` → `[]`

## Create project (`POST /rag/projects`)

JSON body (relevant fragment; other required project fields still apply, e.g. `title`, `location`, `lat`, `lng`, `priceSell`, commissions):

```json
{
  "title": "Lote Norte",
  "location": "Ciudad de México",
  "lat": 19.4326,
  "lng": -99.1332,
  "priceSell": 1500000,
  "commissionPercentage": 5,
  "commissionValue": 75000,
  "separation": 8,
  "lotOptions": [
    { "area": 200, "price": 450000 },
    { "area": 250, "price": 520000 }
  ]
}
```

- **`separation`** and **`lotOptions`** are **optional**.
- Send numbers as JSON numbers (not strings). If the client sends strings, enable numeric parsing on the client or rely on a backend that coerces types (this API uses `class-transformer` `@Type(() => Number)` for these fields).

## Update project (`PATCH /rag/projects/:id`)

All body fields are optional. Send only what changes.

```json
{
  "separation": 10,
  "lotOptions": [
    { "area": 180, "price": 400000 }
  ]
}
```

**Replacing `lotOptions`:** The array in the payload **replaces the entire stored list**. To clear all options, send `"lotOptions": []`. To keep existing options unchanged, **omit** `lotOptions` from the body (do not send `null` unless your client stack normalizes it; prefer omit or `[]`).

## Read project (`GET /rag/projects`, `GET /rag/projects/:id`)

Responses include the stored project document. Expect:

```json
{
  "_id": "...",
  "title": "...",
  "separation": 8,
  "lotOptions": [
    { "area": 200, "price": 450000 }
  ]
}
```

Existing documents created **before** this feature may not have these keys until they are updated once; treat missing values as **`separation === 0`** and **`lotOptions === []`** in the UI if needed.

## Validation (400)

- `separation`, `lotOptions[].area`, and `lotOptions[].price` must be **numbers ≥ 0**.
- Each `lotOptions` element must include both **`area`** and **`price`**.
- Invalid shapes or failed validation return **400** with the usual Nest validation error payload.

## Swagger

Open **`/api`** and inspect **Projects** → `POST /rag/projects` and `PATCH /rag/projects/{id}` for the full schemas (`CreateProjectDto`, `UpdateProjectDto`, nested `ProjectLotOptionDto`).
