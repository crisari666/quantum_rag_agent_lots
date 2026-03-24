# RAG Ingestion With File Upload or External URL

This document explains the updated ingestion endpoints.  
Now each endpoint accepts one **content** source (for embeddings):
- `rawText`
- uploaded `file`
- `externalUrl` (for large files stored in another host)

Use exactly one content source in a request.

## Source vs content (what the vendor sees)

- **`source`** is the **citation** the assistant returns to vendors (filename, title, or public URL). It is **not** the full document body.
- **`rawText`**, **`file`**, and **`externalUrl`** supply text that is chunked and vectorized only.
- When you **upload a file**, the stored citation defaults to the **uploaded filename** unless you send `source` (e.g. a stable CDN URL you want vendors to open).
- When you use **`externalUrl`** to fetch text, the citation defaults to that URL unless you set `source` to a different public link.

## Base Paths

- API global prefix: `/rag`
- Ingestion controller prefix: `/rag`

Final paths:
- Project ingestion: `/rag/rag/ingestion`
- Global ingestion: `/rag/rag/ingestion/global`

## 1) Project Document Ingestion

- **Method:** `POST`
- **Path:** `/rag/rag/ingestion`
- **Consumes:** `application/json` or `multipart/form-data`

### Required fields
- `projectId` (string)
- `docType` (string)

### Optional fields
- `source` (string): vendor-facing citation; max length 2048
- `rawText` (string)
- `externalUrl` (string URL)
- `file` (binary file, text-based mime types)

### Valid source combinations
- JSON with raw text (set `source` to what vendors should see):
```json
{
  "projectId": "507f1f77bcf86cd799439011",
  "docType": "brochure",
  "source": "https://cdn.example.com/public/brochure.pdf",
  "rawText": "Project details and legal clauses..."
}
```

- JSON with external URL (fetch text from one URL, cite another to vendors):
```json
{
  "projectId": "507f1f77bcf86cd799439011",
  "docType": "brochure",
  "externalUrl": "https://cdn.example.com/docs/brochure.txt",
  "source": "https://cdn.example.com/public/brochure.pdf"
}
```

- Multipart with file:
  - fields: `projectId`, `docType`, optional `source` (override citation; else original filename is used)
  - file field name: `file`

## 2) Global Knowledge Ingestion

- **Method:** `POST`
- **Path:** `/rag/rag/ingestion/global`
- **Consumes:** `application/json` or `multipart/form-data`
- Stores vectors with `projectId = "GLOBAL"`.

### Required fields
- `docType` (string)

### Optional fields
- `source` (string): vendor-facing citation; max length 2048
- `rawText` (string)
- `externalUrl` (string URL)
- `file` (binary file, text-based mime types)

## Response

Successful ingestion:
```json
{
  "message": "Document vectorized successfully",
  "chunks": 8
}
```

Global ingestion adds:
```json
{
  "message": "Document vectorized successfully",
  "chunks": 8,
  "projectId": "GLOBAL"
}
```

## Validation Notes

- If none of `rawText`, `file`, `externalUrl` is provided, API returns `400`.
- Uploaded file must be text-based content type.
- `externalUrl` must return text-based content; binary content is rejected.
