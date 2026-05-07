import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { RagAgentService } from './rag-agent.service';
import { WeaviateService } from './weaviate.service';
import { IngestionService } from './ingestion.service';
import { IngestionController } from './ingestion.controller';

@Module({
  imports: [ProjectsModule],
  controllers: [IngestionController],
  providers: [WeaviateService, RagAgentService, IngestionService],
  exports: [RagAgentService, IngestionService],
})
export class RagAgentModule {}

