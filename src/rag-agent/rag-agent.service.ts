import { Injectable } from '@nestjs/common';
import type { Properties } from 'weaviate-client';
import { WeaviateService } from './weaviate.service';
import { RagSearchParams, RagSearchResult } from './rag-agent.types';
import { GLOBAL_PROJECT_ID } from './constants/ingestion.constants';

type ProjectDocumentProperties = Properties & {
  readonly text?: string;
  readonly projectId?: string;
  readonly docType?: string;
  readonly source?: string;
};

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
    const requestedProjectIds = this.resolveRequestedProjectIds(params);
    if (requestedProjectIds.length === 0) {
      return this.searchByProjectId(params.question, GLOBAL_PROJECT_ID, limit);
    }
    const projectScopeIds = Array.from(
      new Set([...requestedProjectIds, GLOBAL_PROJECT_ID]),
    );
    const scopedResults = await Promise.all(
      projectScopeIds.map((projectId) =>
        this.searchByProjectId(params.question, projectId, limit),
      ),
    );
    return scopedResults
      .flat()
      .sort((left, right) => left.score - right.score)
      .slice(0, limit);
  }

  private resolveRequestedProjectIds(params: RagSearchParams): string[] {
    if (params.projectIds && params.projectIds.length > 0) {
      return params.projectIds;
    }
    if (params.projectId) {
      return [params.projectId];
    }
    return [];
  }

  private async searchByProjectId(
    question: string,
    projectId: string,
    limit: number,
  ): Promise<RagSearchResult[]> {
    const client = this.weaviateService.client;
    const collection = client.collections.get<ProjectDocumentProperties>(
      this.weaviateService.indexName,
    );
    const filters = collection.filter.byProperty('projectId').equal(projectId);
    const result = await collection.query.nearText(question, {
      limit,
      filters,
      returnMetadata: ['distance'],
      returnProperties: ['text', 'projectId', 'docType', 'source'],
    });
    return (result.objects ?? []).map((obj) => this.mapToResult(obj));
  }

  private mapToResult(obj: {
    readonly properties?: ProjectDocumentProperties;
    readonly metadata?: { readonly distance?: number };
  }): RagSearchResult {
    const props = obj.properties ?? {};
    const score = obj.metadata?.distance ?? 0;
    return {
      text: props.text ?? '',
      projectId: props.projectId ?? '',
      docType: props.docType ?? '',
      source: props.source ?? '',
      score,
    };
  }
}

