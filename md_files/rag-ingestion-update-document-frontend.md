# Update Ingested Document (Frontend Handoff)

This document describes the endpoint to update an already ingested logical document in the RAG store.

Implementation: `src/rag-agent/ingestion.controller.ts` (`PATCH ingestion`).

## Base path

- Global API prefix: `/rag`
- Ingestion controller: `/rag`
- Full path: `PATCH /rag/rag/ingestion`

## What this endpoint does

1. Finds the existing document chunks by identity:
   - `projectId`
   - `currentDocType`
   - `currentSource`
2. Deletes those existing chunks from Weaviate.
3. Ingests new content (from `rawText`, `externalUrl`, or uploaded `file`).
4. Stores chunks with updated metadata:
   - `newDocType` (or `currentDocType` if omitted)
   - `newSource` (or `currentSource` if omitted)

If no existing chunks match the provided identity, API returns `404`.

## Endpoint contract

| Item | Value |
|------|-------|
| Method | `PATCH` |
| Path | `/rag/rag/ingestion` |
| Consumes | `application/json` or `multipart/form-data` |

## Request fields

| Field | Required | Type | Description |
|------|----------|------|-------------|
| `projectId` | yes | string | Project id of the existing ingested document |
| `currentDocType` | yes | string | Current `docType` used to identify old chunks |
| `currentSource` | yes | string | Current `source` used to identify old chunks |
| `newDocType` | no | string | New `docType`; defaults to `currentDocType` |
| `newSource` | no | string | New `source`; defaults to `currentSource` |
| `rawText` | no* | string | Updated content text |
| `externalUrl` | no* | string (URL) | URL to fetch updated text content |
| `file` | no* | binary | Updated file content (text-based mime types only) |

\* Provide at least one content source: `rawText`, `externalUrl`, or `file`.

## JSON example (raw text update)

```http
PATCH /rag/rag/ingestion
Content-Type: application/json
```

```json
{
  "projectId": "507f1f77bcf86cd799439011",
  "currentDocType": "brochure",
  "currentSource": "https://cdn.example.com/public/brochure-v1.pdf",
  "newDocType": "brochure",
  "newSource": "https://cdn.example.com/public/brochure-v2.pdf",
  "rawText": "Updated brochure content to re-index..."
}
```

## Multipart example (file update)

Use `multipart/form-data` with:
- text fields: `projectId`, `currentDocType`, `currentSource`, optional `newDocType`, optional `newSource`
- file field: `file`

## Success response (`200`)

```json
{
  "message": "Document updated successfully",
  "chunks": 7,
  "previousChunksRemoved": 7
}
```

### Response fields

| Field | Type | Description |
|------|------|-------------|
| `message` | string | Update status message |
| `chunks` | number | Number of new chunks indexed |
| `previousChunksRemoved` | number | Number of chunks removed before re-index |

## Error cases

| Status | When |
|-------|------|
| `400` | Missing all content sources, invalid payload, unsupported file/content type, invalid external URL response |
| `404` | No existing ingested chunks found for (`projectId`, `currentDocType`, `currentSource`) |
| `500` | Vectorization/storage internal error |

## Frontend notes

- Use this endpoint for true "edit/update" operations on previously ingested documents.
- For first-time ingestion, keep using `POST /rag/rag/ingestion`.
- Preserve `currentSource` and `currentDocType` from your list/detail view so updates target the correct logical document.
