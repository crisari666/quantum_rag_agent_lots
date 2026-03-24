import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WeaviateStore } from '@langchain/weaviate';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import type { Properties } from 'weaviate-client';
import { WeaviateService } from './weaviate.service';
import {
  IngestionParams,
  IngestionSourceParams,
  IngestionResult,
  VectorizedDocument,
} from './ingestion.types';
import { GLOBAL_PROJECT_ID } from './constants/ingestion.constants';

const DEFAULT_FETCH_LIMIT = 100;
const SUPPORTED_TEXT_MIME_PREFIX = 'text/';
const SUPPORTED_TEXT_MIME_TYPES = [
  'application/json',
  'application/xml',
  'application/javascript',
  'application/x-javascript',
];
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

  public async ingestDocumentFromSource(
    params: IngestionSourceParams,
  ): Promise<IngestionResult> {
    const { rawText, source } = await this.resolveInputContent(params);
    return this.ingestDocument({
      rawText,
      projectId: params.projectId,
      docType: params.docType,
      source,
    });
  }

  public async ingestGlobalDocument(
    params: Omit<IngestionParams, 'projectId'>,
  ): Promise<IngestionResult> {
    return this.ingestDocument({
      rawText: params.rawText,
      projectId: GLOBAL_PROJECT_ID,
      docType: params.docType,
      source: params.source,
    });
  }

  public async ingestGlobalDocumentFromSource(
    params: Omit<IngestionSourceParams, 'projectId'>,
  ): Promise<IngestionResult> {
    const { rawText, source } = await this.resolveInputContent(params);
    return this.ingestDocument({
      rawText,
      projectId: GLOBAL_PROJECT_ID,
      docType: params.docType,
      source,
    });
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

  /**
   * Resolves searchable text and the vendor-facing `source` stored in Weaviate metadata.
   * The uploaded file or fetched URL supplies text for embeddings only; `source` is what the agent cites to vendors.
   */
  private async resolveInputContent(params: {
    rawText?: string;
    externalUrl?: string;
    source?: string;
    file?: Express.Multer.File;
  }): Promise<{ rawText: string; source: string }> {
    if (params.rawText && params.rawText.trim()) {
      return {
        rawText: params.rawText.trim(),
        source: params.source?.trim() || 'raw-text',
      };
    }
    if (params.file?.buffer) {
      const textFromFile = this.extractTextFromFile(params.file);
      const vendorSource =
        params.source?.trim() ||
        params.file.originalname ||
        'uploaded-file';
      return {
        rawText: textFromFile,
        source: vendorSource,
      };
    }
    if (params.externalUrl) {
      const textFromUrl = await this.fetchTextFromExternalUrl(params.externalUrl);
      const vendorSource = params.source?.trim() || params.externalUrl;
      return {
        rawText: textFromUrl,
        source: vendorSource,
      };
    }
    throw new BadRequestException(
      'Provide one input source: rawText, file, or externalUrl.',
    );
  }

  private extractTextFromFile(file: Express.Multer.File): string {
    const mimetype = file.mimetype?.toLowerCase() ?? '';
    const isTextMimeType =
      mimetype.startsWith(SUPPORTED_TEXT_MIME_PREFIX) ||
      SUPPORTED_TEXT_MIME_TYPES.includes(mimetype);
    if (!isTextMimeType) {
      throw new BadRequestException(
        'Unsupported uploaded file type for ingestion. Upload text-based files or use externalUrl/rawText.',
      );
    }
    const text = file.buffer.toString('utf-8').trim();
    if (!text) {
      throw new BadRequestException('Uploaded file content is empty.');
    }
    return text;
  }

  private async fetchTextFromExternalUrl(externalUrl: string): Promise<string> {
    const response = await fetch(externalUrl);
    if (!response.ok) {
      throw new BadRequestException(
        `Could not fetch externalUrl content. Status: ${response.status}`,
      );
    }
    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    const isTextMimeType =
      contentType.startsWith(SUPPORTED_TEXT_MIME_PREFIX) ||
      SUPPORTED_TEXT_MIME_TYPES.some((type) => contentType.includes(type));
    if (!isTextMimeType && contentType) {
      throw new BadRequestException(
        `Unsupported externalUrl content-type: ${contentType}. Use text-based content.`,
      );
    }
    const text = (await response.text()).trim();
    if (!text) {
      throw new BadRequestException('externalUrl content is empty.');
    }
    return text;
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

