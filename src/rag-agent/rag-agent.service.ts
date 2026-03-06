import { Injectable } from '@nestjs/common';
import type { Properties } from 'weaviate-client';
import { WeaviateService } from './weaviate.service';
import { RagSearchParams, RagSearchResult } from './rag-agent.types';

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
    const client = this.weaviateService.client;
    const collection = client.collections.get<ProjectDocumentProperties>(
      this.weaviateService.indexName,
    );
    const filters = params.projectId
      ? collection.filter.byProperty('projectId').equal(params.projectId)
      : undefined;
    const result = await collection.query.nearText(params.question, {
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

