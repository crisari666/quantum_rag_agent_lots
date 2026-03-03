import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import weaviate, { WeaviateClient } from 'weaviate-ts-client';

interface WeaviateConfiguration {
  readonly scheme: string;
  readonly host: string;
  readonly apiKey?: string;
}

/**
 * Service responsible for configuring and exposing a Weaviate client.
 */
@Injectable()
export class WeaviateService implements OnModuleInit {
  public readonly indexName: string = 'ProjectDocument';
  private client: WeaviateClient | null = null;

  public constructor(private readonly configService: ConfigService) {}

  public async onModuleInit(): Promise<void> {
    const configuration = this.buildConfiguration();
    this.client = weaviate.client({
      scheme: configuration.scheme,
      host: configuration.host,
      apiKey: configuration.apiKey
        ? new weaviate.ApiKey(configuration.apiKey)
        : undefined,
    });
    await this.ensureSchemaExists();
  }

  public getClient(): WeaviateClient {
    if (!this.client) {
      throw new Error('Weaviate client is not initialized yet.');
    }
    return this.client;
  }

  private buildConfiguration(): WeaviateConfiguration {
    const defaultScheme = 'http';
    const defaultHost = 'localhost:8080';
    const scheme =
      this.configService.get<string>('WEAVIATE_SCHEME') ?? defaultScheme;
    const host = this.configService.get<string>('WEAVIATE_HOST') ?? defaultHost;
    const apiKey = this.configService.get<string>('WEAVIATE_API_KEY') ?? undefined;
    return { scheme, host, apiKey };
  }

  private async ensureSchemaExists(): Promise<void> {
    const client = this.getClient();
    const schema = await client.schema.getter().do();
    const classes = schema.classes ?? [];
    const hasIndex = classes.some((schemaClass) => schemaClass.class === this.indexName);
    if (hasIndex) {
      return;
    }
    await client.schema
      .classCreator()
      .withClass({
        class: this.indexName,
        vectorizer: 'text2vec-openai',
        properties: [
          { name: 'text', dataType: ['text'] },
          { name: 'projectId', dataType: ['string'] },
          { name: 'docType', dataType: ['string'] },
          { name: 'source', dataType: ['string'] },
        ],
      })
      .do();
  }
}

