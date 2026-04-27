import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { RagAgentService } from '../../rag-agent/rag-agent.service';
import type { ProjectsService } from '../../projects/projects.service';
import type { StructuredToolInterface } from '@langchain/core/tools';

const DEFAULT_DOCUMENT_SEARCH_LIMIT = 5;

/**
 * Marketing / gallery assets stored on the project (filenames; app serves under uploads).
 * @see project.schema.ts images, cardProject, horizontalImages, verticalVideos, reelVideo, plane, brochure
 */
function serializeProjectMedia(p: {
  readonly images?: readonly string[];
  readonly cardProject?: string;
  readonly horizontalImages?: readonly string[];
  readonly verticalVideos?: readonly string[];
  readonly reelVideo?: string;
  readonly plane?: string;
  readonly brochure?: string;
}): string {
  const media = {
    images: [...(p.images ?? [])],
    cardProject: (p.cardProject ?? '').trim(),
    horizontalImages: [...(p.horizontalImages ?? [])],
    verticalVideos: [...(p.verticalVideos ?? [])],
    reelVideo: (p.reelVideo ?? '').trim(),
    plane: (p.plane ?? '').trim(),
    brochure: (p.brochure ?? '').trim(),
  };
  return `, media: ${JSON.stringify(media)}`;
}

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
Not for listing project photos/videos/brochure/plano filenames—those come from list_projects.media.
If projectIds are provided, search those projects plus GLOBAL knowledge.
If projectIds are empty/omitted, search GLOBAL knowledge only.
Important: projectIds must be project database IDs (not project names/titles).`,
      schema: z.object({
        question: z.string().describe('Natural language question to search for in documents'),
        projectIds: z
          .array(z.string())
          .optional()
          .describe(
            'Optional project database IDs for scoped search. Resolve IDs with list_projects first when user provides names. When provided, the tool also includes GLOBAL knowledge.',
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
        .map((p) => {
          const usd = p.priceSellUsd ?? 0;
          const lotRows = (p.lotOptions ?? []).map((lo) => ({
            area: lo.area,
            price: lo.price,
            priceUsd: lo.priceUsd ?? 0,
          }));
          const lotOptionsPart =
            lotRows.length > 0
              ? `, lotOptions: ${JSON.stringify(lotRows)}`
              : ', lotOptions: []';
          const mediaPart = serializeProjectMedia(p);
          return `id: ${p._id}, title: ${p.title}, location: ${p.location}, city: ${(p.city ?? '').trim()}, country: ${(p.country ?? '').trim()}, priceSell: ${p.priceSell} COP, priceSellUsd: ${usd} USD${lotOptionsPart}${mediaPart}, amenities: [${p.amenities.map((a) => (a as { title?: string }).title).join(', ')}]`;
        })
        .join('\n');
    },
    {
      name: 'list_projects',
      description: `List enabled projects: id, title, location, city, country, prices, lotOptions, amenities, and media (JSON): images[], cardProject, horizontalImages[], verticalVideos[], reelVideo, plane (floor plan file), brochure—all filenames/paths for marketing assets in the app, not RAG text chunks.
Use this first for prices, lot sizes, photos/gallery/videos/brochure/plano requests, city-based matching (e.g. Cartagena), and resolving names to IDs before document search.`,
      schema: z.object({}),
    },
  );
}
