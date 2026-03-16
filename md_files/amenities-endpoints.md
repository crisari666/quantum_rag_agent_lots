# Amenities API (`/amenities`)

| Method | Path | Request | Responses |
|--------|------|---------|-----------|
| POST | `/amenities` | Body: `{ title: string }` (max 200) | 201, 400 |
| PATCH | `/amenities/:id` | Param: `id` (ObjectId). Body: `{ title?: string }` | 200, 400, 404 |
| GET | `/amenities` | — | 200 (array) |
| GET | `/amenities/:id` | Param: `id` (ObjectId) | 200, 404 |
| GET | `/amenities/admin/test` | — | 200 |

**Note:** `GET admin/test` must be declared before `GET :id`.

### Response examples

**POST /amenities** (201):
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "title": "Parking",
  "createdAt": "2025-03-03T12:00:00.000Z",
  "updatedAt": "2025-03-03T12:00:00.000Z"
}
```

**GET /amenities** (200): array of the same shape.

**GET /amenities/:id** (200): single object like above.

**PATCH /amenities/:id** (200): updated amenity, same shape.

**GET /amenities/admin/test** (200): `{ "status": "ok" }`
