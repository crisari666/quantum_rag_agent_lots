# Projects: `separation`, `lotOptions`, and `slug` (frontend / agent integration)

This document describes project fields **`separation`**, **`lotOptions`**, and **`slug`** for create, update, and read responses. Use it when wiring forms, admin UIs, or agents that call the Omega RAG **Projects** API.

## Base URL

- Global API prefix: `/rag`
- Projects routes: `/rag/projects`

## Field semantics

| Field | Type | Description |
|--------|------|-------------|
| `slug` | `string` (optional) | URL-friendly identifier, **unique among non-deleted projects** when set. Lowercase **kebab-case**: letters and digits, segments separated by single hyphens (e.g. `lote-norte`, `fraccion-2024`). Max length **120**. Omit on create if you do not use public URLs by slug. |
| `separation` | `number` | Non-negative value representing separation for the development (e.g. distance between lots). **Exact business meaning is product-defined** (meters, feet, etc.); keep labels consistent in the UI. |
| `lotOptions` | `{ area: number; price: number }[]` | List of purchasable lot variants. Each item has **`area`** (non-negative; e.g. m²) and **`price`** (non-negative sale price for that option). Subdocuments are stored **without** MongoDB `_id` on each element. |

Defaults when **omitted on create**:

- `slug` → not stored (no field); multiple projects may have no slug (sparse unique index).
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
  "slug": "lote-norte",
  "separation": 8,
  "lotOptions": [
    { "area": 200, "price": 450000 },
    { "area": 250, "price": 520000 }
  ]
}
```

- **`slug`**, **`separation`**, and **`lotOptions`** are **optional** on create.
- Empty or whitespace-only `slug` in the body is treated as **omitted** (no slug stored).
- Send numbers as JSON numbers (not strings). This API uses `class-transformer` (e.g. `@Type(() => Number)`) for numeric fields where applicable.

**Duplicate slug (409):** If another non-deleted project already uses the same `slug`, the API responds with **409 Conflict** and a message such as `Project slug "lote-norte" is already in use`.

## Update project (`PATCH /rag/projects/:id`)

All body fields are optional. Send only what changes.

```json
{
  "slug": "lote-norte-v2",
  "separation": 10,
  "lotOptions": [
    { "area": 180, "price": 400000 }
  ]
}
```

**`slug` on update:**

- Omit `slug` → leave the current slug unchanged.
- Send a non-empty slug → normalized to trimmed lowercase; must match the kebab-case rules and be unique (same **409** as create if taken by another project).
- Send **`"slug": ""`** (empty string) → **removes** the slug from the project (`$unset` in MongoDB).

**Replacing `lotOptions`:** The array in the payload **replaces the entire stored list**. To clear all options, send `"lotOptions": []`. To keep existing options unchanged, **omit** `lotOptions` from the body (prefer omit or `[]` over ambiguous `null` handling in clients).

## Read project (`GET /rag/projects`, `GET /rag/projects/:id`)

Responses include the stored project document. Example shape:

```json
{
  "_id": "...",
  "title": "...",
  "slug": "lote-norte",
  "separation": 8,
  "lotOptions": [
    { "area": 200, "price": 450000 }
  ]
}
```

Older documents may omit `slug`, `separation`, or `lotOptions` until updated. Suggested UI fallbacks:

- Missing `slug` → no public slug path (or hide slug-based links).
- Missing `separation` → treat as **`0`**.
- Missing `lotOptions` → treat as **`[]`**.

## Validation (400)

- **`slug`**: when present and non-empty after trim, must match lowercase kebab-case (regex conceptually: segments of `a-z` / digits separated by single `-`, max **120** characters). Leading/trailing hyphens or double hyphens are invalid.
- **`separation`**, **`lotOptions[].area`**, and **`lotOptions[].price`** must be **numbers ≥ 0**.
- Each **`lotOptions`** element must include both **`area`** and **`price`**.
- Invalid shapes return **400** with the usual Nest validation error payload.

## Conflict (409)

- **`slug`** already used by another non-deleted project on **POST** `/rag/projects` or **PATCH** `/rag/projects/:id`.

## Swagger

Open **`/api`** and inspect **Projects** → `POST /rag/projects` and `PATCH /rag/projects/{id}` for full schemas (`CreateProjectDto`, `UpdateProjectDto`, nested `ProjectLotOptionDto`).
