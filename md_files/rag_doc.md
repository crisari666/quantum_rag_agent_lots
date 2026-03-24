# Context and Objective

We are building a robust Retrieval-Augmented Generation (RAG) backend using **NestJS**, **LangChain.js**, and **Weaviate**. The system acts as a real estate and construction sales assistant.

The agent needs to handle two types of queries:

1. **Project-specific queries:** Information about specific real estate projects (prices, floor plans, contracts) stored with a unique `projectId` (mapped to MongoDB).
2. **Global / general queries:** Real estate concepts, laws (e.g. Ley 388, Ley 675), and urbanism concepts.

## Architecture and Strategy

- **Database:** Weaviate (v3 SDK). gRPC on port `50051` and HTTP on `8080` (local defaults in app config).
- **Single collection:** One index (e.g. `ProjectDocument`) holds both project chunks and global chunks.
- **Global knowledge:** General documents are ingested with `projectId = "GLOBAL"` (string literal), not a separate vector index.
- **Metadata:** `projectId`, `docType`, and `source` are stored with `skipVectorization: true` so filters stay exact; chunk text is what gets embedded.
- **Citation field:** `source` is the **vendor-facing reference** (filename, title, or public URL) returned with answers. It is not the full document body. Embedding text may come from `rawText`, a **text file upload**, or content **fetched from `externalUrl`**.
- **Re-ingestion:** Uploading or posting again with the same **`projectId` + `source` + `docType`** **replaces** prior chunks (they are deleted in Weaviate before insert). The generic default `source` **`raw-text`** (when `rawText` is sent without an explicit `source`) **does not** trigger replace—those calls **append**. See the ingestion markdown files for the `previousChunksRemoved` response field.
- **Routing (implemented in this repo):** The chat agent uses tools (`list_projects`, `search_project_documents`). Document search behavior:
  - If **`projectIds`** are provided: query runs against each listed project **and** `GLOBAL`, then results are merged and ranked.
  - If **`projectIds`** are omitted: query runs against **`GLOBAL` only** (strict general-knowledge mode).

Frontend / API details:

- Project ingestion: `md_files/rag-ingestion-upload-or-url-endpoints.md` (path `POST /rag/rag/ingestion`).
- Global ingestion: `md_files/rag-global-ingestion-endpoints.md` (path `POST /rag/rag/ingestion/global`).

## Required Dependencies

Use the **Weaviate v3** client stack, not the legacy `weaviate-ts-client`.

```bash
npm uninstall weaviate-ts-client
npm install weaviate-client @langchain/weaviate @langchain/openai langchain zod
```

The project uses **yarn** for package management in this repository.

---

The TypeScript samples below are **reference only**; the running Nest app already implements Weaviate connection, schema creation, ingestion, and agent tools. Use them as a conceptual guide if something is missing or diverges.

## 1. Weaviate Setup and Schema (`weaviate.service.ts`)

We create the collection explicitly so metadata such as `projectId` is not vectorized.

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import weaviate, { WeaviateClient, configure } from 'weaviate-client';

@Injectable()
export class WeaviateService implements OnModuleInit, OnModuleDestroy {
  public client: WeaviateClient;
  public readonly indexName = 'ProjectDocument';

  async onModuleInit() {
    this.client = await weaviate.connectToLocal({
      host: 'localhost',
      port: 8080,
      grpcPort: 50051,
    });
    await this.ensureSchemaExists();
  }

  private async ensureSchemaExists() {
    const exists = await this.client.collections.exists(this.indexName);
    if (!exists) {
      await this.client.collections.create({
        name: this.indexName,
        vectorizer: configure.vectorizer.text2VecOpenAI(),
        properties: [
          { name: 'text', dataType: configure.dataType.TEXT },
          { name: 'projectId', dataType: configure.dataType.TEXT, skipVectorization: true },
          { name: 'docType', dataType: configure.dataType.TEXT, skipVectorization: true },
          { name: 'source', dataType: configure.dataType.TEXT, skipVectorization: true },
        ],
      });
    }
  }

  async onModuleDestroy() {
    if (this.client) this.client.close();
  }
}
```

## 2. Search Tool Pattern (LangChain + Weaviate filters)

The idea: when the user asks something **general**, search only `projectId == "GLOBAL"`. When the question is tied to **specific projects**, search those IDs **plus** `"GLOBAL"` as fallback so laws and urbanism context can still surface.

**Implemented equivalent:** `RagAgentService.searchRelevantDocuments` + agent tool `search_project_documents` (`projectIds` optional, as described in *Architecture and Strategy* above).

Sample shape (GraphQL-style `where` filters vary by SDK version; your app uses the v3 collections API with `nearText` + property filters):

```typescript
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { WeaviateStore } from '@langchain/weaviate';

export const createSearchWeaviateTool = (vectorStore: WeaviateStore) =>
  new DynamicStructuredTool({
    name: 'buscar_documentos',
    description:
      'Busca información legal, conceptos de urbanismo, reglas de propiedad horizontal, o detalles de proyectos. Si te preguntan por un concepto general, deja projectIds vacío.',
    schema: z.object({
      consulta: z.string().describe('La pregunta semántica a buscar'),
      projectIds: z
        .array(z.string())
        .optional()
        .describe(
          'IDs de proyectos para filtrar. Si la pregunta es sobre conceptos generales o leyes, déjalo vacío.',
        ),
    }),
    func: async ({ consulta, projectIds }) => {
      let filter = undefined;
      if (projectIds && projectIds.length > 0) {
        filter = {
          where: {
            operator: 'ContainsAny',
            path: ['projectId'],
            valueStringArray: [...projectIds, 'GLOBAL'],
          },
        };
      } else {
        filter = {
          where: {
            operator: 'Equal',
            path: ['projectId'],
            valueString: 'GLOBAL',
          },
        };
      }
      const retriever = vectorStore.asRetriever({ k: 4, filter });
      const docs = await retriever.getRelevantDocuments(consulta);
      return JSON.stringify(
        docs.map((d) => ({
          texto: d.pageContent,
          fuente: d.metadata.source,
        })),
      );
    },
  });
```

Retrieved chunks should expose **`metadata.source`** (vendor citation) alongside **`pageContent`** (chunk text used for the answer).
