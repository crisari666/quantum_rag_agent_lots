# Project releases — frontend integration

This document describes the **Project release** HTTP API for admin or public UIs: create/update, enable/disable, list (with **required** status filter), get by id, and image upload/remove.

## Base URL

- API global prefix: **`/rag`**
- Module route: **`/project-releases`**

Full base path: **`/rag/project-releases`**

Use the same **`TOKEN`** header (RS256 / office back) as other protected routes unless your deployment marks these public.

## Stored images

- `images` on each release is an array of **filenames** (strings), not full URLs.
- Files are written under the uploads bucket subdirectory **`project-releases`** (unless `UPLOAD_DIR` overrides the uploads root — same behavior as project images).
- Resolve a browser URL: static prefix **`/rag/uploads/`** (see `UPLOADS_STATIC_URL_PREFIX` in `src/config/upload-bucket.constants.ts`) plus the path under the uploads bucket. Files live in **`project-releases/`**, so: **`/rag/uploads/project-releases/<filename>`**. Example: `project_release_image_spring_launch_1709452800000.webp` → `GET /rag/uploads/project-releases/project_release_image_spring_launch_1709452800000.webp`.

---

## Data shape

| Field | Type | Notes |
|--------|------|--------|
| `title` | string | Required on create |
| `googleMapLocation` | string | Required on create (e.g. Google Maps URL or embed URL) |
| `location` | string | Required on create (human-readable place) |
| `description` | string | Optional; defaults to `""` |
| `images` | `string[]` | Filenames; usually populated via upload endpoint |
| `enabled` | boolean | Business flag; default **`true`** on create when omitted |
| `status` | `"enabled"` \| `"disabled"` | **Present on every API response object** in this module (derived from `enabled`) |
| `_id`, `createdAt`, `updatedAt` | Mongo / ISO dates | Standard document fields |

List and detail responses always include both **`enabled`** and **`status`** so the UI can show or filter consistently.

---

## 1) Create project release

| Item | Value |
|------|--------|
| **Method** | `POST` |
| **Path** | `/rag/project-releases` |
| **Content-Type** | `application/json` |

### Body (JSON)

| Field | Required | Type | Notes |
|--------|------------|------|--------|
| `title` | yes | string | |
| `googleMapLocation` | yes | string | |
| `location` | yes | string | |
| `description` | no | string | |
| `images` | no | `string[]` | Rare: seed filenames if files already exist server-side |
| `enabled` | no | boolean | Defaults to **`true`** when omitted |

### Responses

| Status | Description |
|--------|-------------|
| **201** | Created release object (includes `status`) |
| **400** | Validation error |

### Example

```http
POST /rag/project-releases
Content-Type: application/json

{
  "title": "Spring launch",
  "googleMapLocation": "https://maps.google.com/?q=19.4,-99.1",
  "location": "CDMX",
  "description": "New phase opening."
}
```

---

## 2) Update project release

| Item | Value |
|------|--------|
| **Method** | `PATCH` |
| **Path** | `/rag/project-releases/:id` |
| **Content-Type** | `application/json` |

All body fields optional; only sent fields are updated.

| Field | Type |
|--------|------|
| `title` | string |
| `googleMapLocation` | string |
| `location` | string |
| `description` | string |
| `images` | `string[]` | Replaces entire array when provided |
| `enabled` | boolean | Prefer dedicated enable path (below) if you only toggle visibility |

### Responses

| Status | Description |
|--------|-------------|
| **200** | Updated release (includes `status`) |
| **400** | Validation error |
| **404** | Release not found |

---

## 3) Enable or disable

| Item | Value |
|------|--------|
| **Method** | `PATCH` |
| **Path** | `/rag/project-releases/:id/enabled/:enable` |
| **Path params** | `id` — ObjectId; `enable` — literal **`true`** or **`false`** (case-insensitive) |

### Responses

| Status | Description |
|--------|-------------|
| **200** | Updated release (`enabled` + `status`) |
| **400** | `enable` not `true` / `false` |
| **404** | Release not found |

```http
PATCH /rag/project-releases/507f1f77bcf86cd799439011/enabled/true
PATCH /rag/project-releases/507f1f77bcf86cd799439011/enabled/false
```

---

## 4) List project releases (**`status` query required**)

