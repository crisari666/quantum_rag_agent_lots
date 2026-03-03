import { Module } from '@nestjs/common';
import { RagAgentService } from './rag-agent.service';
import { WeaviateService } from './weaviate.service';

@Module({
  providers: [WeaviateService, RagAgentService],
  exports: [RagAgentService],
})
export class RagAgentModule {}

