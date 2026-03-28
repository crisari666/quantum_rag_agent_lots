# Project card image, horizontal images, and vertical videos

This document describes the project fields `cardProject`, `horizontalImages`, and `verticalVideos`, and the HTTP endpoints used to upload and remove files. It complements [project-files-upload-endpoints.md](./project-files-upload-endpoints.md).

## Base URL

- API global prefix: `/rag`
- Module route: `/projects`

Full base path: `/rag/projects`

## Stored values

All upload endpoints persist **filenames** (not full URLs). Clients resolve public URLs using the static uploads prefix (see [project-files-upload-endpoints.md](./project-files-upload-endpoints.md) — typically `/uploads/` plus the filename).

| Field | Type | Purpose |
|--------|------|---------|
| `cardProject` | `string` | Single image used as the project card in listings. Replaced on each card upload. |
| `horizontalImages` | `string[]` | Landscape-oriented gallery or banner images. |
| `verticalVideos` | `string[]` | Portrait-oriented promotional videos. |

These fields are also optional on **POST** `/rag/projects` (create) and **PATCH** `/rag/projects/:id` (update) when passing URL strings in JSON — same pattern as `images`.

## File naming (after upload)

- **Card image** (single-file document): `card_project_[project_name].[extension]` — images are compressed to WebP when uploaded as raster images (same behavior as reel/plane image handling).
- **Horizontal images**: `horizontal_image_[project_name]_[timestamp]_[optional_index].webp` — compressed to WebP.
- **Vertical videos**: `vertical_video_[project_name]_[timestamp]_[optional_index].[extension]` — extension comes from the original filename (e.g. `mp4`).

## 1) Upload card image (`cardProject`)

Replaces any previously stored card image file (old file is deleted when a new one is saved).

- **Method**: `POST`
- **Path**: `/rag/projects/:id/card-project`
- **Content-Type**: `multipart/form-data`
- **Body field**: `file` (binary, required)
- **Allowed MIME types**: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
- **Max size**: 5 MB
- **Response (201)**: `message`, `fileName`, `project` (updated; `cardProject` set to the new filename)

## 2) Delete card image (`cardProject`)

Clears `cardProject` and deletes the stored file from disk when a filename was set. If the card was already empty, the project is still returned (200).

- **Method**: `DELETE`
- **Path**: `/rag/projects/:id/card-project`
- **Response (200)**: `message`, `project` (updated; `cardProject` is `''`)

## 3) Upload one horizontal image

- **Method**: `POST`
- **Path**: `/rag/projects/:id/horizontal-images`
- **Content-Type**: `multipart/form-data`
- **Body field**: `file` (binary, required)
- **Allowed MIME types**: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
- **Max size**: 5 MB
- **Response (201)**: `message`, `imageName`, `project` (updated)

## 4) Upload multiple horizontal images

- **Method**: `POST`
- **Path**: `/rag/projects/:id/horizontal-images/multiple`
- **Content-Type**: `multipart/form-data`
- **Body field**: `files` (array of binaries, required; up to 20 files)
- **Allowed MIME types**: same as single horizontal image
- **Max size per file**: 5 MB
- **Response (201)**: `message`, `imageNames`, `project` (updated)

## 5) Delete one horizontal image

- **Method**: `DELETE`
- **Path**: `/rag/projects/:id/horizontal-images/:imageName`
- **Path parameter**: `imageName` — exact stored filename (URL-encoded if needed)
- **Response (200)**: `message`, `imageName`, `project` (updated)

## 6) Upload one vertical video

- **Method**: `POST`
- **Path**: `/rag/projects/:id/vertical-videos`
- **Content-Type**: `multipart/form-data`
- **Body field**: `file` (binary, required). Original filename must include an extension (e.g. `promo.mp4`).
- **Allowed MIME types**: `video/mp4`, `video/webm`, `video/quicktime`, `video/x-msvideo`
- **Max size**: 100 MB
- **Response (201)**: `message`, `videoName`, `project` (updated)

## 7) Upload multiple vertical videos

- **Method**: `POST`
- **Path**: `/rag/projects/:id/vertical-videos/multiple`
- **Content-Type**: `multipart/form-data`
- **Body field**: `files` (array of binaries, required; up to 20 files). Each original filename must include an extension.
- **Allowed MIME types**: same as single vertical video
- **Max size per file**: 100 MB
- **Response (201)**: `message`, `videoNames`, `project` (updated)

## 8) Delete one vertical video

- **Method**: `DELETE`
- **Path**: `/rag/projects/:id/vertical-videos/:videoName`
- **Path parameter**: `videoName` — exact stored filename
- **Response (200)**: `message`, `videoName`, `project` (updated)

## Error responses

- **400**: Missing file, invalid MIME type, file too large, or missing file extension (vertical video uploads).
- **404**: Project not found, or filename not present in `horizontalImages` / `verticalVideos` (per-item delete).

## Swagger

Interactive definitions are available under the **Projects** tag at `/api` (Swagger UI).
