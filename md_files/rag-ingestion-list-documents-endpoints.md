# List Ingested / Vectorized Documents (Frontend Handoff)

This document describes the HTTP endpoint that reads **already ingested** chunks from Weaviate (the RAG vector store). It is useful for admin UIs, debugging, or showing what was indexed for a project.

Implementation: `src/rag-agent/ingestion.controller.ts` (`GET ingestion/documents`).

## Base path

- Global API prefix: `/rag`
- Ingestion controller: `/rag`
- **Full path:** `GET /rag/rag/ingestion/documents`

## Endpoint

| Item | Value |
|------|--------|
| **Method** | `GET` |
| **Path** | `/rag/rag/ingestion/documents` |
| **Query** | `projectId` (optional) |

### Query parameter: `projectId`

| Value | Behavior |
|--------|-----------|
| **Omitted or empty** | No filter on `projectId`. Returns up to the server **limit** of objects from the collection (see *Limits* below). |
| **MongoDB ObjectId** (e.g. `507f1f77bcf86cd799439011`) | Only chunks whose stored `projectId` equals that string (project-scoped ingestion). |
| **`GLOBAL`** | Only chunks ingested via the global knowledge flow (`projectId = "GLOBAL"`). |

> **Note:** Ingestion stores **one Weaviate object per text chunk**, not one row per uploaded file. Multiple chunks from the same document share the same `source` and `docType` but have different `id` and usually different `text` snippets.

## Response (`200`)

JSON **array** of objects. Each item matches the backend shape `VectorizedDocument`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Weaviate object UUID for that chunk. |
| `text` | string | Chunk text used for embeddings / retrieval. |
| `projectId` | string | `GLOBAL` or the Mongo project id. |
| `docType` | string | Document type set at ingestion (e.g. `brochure`, `other`). |
| `source` | string | Vendor-facing citation (filename, title, or URL) stored at ingestion. |

### Example — filter by project

**Request**

```http
GET /rag/rag/ingestion/documents?projectId=507f1f77bcf86cd799439011
```

**Example response** (shape only; content varies):

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "text": "Fragment of ingested content for this chunk...",
    "projectId": "507f1f77bcf86cd799439011",
    "docType": "brochure",
    "source": "https://cdn.example.com/public/brochure.pdf"
  }
]
```

### Example — global knowledge only

**Request**

```http
GET /rag/rag/ingestion/documents?projectId=GLOBAL
```

### Example — no filter (first page of collection)

**Request**

```http
GET /rag/rag/ingestion/documents
```

## Limits and ordering

- The service uses a **fixed fetch limit** (currently **100** objects per request). There is **no pagination** query parameter in this endpoint yet; if you need more, extend the API or call Weaviate directly.
- Order is **not guaranteed** to be stable; treat as a snapshot for debugging or simple listings.

## Errors

| Status | Meaning |
|--------|---------|
| `500` | Weaviate connection or query failure. |

## Related documentation

- Ingest project documents: `md_files/rag-ingestion-upload-or-url-endpoints.md` (`POST /rag/rag/ingestion`).
- Ingest global documents: `md_files/rag-global-ingestion-endpoints.md` (`POST /rag/rag/ingestion/global`).
- Architecture and retrieval strategy: `md_files/rag_doc.md`.
