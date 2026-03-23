# Project Files Upload Endpoints

This document describes the backend endpoints to upload and delete project files for frontend integration.

Base route prefix:
- API global prefix: `/rag`
- Module route: `/projects`

Final base path:
- `/rag/projects`

## File Storage Rules

- Files are stored on disk inside the `uploads` bucket (`uploads/projects` directory by default).
- Static URL prefix is `/uploads/`.
- Document file name pattern:
  - `[file_type]_[project_name].[extension]`
  - Examples:
    - `reel_video_lote_norte.mp4`
    - `plane_lote_norte.pdf`
    - `brochure_lote_norte.pdf`
- Image file names use:
  - `image_[project_name]_[timestamp]_[optional_index].webp`
  - Images are compressed to `webp` before saving.

## 1) Upload One Image

- **Method**: `POST`
- **Path**: `/rag/projects/:id/images`
- **Content-Type**: `multipart/form-data`
- **Body field**:
  - `file` (binary, required)
- **Allowed MIME types**:
  - `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
- **Max size**:
  - 5 MB
- **Response (201)**:
  - `message`
  - `imageName`
  - `project` (updated)

## 2) Upload Multiple Images

- **Method**: `POST`
- **Path**: `/rag/projects/:id/images/multiple`
- **Content-Type**: `multipart/form-data`
- **Body field**:
  - `files` (array of binary files, required)
- **Allowed MIME types**:
  - `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
- **Max size per file**:
  - 5 MB
- **Response (201)**:
  - `message`
  - `imageNames` (array of new file names)
  - `project` (updated)

## 3) Delete One Image

- **Method**: `DELETE`
- **Path**: `/rag/projects/:id/images/:imageName`
- **Response (200)**:
  - `message`
  - `imageName`
  - `project` (updated)

## 4) Upload Reel Video

- **Method**: `POST`
- **Path**: `/rag/projects/:id/reel-video`
- **Content-Type**: `multipart/form-data`
- **Body field**:
  - `file` (binary, required)
- **Allowed MIME types**:
  - `video/mp4`, `video/webm`, `video/quicktime`, `video/x-msvideo`
- **Max size**:
  - 100 MB
- **Project field updated**:
  - `reelVideo`
- **Response (201)**:
  - `message`
  - `fileName`
  - `project` (updated)

## 5) Upload Plane File

- **Method**: `POST`
- **Path**: `/rag/projects/:id/plane`
- **Content-Type**: `multipart/form-data`
- **Body field**:
  - `file` (binary, required)
- **Allowed MIME types**:
  - `application/pdf`, `image/jpeg`, `image/jpg`, `image/png`
- **Max size**:
  - 20 MB
- **Project field updated**:
  - `plane`
- **Response (201)**:
  - `message`
  - `fileName`
  - `project` (updated)

## 6) Upload Brochure File

- **Method**: `POST`
- **Path**: `/rag/projects/:id/brochure`
- **Content-Type**: `multipart/form-data`
- **Body field**:
  - `file` (binary, required)
- **Allowed MIME types**:
  - `application/pdf`
- **Max size**:
  - 20 MB
- **Project field updated**:
  - `brochure`
- **Response (201)**:
  - `message`
  - `fileName`
  - `project` (updated)

## Project Schema Fields

The project schema now includes:
- `images: string[]`
- `reelVideo: string`
- `plane: string`
- `brochure: string`

These fields store uploaded filenames.