| Item | Value |
|------|--------|
| **Method** | `GET` |
| **Path** | `/rag/project-releases?status=enabled` or `?status=disabled` |

### Query

| Param | Required | Values |
|--------|------------|--------|
| `status` | **yes** | `enabled` — only `enabled: true`; `disabled` — only `enabled: false` |

Values are compared case-insensitively (`Enabled` works).

### Responses

| Status | Description |
|--------|-------------|
| **200** | Array of releases; **each element includes `status`** (`enabled` \| `disabled`) |
| **400** | `status` missing or not `enabled` / `disabled` |

### Examples

```http
GET /rag/project-releases?status=enabled
GET /rag/project-releases?status=disabled
```

**400** if called as `GET /rag/project-releases` with no query.

---

## 5) Get project release by id

| Item | Value |
|------|--------|
| **Method** | `GET` |
| **Path** | `/rag/project-releases/:id` |

### Responses

| Status | Description |
|--------|-------------|
| **200** | Single release (includes `status`) |
| **404** | Not found |

---

## 6) Upload one image

| Item | Value |
|------|--------|
| **Method** | `POST` |
| **Path** | `/rag/project-releases/:id/images` |
| **Content-Type** | `multipart/form-data` |
| **Field** | `file` (binary, required) |

### Allowed MIME types

- `image/jpeg`, `image/jpg`, `image/png`, `image/webp`

### Max size

- Per backend constant `MAX_IMAGE_FILE_SIZE_BYTES` (currently **10 MB** in this repo — verify in `src/projects/constants/image-upload.constants.ts`).

### Responses

| Status | Description |
|--------|-------------|
| **201** | Body: `message`, `imageName`, `release` (full release with new `images` entry and `status`) |
| **400** | No file / wrong type / too large |
| **404** | Release not found |

### Frontend notes

1. Build `FormData`, append `file` under the key **`file`**.
2. On success, use returned `release.images` and `release.status` to refresh UI (or merge `release` into your store).
3. Image is compressed server-side (WebP); stored filename pattern includes `project_release_image_` prefix and release title slug.

---

## 7) Remove one image

| Item | Value |
|------|--------|
| **Method** | `DELETE` |
| **Path** | `/rag/project-releases/:id/images/:imageName` |
| **Path params** | `id` — ObjectId; `imageName` — exact filename from `release.images` |

Use **`encodeURIComponent(imageName)`** in the path when the name contains characters that must be escaped.

### Responses

| Status | Description |
|--------|-------------|
| **200** | Body: `message`, `imageName`, `release` (updated; `images` no longer contains that name) |
| **404** | Release not found, or image not in `images` |

### UI flow

- Optional confirm (“Remove this image?”).
- On **200**: update local state from `release` or refetch.
- On **404**: show not-found message; refetch release if needed.
- Last image removed → `images: []`.

### Example (conceptual)

```http
DELETE /rag/project-releases/507f1f77bcf86cd799439011/images/project_release_image_spring_launch_1709452800000.webp
```

---

## Summary table

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/project-releases` | Create |
| `PATCH` | `/project-releases/:id` | Partial update |
| `PATCH` | `/project-releases/:id/enabled/true` | Enable |
| `PATCH` | `/project-releases/:id/enabled/false` | Disable |
| `GET` | `/project-releases?status=enabled` | List enabled only |
| `GET` | `/project-releases?status=disabled` | List disabled only |
| `GET` | `/project-releases/:id` | Detail |
| `POST` | `/project-releases/:id/images` | Multipart `file` |
| `DELETE` | `/project-releases/:id/images/:imageName` | Remove file + DB ref |

---

## Example list response (200)

```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Spring launch",
    "googleMapLocation": "https://maps.google.com/?q=...",
    "location": "CDMX",
    "description": "New phase.",
    "images": ["project_release_image_spring_launch_1709452800000.webp"],
    "enabled": true,
    "status": "enabled",
    "createdAt": "2026-04-01T12:00:00.000Z",
    "updatedAt": "2026-04-01T12:00:00.000Z"
  }
]
```

## Example upload success (201)

```json
{
  "message": "Image uploaded successfully",
  "imageName": "project_release_image_spring_launch_1709452800000.webp",
  "release": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Spring launch",
    "images": ["project_release_image_spring_launch_1709452800000.webp"],
    "enabled": true,
    "status": "enabled",
    "...": "..."
  }
}
```
