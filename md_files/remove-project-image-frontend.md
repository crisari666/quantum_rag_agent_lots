# Frontend: Remove project image

Use this spec for the Cursor agent when implementing the “remove image from project” flow in the frontend.

## API contract

- **Method:** `DELETE`
- **URL:** `{baseUrl}/projects/:projectId/images/:imageName`
- **Path params:**
  - `projectId` (string): MongoDB ObjectId of the project.
  - `imageName` (string): Stored image filename (e.g. `507f1f77bcf86cd799439011_1709452800000.webp`). Must match exactly a value in the project’s `images` array. Use encodeURIComponent when building the URL if the name is dynamic.
- **Success (200):**
  - Body:
    - `message` (string): e.g. `"Image removed successfully"`.
    - `imageName` (string): The removed image filename.
    - `project` (object): Updated project (same shape as GET `/projects/:id`), with `images` no longer containing `imageName`.
- **Errors:**
  - **404:** Project not found or image not in project. Handle by showing a clear message and optionally refreshing project data.

## Implementation notes

1. **Calling the API**
   - Build URL: `DELETE /projects/${projectId}/images/${encodeURIComponent(imageName)}`.
   - No request body.
   - Use the same base URL and auth (if any) as other project endpoints.

2. **UI flow**
   - Trigger: e.g. “Remove” / trash icon on a project image (when viewing/editing a project).
   - Before calling: optionally confirm with the user (e.g. “Remove this image?”).
   - On 200: remove the image from local state or refetch the project so the UI shows the updated `project.images` and the image is gone.
   - On 404: show “Project or image not found” (or similar) and refresh project data if needed.

3. **Data shape**
   - `project.images` is an array of strings (filenames). After a successful remove, the returned `project` will have this array without the removed `imageName`.
   - Use the returned `project` to update the UI (e.g. project detail or form state) so the list of images stays in sync.

4. **Edge cases**
   - If the user removes the last image, `project.images` will be `[]`.
   - If the same image is removed twice, the second call will return 404; handle by message and refresh.

## Example request (conceptual)

```http
DELETE /projects/507f1f77bcf86cd799439011/images/507f1f77bcf86cd799439011_1709452800000.webp
```

## Example success response (200)

```json
{
  "message": "Image removed successfully",
  "imageName": "507f1f77bcf86cd799439011_1709452800000.webp",
  "project": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Lote Norte",
    "images": [],
    "amenities": [],
    "...": "..."
  }
}
```

Use this document as the single source of truth for the remove-project-image frontend implementation.
