# Frontend Guide: Download Project Resources by Attribute

Use these endpoints to download files already uploaded in project attributes (`brochure`, `plane`, `reelVideo`, `cardProject`, `verticalVideos`).

## Endpoint

- Method: `GET`
- Path: `/rag/projects/:projectId/resources/:attribute/download`
- `attribute` allowed values:
  - `brochure`
  - `plane`
  - `reelVideo`
  - `cardProject`
  - `verticalVideos` (requires `?fileName=<stored-file-name>`)

The API returns a binary response and sets:

- `Content-Type: application/octet-stream`
- `Content-Disposition: attachment; filename="<stored-file-name>"`

## Vertical media in attribute endpoint

When you use `attribute=verticalVideos`, include the file name as query param:

- `GET /rag/projects/:projectId/resources/verticalVideos/download?fileName=<stored-file-name>`

## Dedicated vertical media endpoint (`verticalVideos`)

- Method: `GET`
- Path: `/rag/projects/:projectId/resources/vertical-videos/:fileName/download`
- Use this for files stored in `project.verticalVideos[]` (array).

## How to decide the attribute in frontend

Read the selected project object and use the related field:

- Project field `brochure` -> attribute `brochure`
- Project field `plane` -> attribute `plane`
- Project field `reelVideo` -> attribute `reelVideo`
- Project field `cardProject` -> attribute `cardProject`

If the field is empty (`""`), do not show the download button for that resource.

For `verticalVideos`, render one download action per file in the array.

## Recommended UI behavior

1. Render one download action per available field.
2. Build URL with project id and attribute.
3. Trigger browser download (anchor tag or blob download flow).
4. Show error toast on `400` or `404`.

## React/TypeScript example (direct browser download)

```ts
type DownloadAttribute =
  | 'brochure'
  | 'plane'
  | 'reelVideo'
  | 'cardProject'
  | 'verticalVideos';

function buildProjectResourceDownloadUrl(params: {
  apiBaseUrl: string;
  projectId: string;
  attribute: DownloadAttribute;
  fileName?: string;
}): string {
  const { apiBaseUrl, projectId, attribute, fileName } = params;
  const baseUrl = `${apiBaseUrl}/rag/projects/${projectId}/resources/${attribute}/download`;
  if (attribute !== 'verticalVideos') {
    return baseUrl;
  }
  if (!fileName) {
    throw new Error('fileName is required when attribute is verticalVideos');
  }
  return `${baseUrl}?fileName=${encodeURIComponent(fileName)}`;
}

function triggerProjectResourceDownload(params: {
  apiBaseUrl: string;
  projectId: string;
  attribute: DownloadAttribute;
  fileName?: string;
}): void {
  const { apiBaseUrl, projectId, attribute, fileName } = params;
  const url = buildProjectResourceDownloadUrl({
    apiBaseUrl,
    projectId,
    attribute,
    fileName,
  });
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
```

## React/TypeScript example for `verticalVideos[]`

```ts
function buildVerticalMediaDownloadUrl(
  apiBaseUrl: string,
  projectId: string,
  fileName: string,
): string {
  return `${apiBaseUrl}/rag/projects/${projectId}/resources/vertical-videos/${encodeURIComponent(fileName)}/download`;
}

function triggerVerticalMediaDownload(
  apiBaseUrl: string,
  projectId: string,
  fileName: string,
): void {
  const url = buildVerticalMediaDownloadUrl(apiBaseUrl, projectId, fileName);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
```

## Optional fetch example (when auth header is required)

```ts
type DownloadAttribute =
  | 'brochure'
  | 'plane'
  | 'reelVideo'
  | 'cardProject'
  | 'verticalVideos';

async function downloadProjectResourceWithToken(params: {
  apiBaseUrl: string;
  projectId: string;
  attribute: DownloadAttribute;
  fileName?: string;
  token: string;
}): Promise<void> {
  const { apiBaseUrl, projectId, attribute, fileName, token } = params;
  const baseUrl = `${apiBaseUrl}/rag/projects/${projectId}/resources/${attribute}/download`;
  const url =
    attribute === 'verticalVideos'
      ? `${baseUrl}?fileName=${encodeURIComponent(fileName ?? '')}`
      : baseUrl;
  const response = await fetch(
    url,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to download resource: ${response.status}`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `${attribute}`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}
```

## Error handling

- `400 Bad Request`: invalid attribute was sent, or `fileName` was missing for `verticalVideos`.
- `404 Not Found`: project not found, attribute has no file, file name is not in `verticalVideos`, or file not in storage.

Show a user-friendly message, for example:

- `"This resource is not available for download yet."`
