# Lovable / frontend: list project releases + show images

Short spec for building a **list UI** (e.g. in [Lovable](https://lovable.dev)) against **omega_rag**. Full API reference: [project-release-frontend.md](./project-release-frontend.md).

---

## 1) Base URL and auth

- **API root** (typical): `https://<your-omega-rag-host>/rag`  
  All paths below are relative to that root unless you configure a single env like `VITE_RAG_API_BASE=https://host/rag`.

- **Header:** same as rest of RAG API — send office JWT in header **`TOKEN`** (unless deployment makes this route public).

Example fetch helper:

```ts
const headers = {
  'Content-Type': 'application/json',
  TOKEN: userJwt, // from your auth layer
};
```

---

## 2) List endpoint (required `status`)

| Item | Value |
|------|--------|
| **Method** | `GET` |
| **Path** | `/project-releases` → full URL: `{BASE}/project-releases?status=...` |
| **Query** | **`status`** required: `enabled` or `disabled` (case-insensitive) |

- **Public / catalog UI:** call once with `status=enabled` (only visible releases).
- **Admin UI:** two tabs or two requests — `status=enabled` and `status=disabled`. Omitting `status` returns **400** — do not call bare `/project-releases`.

### Examples

```http
GET /rag/project-releases?status=enabled
GET /rag/project-releases?status=disabled
```

### Success: **200** — JSON array

Each item includes at least:

| Field | Use in UI |
|--------|-----------|
| `_id` | Key, detail link, later PATCH/upload |
| `title` | Card title |
| `location` | Subtitle / line under title |
| `description` | Body text (truncate in list) |
| `googleMapLocation` | Link or embed URL for map block |
| `images` | `string[]` of **filenames only** — must turn into full image URLs (next section) |
| `enabled` | boolean |
| `status` | `"enabled"` \| `"disabled"` — always present; matches filter you sent |
| `createdAt`, `updatedAt` | Optional meta |

---

## 3) Turn `images[]` into `<img src>`

Storage path on server: **`project-releases/`** under uploads bucket. Static HTTP prefix from backend: **`/rag/uploads/`** (see `UPLOADS_STATIC_URL_PREFIX`).

**Image URL** (same host as API in typical setup):

```text
{ORIGIN}/rag/uploads/project-releases/{filename}
```

- **`{ORIGIN}`** — scheme + host of omega_rag (e.g. `https://api.example.com`). If SPA on different origin, use full absolute URL to RAG host (watch CORS for `<img>` — usually OK; for `fetch` you need CORS + `TOKEN`).

**Helper (TypeScript):**

```ts
function projectReleaseImageUrl(
  ragOrigin: string, // no trailing slash, e.g. "https://rag.example.com"
  fileName: string,
): string {
  const base = ragOrigin.replace(/\/$/, '');
  const path = `/rag/uploads/project-releases/${encodeURIComponent(fileName)}`;
  return `${base}${path}`;
}
```

**In JSX / Lovable:**

```tsx
{(release.images ?? []).map((fileName) => (
  <img
    key={fileName}
    src={projectReleaseImageUrl(RAG_ORIGIN, fileName)}
    alt={release.title}
    loading="lazy"
    className="rounded-md object-cover w-full h-48"
  />
))}
```

- Empty `images` → show placeholder or hide gallery row.
- Filenames are server-generated (e.g. `project_release_image_*_*.webp`); do not guess paths — always use prefix above.

---

## 4) Lovable implementation checklist

1. **Env:** `RAG_ORIGIN` or `VITE_RAG_ORIGIN` = omega_rag origin (no path).
2. **List fetch:** `GET ${RAG_ORIGIN}/rag/project-releases?status=enabled` with `TOKEN` header.
3. **Parse:** response is **array** — `map` to cards.
4. **Images:** map `release.images` with `projectReleaseImageUrl` for each `<img>` or carousel slide.
5. **Maps link:** use `release.googleMapLocation` as `href` on “View on map” or iframe `src` if embed-safe.
6. **Errors:** **400** if `status` missing; show message. **401/403** if token bad — redirect login.

---

## 5) Optional: detail before edit

Single row: `GET /rag/project-releases/:id` — same fields + `status` + `images`. Same image URL rule.

---

## 6) Minimal response shape (mental model)

```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Spring launch",
    "googleMapLocation": "https://maps.google.com/?q=...",
    "location": "CDMX",
    "description": "…",
    "images": ["project_release_image_spring_launch_1709452800000.webp"],
    "enabled": true,
    "status": "enabled",
    "createdAt": "2026-04-01T12:00:00.000Z",
    "updatedAt": "2026-04-01T12:00:00.000Z"
  }
]
```

**Display rule:** one card per array element; image grid = `images.length` columns or horizontal scroll; first image optional as “hero” thumb.
