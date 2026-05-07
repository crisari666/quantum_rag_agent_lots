import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import weaviate, { type Properties, WeaviateClient } from 'weaviate-client';

type ProjectDocumentProperties = Properties & {
  readonly text: string;
  readonly projectId: string;
  readonly docType: string;
  readonly source: string;
};

const DEFAULT_WEAVIATE_HOST = 'localhost';
const DEFAULT_WEAVIATE_HTTP_PORT = 8080;
const DEFAULT_WEAVIATE_GRPC_PORT = 50051;
const OPENAI_API_KEY_HEADER = 'X-OpenAI-Api-Key';

function readPort(
  configService: ConfigService,
  key: string,
  fallback: number,
): number {
  const raw = configService.get<string>(key);
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

@Injectable()
export class WeaviateService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WeaviateService.name);
  public client!: WeaviateClient;
  public readonly indexName = 'ProjectDocument';

  public constructor(private readonly configService: ConfigService) {}

  public async onModuleInit(): Promise<void> {
    const host =
      this.configService.get<string>('WEAVIATE_HOST')?.trim() ||
      DEFAULT_WEAVIATE_HOST;
    const httpPort = readPort(
      this.configService,
      'WEAVIATE_HTTP_PORT',
      DEFAULT_WEAVIATE_HTTP_PORT,
    );
    const grpcPort = readPort(
      this.configService,
      'WEAVIATE_GRPC_PORT',
      DEFAULT_WEAVIATE_GRPC_PORT,
    );
    const openAiApiKey = this.configService.get<string>('OPENAI_API_KEY') ?? '';
    const httpUrl = `http://${host}:${httpPort}`;
    try {
      this.client = await weaviate.connectToLocal({
        host,
        port: httpPort,
        grpcPort,
        headers: openAiApiKey
          ? { [OPENAI_API_KEY_HEADER]: openAiApiKey }
          : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const hint =
        msg.includes('<!doctype') || msg.includes('not valid JSON')
          ? ` The HTTP endpoint at ${httpUrl} returned HTML instead of Weaviate JSON — wrong port or Weaviate not running. This repo maps Weaviate to host REST 8079 and gRPC 50052 by default (8080 is often the Nest API). From the omega repo root run: docker compose up -d weaviate. Or set WEAVIATE_HTTP_PORT and WEAVIATE_GRPC_PORT in .env to match docker compose ports.`
          : '';
      this.logger.error(`Weaviate connection failed (${httpUrl}, gRPC ${host}:${grpcPort}).${hint}`);
      throw err;
    }
    this.logger.log(`Connected to Weaviate at ${httpUrl} (gRPC ${grpcPort}).`);
    await this.ensureSchemaExists();
  }

  public async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    await this.client.close();
  }

  private async ensureSchemaExists(): Promise<void> {
    const exists = await this.client.collections.exists(this.indexName);
    if (exists) return;
    this.logger.log(`Creating collection ${this.indexName} in Weaviate...`);
    await this.client.collections.create<ProjectDocumentProperties>({
      name: this.indexName,
      vectorizers: weaviate.configure.vectorizer.text2VecOpenAI<ProjectDocumentProperties>(
        {
          sourceProperties: ['text'],
        },
      ),
      properties: [
        {
          name: 'text',
          dataType: weaviate.configure.dataType.TEXT,
          description: 'Main document content',
        },
        {
          name: 'projectId',
          dataType: weaviate.configure.dataType.TEXT,
          skipVectorization: true,
        },
        {
          name: 'docType',
          dataType: weaviate.configure.dataType.TEXT,
          skipVectorization: true,
        },
        {
          name: 'source',
          dataType: weaviate.configure.dataType.TEXT,
          skipVectorization: true,
        },
      ],
    });
    this.logger.log(`Collection ${this.indexName} created successfully.`);
  }
}
