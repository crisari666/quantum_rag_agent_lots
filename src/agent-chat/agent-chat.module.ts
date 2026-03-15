import { Module } from '@nestjs/common';
import { AgentChatController } from './agent-chat.controller';
import { AgentChatService } from './agent-chat.service';
import { RagAgentModule } from '../rag-agent/rag-agent.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [RagAgentModule, ProjectsModule],
  controllers: [AgentChatController],
  providers: [AgentChatService],
  exports: [AgentChatService],
})
export class AgentChatModule {}
