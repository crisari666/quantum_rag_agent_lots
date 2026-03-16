# Projects API (`/projects`)

| Method | Path | Request | Responses |
|--------|------|---------|-----------|
| POST | `/projects` | Body: `CreateProjectDto` — title, description?, location, city?, state?, country?, lat, lng, priceSell, commissionPercentage, commissionValue, amenities?, images? | 201, 400 |
| PATCH | `/projects/:id` | Param: `id` (ObjectId). Body: `UpdateProjectDto` — same fields, all optional (incl. description, city, state, country) | 200, 400, 404 |
| GET | `/projects` | — | 200 (array) |
| GET | `/projects/:id` | Param: `id` (ObjectId) | 200, 404 |
| DELETE | `/projects/:id` | Param: `id` (ObjectId). Soft delete | 200, 404 |
| POST | `/projects/:id/images` | Param: `id`. Body: `multipart/form-data`, field `file` (image: jpeg/png/webp, max 5MB). Stored as `projectId_timestamp.webp`, appended to project.images | 201, 400, 404 |
| DELETE | `/projects/:id/images/:imageName` | Param: `id` (ObjectId), `imageName` (e.g. `projectId_timestamp.webp`). Removes image from project and deletes file from storage | 200, 404 |

**Note:** Route order: `GET admin/test` before `GET :id` to avoid "admin" as id.

### Response examples

**POST /projects** (201):
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "title": "Lote Norte",
  "description": "Residential lots with infrastructure and easy credit.",
  "location": "Ciudad de México",
  "city": "Ciudad de México",
  "state": "CDMX",
  "country": "México",
  "lat": 19.4326,
  "lng": -99.1332,
  "priceSell": 1500000,
  "commissionPercentage": 5,
  "commissionValue": 75000,
  "amenities": [],
  "images": [],
  "deleted": false,
  "createdAt": "2025-03-03T12:00:00.000Z",
  "updatedAt": "2025-03-03T12:00:00.000Z"
}
```

**GET /projects** (200): array of the same shape; each item may have `amenities` populated as `[{ "_id": "...", "title": "Parking" }]`.

**GET /projects/:id** (200): single object like above, with `amenities` populated.

**PATCH /projects/:id** (200): updated project, same shape.

**DELETE /projects/:id** (200): soft-deleted project (same shape, `deleted: true`).

**POST /projects/:id/images** (201):
```json
{
  "message": "Image uploaded successfully",
  "imageName": "507f1f77bcf86cd799439011_1709452800000.webp",
  "project": { "_id": "...", "title": "...", "images": ["...webp"], ... }
}
```

**DELETE /projects/:id/images/:imageName** (200):
```json
{
  "message": "Image removed successfully",
  "imageName": "507f1f77bcf86cd799439011_1709452800000.webp",
  "project": { "_id": "...", "title": "...", "images": ["..."], ... }
}
```
404 if project not found or image not in project.

**GET /projects/admin/test** (200): `{ "status": "ok" }`
