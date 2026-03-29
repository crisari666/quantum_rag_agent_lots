import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentChatController } from './agent-chat.controller';
import { AgentChatHistoryService } from './agent-chat-history.service';
import { AgentChatService } from './agent-chat.service';
import {
  AgentChatMessage,
  AgentChatMessageSchema,
} from './schemas/agent-chat-message.schema';
import { RagAgentModule } from '../rag-agent/rag-agent.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AgentChatMessage.name, schema: AgentChatMessageSchema },
    ]),
    RagAgentModule,
    ProjectsModule,
  ],
  controllers: [AgentChatController],
  providers: [AgentChatService, AgentChatHistoryService],
  exports: [AgentChatService, AgentChatHistoryService],
})
export class AgentChatModule {}
