# RAG Global Ingestion Endpoint (Frontend Handoff)

This document describes how to ingest **global knowledge** into Weaviate for the sales assistant (laws, urbanism, policies, general concepts not tied to one project).

## Strategy (aligned with `rag_doc.md`)

- Global chunks are stored with `projectId = "GLOBAL"` in the same `ProjectDocument` collection as project-specific docs.
- Retrieval can mix **specific `projectId`s** and **GLOBAL** so project answers can still pull in general law or urbanism context when needed.

## Base path

- Global API prefix: `/rag`
- Ingestion controller: `/rag`
- **Full path:** `POST /rag/rag/ingestion/global`
- **Consumes:** `application/json` **or** `multipart/form-data`

## Content vs citation (`source`)

Use **exactly one** way to supply **text for embeddings** (chunking + vectors):

| Input | Purpose |
|--------|--------|
| `rawText` | Plain text body used only for search embeddings. |
| `file` | Text-based upload; file bytes are parsed for embeddings only. |
| `externalUrl` | URL that returns **text** (e.g. `.txt`); fetched content is used for embeddings only. |

**`source`** (optional, max length **2048**) is the **vendor-facing citation** (filename, title, or public URL) the assistant should return—not the full document body.

- **File upload:** if `source` is omitted, the stored citation defaults to the **uploaded filename**.
- **`externalUrl`:** if `source` is omitted, the citation defaults to **`externalUrl`**; set `source` when the public link vendors should open is different from the fetch URL.

For the same rules on the project-scoped endpoint, see `md_files/rag-ingestion-upload-or-url-endpoints.md`.

## Required fields

- `docType` (string, required)

## Optional fields

- `source` (string): vendor citation; max 2048 characters
- `rawText` (string)
- `externalUrl` (string, valid URL)
- `file` (binary, multipart only): field name **`file`**; must be a **text-based** MIME type accepted by the API

## `docType` allowed values

- `images`
- `plane`
- `brochure`
- `reellVideo`
- `rut`
- `business_registration`
- `bank_certificate`
- `libertarian_certificate`
- `other` (use when the type is not in the list)

## Examples

### JSON — raw text + citation

```json
{
  "docType": "other",
  "source": "https://www.example.gov/ley-388",
  "rawText": "Ley 388 regula la planificación y gestión del suelo en Colombia..."
}
```

### JSON — fetch text from URL, cite a different public URL

```json
{
  "docType": "other",
  "externalUrl": "https://cdn.example.com/docs/ley-388-extract.txt",
  "source": "https://www.example.gov/ley-388"
}
```

### Multipart

- Form fields: `docType`, optional `source`, optional `externalUrl` (if not using file/rawText in JSON path—typically one content mode only)
- File field name: **`file`** (text-based file for embedding extraction)

## Response (201)

```json
{
  "message": "Document vectorized successfully",
  "chunks": 12,
  "projectId": "GLOBAL"
}
```

## Validation / errors

- `400` if none of `rawText`, `file`, or `externalUrl` is provided, or validation fails (invalid `docType`, bad URL, non-text file type, empty content, etc.).
- `500` on embedding / Weaviate errors.

## Notes for frontend

- Use **`/rag/rag/ingestion/global`** for global knowledge; use **`/rag/rag/ingestion`** with **`projectId`** for project-specific documents.
- Prefer setting **`source`** to the stable link or label you want **vendors** to see in the assistant’s answers.
- If the type is not in the predefined list, send **`docType: "other"`**.
