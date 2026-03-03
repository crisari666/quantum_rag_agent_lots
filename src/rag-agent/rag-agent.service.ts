import { Injectable } from '@nestjs/common';
import { WeaviateService } from './weaviate.service';

interface RagSearchParams {
  readonly question: string;
  readonly projectId?: string;
  readonly limit?: number;
}

export interface RagSearchResult {
  readonly text: string;
  readonly projectId: string;
  readonly docType: string;
  readonly source: string;
  readonly score: number;
}

interface WeaviateWhereFilter {
  readonly path: string[];
  readonly operator: 'Equal';
  readonly valueString: string;
}

interface WeaviateAdditional {
  readonly distance?: number;
}

interface WeaviateDocument {
  readonly text?: string;
  readonly projectId?: string;
  readonly docType?: string;
  readonly source?: string;
  readonly _additional?: WeaviateAdditional;
}

interface WeaviateGraphqlResponse {
  readonly data?: {
    readonly Get?: {
      readonly [key: string]: WeaviateDocument[];
    };
  };
}

/**
 * Service that encapsulates the RAG agent workflow using Weaviate as vector store.
 */
@Injectable()
export class RagAgentService {
  public constructor(private readonly weaviateService: WeaviateService) {}

  public async searchRelevantDocuments(
    params: RagSearchParams,
  ): Promise<RagSearchResult[]> {
    const limit = params.limit ?? 5;
    const client = this.weaviateService.getClient();
    const nearText = { concepts: [params.question] };
    const whereFilter = this.buildWhereFilter(params.projectId);
    const query = client.graphql
      .get()
      .withClassName(this.weaviateService.indexName)
      .withFields(
        'text projectId docType source _additional { distance }',
      )
      .withNearText(nearText)
      .withLimit(limit);
    if (whereFilter) {
      query.withWhere(whereFilter);
    }
    const rawResponse = (await query.do()) as WeaviateGraphqlResponse;
    const documents = this.extractDocuments(rawResponse);
    return documents.map((document) => this.mapToResult(document));
  }

  private buildWhereFilter(
    projectId?: string,
  ): WeaviateWhereFilter | undefined {
    if (!projectId) {
      return undefined;
    }
    return {
      path: ['projectId'],
      operator: 'Equal',
      valueString: projectId,
    };
  }

  private extractDocuments(response: WeaviateGraphqlResponse): WeaviateDocument[] {
    const data = response.data;
    if (!data || !data.Get) {
      return [];
    }
    const classKey = this.weaviateService.indexName;
    const documents = data.Get[classKey] ?? [];
    return documents;
  }

  private mapToResult(document: WeaviateDocument): RagSearchResult {
    const additional = document._additional;
    const score = additional?.distance ?? 0;
    return {
      text: document.text ?? '',
      projectId: document.projectId ?? '',
      docType: document.docType ?? '',
      source: document.source ?? '',
      score,
    };
  }
}

