import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WeaviateStore } from '@langchain/weaviate';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { WeaviateService } from './weaviate.service';
import { IngestionParams, IngestionResult } from './ingestion.types';

/**
 * Service responsible for processing raw documents and storing them in Weaviate.
 */
@Injectable()
export class IngestionService {
  public constructor(
    private readonly weaviateService: WeaviateService,
    private readonly configService: ConfigService,
  ) {}

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

