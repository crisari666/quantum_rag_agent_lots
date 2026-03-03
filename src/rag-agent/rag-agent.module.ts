import { Module } from '@nestjs/common';
import { RagAgentService } from './rag-agent.service';
import { WeaviateService } from './weaviate.service';
import { IngestionService } from './ingestion.service';

@Module({
  providers: [WeaviateService, RagAgentService, IngestionService],
  exports: [RagAgentService, IngestionService],
})
export class RagAgentModule {}

