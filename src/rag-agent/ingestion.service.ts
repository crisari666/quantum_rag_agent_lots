import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WeaviateStore } from '@langchain/weaviate';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import type { Properties } from 'weaviate-client';
import { WeaviateService } from './weaviate.service';
import {
  IngestionParams,
  IngestionResult,
  VectorizedDocument,
} from './ingestion.types';

const DEFAULT_FETCH_LIMIT = 100;
type ProjectDocumentProperties = Properties & {
  readonly text?: string;
  readonly projectId?: string;
  readonly docType?: string;
  readonly source?: string;
};

/**
 * Service responsible for processing raw documents and storing them in Weaviate.
 */
@Injectable()
export class IngestionService {
  public constructor(
    private readonly weaviateService: WeaviateService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Returns vectorized documents from the store, optionally filtered by projectId.
   */
  public async getVectorizedDocuments(
    projectId?: string,
  ): Promise<VectorizedDocument[]> {
    const client = this.weaviateService.client;
    const collection = client.collections.get<ProjectDocumentProperties>(
      this.weaviateService.indexName,
    );
    const filters = projectId
      ? collection.filter.byProperty('projectId').equal(projectId)
      : undefined;
    const result = await collection.query.fetchObjects({
      limit: DEFAULT_FETCH_LIMIT,
      filters,
      returnProperties: ['text', 'projectId', 'docType', 'source'],
    });
    return (result.objects ?? []).map((obj) => this.mapToVectorizedDocument(obj));
  }

  public async ingestDocument(params: IngestionParams): Promise<IngestionResult> {
    const documents = await this.splitDocument(params);
    const apiKey = this.getOpenAiApiKey();
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: apiKey,
    });
    await WeaviateStore.fromDocuments(documents, embeddings, {
      client: this.weaviateService.client,
      indexName: this.weaviateService.indexName,
      textKey: 'text',
    });
    return {
      message: 'Document vectorized successfully',
      chunks: documents.length,
    };
  }

  private async splitDocument(params: IngestionParams) {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const documents = await splitter.createDocuments(
      [params.rawText],
      [
        {
          projectId: params.projectId,
          docType: params.docType,
          source: params.source,
        },
      ],
    );
    return documents;
  }

  private mapToVectorizedDocument(obj: {
    readonly uuid?: string;
    readonly properties?: ProjectDocumentProperties;
  }): VectorizedDocument {
    const props = obj.properties ?? {};
    return {
      id: obj.uuid ?? '',
      text: props.text ?? '',
      projectId: props.projectId ?? '',
      docType: props.docType ?? '',
      source: props.source ?? '',
    };
  }

  private getOpenAiApiKey(): string {
    const apiKey =
      this.configService.get<string>('OPENAI_API_KEY') ??
      process.env.OPENAI_API_KEY ??
      '';
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured.');
    }
    return apiKey;
  }
}

