# Projects: enabled flag & list filter

## Field

- **`enabled`** (boolean): On each project document. New projects are created with `enabled: false` until toggled via the endpoint below.

---

## PATCH — enable or disable a project

Sets `enabled` to `true` or `false` for a non-deleted project.

| Item | Value |
|------|--------|
| **Method** | `PATCH` |
| **URL** | `{baseUrl}/projects/:projectId/enabled/:enable` |
| **Path params** | `projectId` — MongoDB ObjectId of the project |
| | `enable` — literal string **`true`** or **`false`** (case-insensitive) |

### Responses

| Status | Description |
|--------|-------------|
| **200** | Updated project (same shape as GET `/projects/:id`), including `enabled` |
| **400** | `enable` is not `true` or `false` |
| **404** | Project not found or soft-deleted |

### Examples

```http
PATCH /projects/507f1f77bcf86cd799439011/enabled/true
PATCH /projects/507f1f77bcf86cd799439011/enabled/false
```

**200 example** (truncated):

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "title": "Lote Norte",
  "enabled": true,
  "deleted": false,
  "images": [],
  "amenities": []
}
```

---

## GET — list projects (optional `enable` query)

Lists **non-deleted** projects. **`enable` is optional**; if omitted, only **enabled** projects are returned (same as `enable=true`).

| Query `enable` | Result |
|----------------|--------|
| *(omitted or empty)* | Only projects with `enabled: true` |
| **`true`** | Only projects with `enabled: true` |
| **`false`** | Only projects with `enabled: false` |
| **`all`** | All non-deleted projects (any `enabled`) |

Values are case-insensitive when provided.

| Item | Value |
|------|--------|
| **Method** | `GET` |
| **URL** | `{baseUrl}/projects` or `{baseUrl}/projects?enable=<true\|false\|all>` |

### Responses

| Status | Description |
|--------|-------------|
| **200** | Array of projects (each includes `enabled`) |
| **400** | `enable` present but not `true`, `false`, or `all` |

### Examples

```http
GET /projects
GET /projects?enable=true
GET /projects?enable=false
GET /projects?enable=all
```

---

## Consumer-facing catalogs

Call **`GET /projects`** with no query — enabled projects only.

---

## Summary table

| Method | Path | Notes |
|--------|------|--------|
| `PATCH` | `/projects/:projectId/enabled/true` | Enable project |
| `PATCH` | `/projects/:projectId/enabled/false` | Disable project |
| `GET` | `/projects` | Enabled only (default) |
| `GET` | `/projects?enable=true` | Enabled only |
| `GET` | `/projects?enable=false` | Disabled only |
| `GET` | `/projects?enable=all` | All non-deleted |
