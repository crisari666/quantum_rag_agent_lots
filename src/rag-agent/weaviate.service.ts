import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import weaviate, { type Properties, WeaviateClient } from 'weaviate-client';

type ProjectDocumentProperties = Properties & {
  readonly text: string;
  readonly projectId: string;
  readonly docType: string;
  readonly source: string;
};

const DEFAULT_WEAVIATE_HOST = 'localhost';
const DEFAULT_WEAVIATE_PORT = 8080;
const OPENAI_API_KEY_HEADER = 'X-OpenAI-Api-Key';

@Injectable()
export class WeaviateService implements OnModuleInit, OnModuleDestroy {
  public client!: WeaviateClient;
  public readonly indexName = 'ProjectDocument';

  public constructor(private readonly configService: ConfigService) {}

  public async onModuleInit(): Promise<void> {
    const openAiApiKey = this.configService.get<string>('OPENAI_API_KEY') ?? '';
    this.client = await weaviate.connectToLocal({
      host: DEFAULT_WEAVIATE_HOST,
      port: DEFAULT_WEAVIATE_PORT,
      headers: openAiApiKey
        ? { [OPENAI_API_KEY_HEADER]: openAiApiKey }
        : undefined,
    });
    console.log('🔥 Connected to Weaviate (v3 SDK) successfully.');
    await this.ensureSchemaExists();
  }

  public async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    await this.client.close();
  }

  private async ensureSchemaExists(): Promise<void> {
    const exists = await this.client.collections.exists(this.indexName);
    if (exists) return;
    console.log(`Creating collection ${this.indexName} in Weaviate...`);
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
    console.log(`Collection ${this.indexName} created successfully.`);
  }
}
