import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { RagAgentService } from '../../rag-agent/rag-agent.service';
import type { ProjectsService } from '../../projects/projects.service';
import type { StructuredToolInterface } from '@langchain/core/tools';

const DEFAULT_DOCUMENT_SEARCH_LIMIT = 5;

/**
 * Creates the tool to search project documents in Weaviate (RAG).
 * @param collectDocumentSources - Optional hook with unique non-empty source strings (URL or stored path) after each search.
 */
export function createSearchProjectDocumentsTool(
  ragAgentService: RagAgentService,
  collectDocumentSources?: (sources: readonly string[]) => void,
): StructuredToolInterface {
  return tool(
    async (input) => {
      const results = await ragAgentService.searchRelevantDocuments({
        question: input.question,
        projectIds: input.projectIds,
        limit: input.limit ?? DEFAULT_DOCUMENT_SEARCH_LIMIT,
      });
      if (results.length === 0) {
        return 'No relevant documents found.';
      }
      if (collectDocumentSources) {
        const uniqueSources = [
          ...new Set(
            results
              .map((r) => r.source.trim())
              .filter((s) => s.length > 0),
          ),
        ];
        collectDocumentSources(uniqueSources);
      }
      return results
        .map(
          (r) =>
            `[projectId: ${r.projectId}, source (vendor citation): ${r.source}]\n${r.text}`,
        )
        .join('\n\n---\n\n');
    },
    {
      name: 'search_project_documents',
      description: `Search project documentation and unstructured content in the vector store.
Use this for questions about contracts, credits, regulations, manuals, or qualitative descriptions.
If projectIds are provided, search those projects plus GLOBAL knowledge.
If projectIds are empty/omitted, search GLOBAL knowledge only.`,
      schema: z.object({
        question: z.string().describe('Natural language question to search for in documents'),
        projectIds: z
          .array(z.string())
          .optional()
          .describe(
            'Optional project IDs for scoped search. When provided, the tool also includes GLOBAL knowledge.',
          ),
        limit: z.number().min(1).max(20).optional().describe('Max number of document chunks to return'),
      }),
    },
  );
}

/**
 * Creates the tool to list projects from the database (structured data).
 */
export function createSearchProjectsTool(
  projectsService: ProjectsService,
): StructuredToolInterface {
  return tool(
    async () => {
      const projects = await projectsService.list('true');
      if (projects.length === 0) {
        return 'No projects found.';
      }
      return projects
        .map(
          (p) =>
            `id: ${p._id}, title: ${p.title}, location: ${p.location}, priceSell: ${p.priceSell}, amenities: [${p.amenities.map(a => (a as any).title).join(', ')}]`,
        )
        .join('\n');
    },
    {
      name: 'list_projects',
      description: `List enabled projects only (id, title, location, sell price).
Use this first when the user asks about projects in general, features, or to get project IDs for filtering document search.`,
      schema: z.object({}),
    },
  );
}
