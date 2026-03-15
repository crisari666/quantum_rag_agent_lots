import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { RagAgentService } from '../../rag-agent/rag-agent.service';
import type { ProjectsService } from '../../projects/projects.service';
import type { StructuredToolInterface } from '@langchain/core/tools';

const DEFAULT_DOCUMENT_SEARCH_LIMIT = 5;

/**
 * Creates the tool to search project documents in Weaviate (RAG).
 */
export function createSearchProjectDocumentsTool(
  ragAgentService: RagAgentService,
): StructuredToolInterface {
  return tool(
    async (input) => {
      const results = await ragAgentService.searchRelevantDocuments({
        question: input.question,
        projectId: input.projectId,
        limit: input.limit ?? DEFAULT_DOCUMENT_SEARCH_LIMIT,
      });
      if (results.length === 0) {
        return 'No relevant documents found.';
      }
      return results
        .map(
          (r) =>
            `[projectId: ${r.projectId}, source: ${r.source}]\n${r.text}`,
        )
        .join('\n\n---\n\n');
    },
    {
      name: 'search_project_documents',
      description: `Search project documentation and unstructured content in the vector store.
Use this for questions about contracts, credits, regulations, manuals, or qualitative descriptions.
Optionally filter by projectId (MongoDB ObjectId) to restrict to one project.`,
      schema: z.object({
        question: z.string().describe('Natural language question to search for in documents'),
        projectId: z.string().optional().describe('Optional project ID to filter results'),
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
      const projects = await projectsService.list();
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
      description: `List all available projects with their id, title, location and sell price.
Use this first when the user asks about projects in general, features, or to get project IDs for filtering document search.`,
      schema: z.object({}),
    },
  );
}
