import * as fs from 'fs/promises';
import * as path from 'path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WeaviateStore } from '@langchain/weaviate';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Filters, type Properties } from 'weaviate-client';
import { PDFParse } from 'pdf-parse';
import { WeaviateService } from './weaviate.service';
import {
  IngestionParams,
  IngestionSourceParams,
  IngestionResult,
  UpdateIngestionSourceParams,
  VectorizedDocument,
} from './ingestion.types';
import {
  GLOBAL_PROJECT_ID,
  INGESTION_FALLBACK_SOURCE_RAW_TEXT,
  RAG_LOCAL_STORAGE_FOLDER_NAME,
} from './constants/ingestion.constants';

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
    const previousChunksRemoved = await this.replaceExistingDocumentChunks(params);
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
      previousChunksRemoved,
    };
  }

  public async ingestDocumentFromSource(
    params: IngestionSourceParams,
  ): Promise<IngestionResult> {
    const { rawText, source } = await this.resolveInputContent({
      projectId: params.projectId,
      docType: params.docType,
      rawText: params.rawText,
      externalUrl: params.externalUrl,
      source: params.source,
      file: params.file,
    });
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
    const { rawText, source } = await this.resolveInputContent({
      projectId: GLOBAL_PROJECT_ID,
      docType: params.docType,
      rawText: params.rawText,
      externalUrl: params.externalUrl,
      source: params.source,
      file: params.file,
    });
    return this.ingestDocument({
      rawText,
      projectId: GLOBAL_PROJECT_ID,
      docType: params.docType,
      source,
    });
  }

  /**
   * Updates an existing ingested logical document by removing old chunks and indexing new content.
   */
  public async updateIngestedDocumentFromSource(
    params: UpdateIngestionSourceParams,
  ): Promise<IngestionResult> {
    const previousChunksRemoved = await this.removeDocumentChunks({
      projectId: params.projectId,
      docType: params.currentDocType,
      source: params.currentSource,
    });
    if (previousChunksRemoved === 0) {
      throw new NotFoundException(
        'No ingested document found for the provided projectId/currentDocType/currentSource.',
      );
    }
    const targetDocType = params.newDocType?.trim() || params.currentDocType;
    const targetSource = params.newSource?.trim() || params.currentSource;
    const { rawText, source } = await this.resolveInputContent({
      projectId: params.projectId,
      docType: targetDocType,
      rawText: params.rawText,
      externalUrl: params.externalUrl,
      source: targetSource,
      file: params.file,
    });
    const documents = await this.splitDocument({
      rawText,
      projectId: params.projectId,
      docType: targetDocType,
      source,
    });
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
      message: 'Document updated successfully',
      chunks: documents.length,
      previousChunksRemoved,
    };
  }

  /**
   * Removes existing chunks for the same logical document so re-ingestion does not duplicate vectors.
   * Identity: `projectId` + `source` + `docType`. Skipped when `source` is the generic raw-text fallback.
   */
  private async replaceExistingDocumentChunks(
    params: IngestionParams,
  ): Promise<number> {
    if (params.source === INGESTION_FALLBACK_SOURCE_RAW_TEXT) {
      return 0;
    }
    return this.removeDocumentChunks({
      projectId: params.projectId,
      source: params.source,
      docType: params.docType,
    });
  }

  private async removeDocumentChunks(params: {
    projectId: string;
    source: string;
    docType: string;
  }): Promise<number> {
    const client = this.weaviateService.client;
    const collection = client.collections.get<ProjectDocumentProperties>(
      this.weaviateService.indexName,
    );
    const where = Filters.and(
      collection.filter.byProperty('projectId').equal(params.projectId),
      collection.filter.byProperty('source').equal(params.source),
      collection.filter.byProperty('docType').equal(params.docType),
    );
    const deleteResult = await collection.data.deleteMany(where);
    return deleteResult.successful;
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
    readonly projectId: string;
    readonly docType: string;
    rawText?: string;
    externalUrl?: string;
    source?: string;
    file?: Express.Multer.File;
  }): Promise<{ rawText: string; source: string }> {
    const trimmedRaw = params.rawText?.trim() ?? '';
    const hasRawText = trimmedRaw.length > 0;
    if (params.file?.buffer) {
      const fileName = await this.persistUploadedFileToRagFolder(
        params.file,
        params.projectId,
        params.docType,
      );
      const textFromFile = await this.extractTextFromFile(params.file);
      const combinedRawText = hasRawText
        ? `${trimmedRaw}\n\n${textFromFile}`
        : textFromFile;
      const vendorSource =
        params.source?.trim() ||
        params.file.originalname ||
        'uploaded-file';
      return {
        rawText: combinedRawText,
        source: fileName,
      };
    }
    if (hasRawText) {
      return {
        rawText: trimmedRaw,
        source: params.source?.trim() || 'raw-text',
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

  private async persistUploadedFileToRagFolder(
    file: Express.Multer.File,
    projectId: string,
    docType: string,
  ): Promise<string> {
    const ragDir = path.join(process.cwd(), RAG_LOCAL_STORAGE_FOLDER_NAME);
    await fs.mkdir(ragDir, { recursive: true });
    const safeProjectId = this.sanitizeStorageSegment(projectId, 'projectId');
    const safeDocType = this.sanitizeStorageSegment(docType, 'docType');
    const extension = this.resolveStoredFileExtension(file);
    const storedName = `${safeProjectId}_${safeDocType}${extension}`;
    await fs.writeFile(path.join(ragDir, storedName), file.buffer);
    return storedName;
  }

  private sanitizeStorageSegment(value: string, label: string): string {
    const trimmed = value.trim();
    const safe = trimmed.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!safe) {
      throw new BadRequestException(
        `Invalid ${label} for file storage; use a non-empty projectId and docType.`,
      );
    }
    return safe;
  }

  private resolveStoredFileExtension(file: Express.Multer.File): string {
    const fromName = path.extname(file.originalname || '').toLowerCase();
    if (fromName && /^\.[a-z0-9.+_-]+$/i.test(fromName)) {
      return fromName;
    }
    const mime = file.mimetype?.toLowerCase() ?? '';
    if (mime === 'application/pdf' || mime === 'application/x-pdf') {
      return '.pdf';
    }
    if (mime.startsWith(SUPPORTED_TEXT_MIME_PREFIX)) {
      const sub = mime.slice(SUPPORTED_TEXT_MIME_PREFIX.length).split(';')[0]?.trim();
      if (!sub || sub === 'plain') {
        return '.txt';
      }
      return `.${sub.replace(/[^a-z0-9]/gi, '_')}`;
    }
    if (SUPPORTED_TEXT_MIME_TYPES.includes(mime)) {
      return '.txt';
    }
    return '';
  }

  private isPdfFile(file: Express.Multer.File): boolean {
    const mime = file.mimetype?.toLowerCase() ?? '';
    if (mime === 'application/pdf' || mime === 'application/x-pdf') {
      return true;
    }
    const name = file.originalname?.toLowerCase() ?? '';
    return name.endsWith('.pdf');
  }

  private async extractTextFromPdf(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const text = result.text.trim();
      if (!text) {
        throw new BadRequestException(
          'PDF text extraction returned empty content.',
        );
      }
      return text;
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      const message =
        err instanceof Error ? err.message : 'Unknown PDF parse error';
      throw new BadRequestException(`Could not parse PDF: ${message}`);
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }

  private async extractTextFromFile(
    file: Express.Multer.File,
  ): Promise<string> {
    if (this.isPdfFile(file)) {
      return this.extractTextFromPdf(file.buffer);
    }
    const mimetype = file.mimetype?.toLowerCase() ?? '';
    const isTextMimeType =
      mimetype.startsWith(SUPPORTED_TEXT_MIME_PREFIX) ||
      SUPPORTED_TEXT_MIME_TYPES.includes(mimetype);
    if (!isTextMimeType) {
      throw new BadRequestException(
        'Unsupported uploaded file type for ingestion. Upload PDF, text-based files, or use externalUrl/rawText.',
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

