import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentChatController } from './agent-chat.controller';
import { AgentChatHistoryService } from './agent-chat-history.service';
import { AgentChatService } from './agent-chat.service';
import {
  AgentChatMessage,
  AgentChatMessageSchema,
} from './schemas/agent-chat-message.schema';
import {
  AgentChatGapLog,
  AgentChatGapLogSchema,
} from './schemas/agent-chat-gap-log.schema';
import { RagAgentModule } from '../rag-agent/rag-agent.module';
import { ProjectsModule } from '../projects/projects.module';
import { AgentChatGapLogService } from './agent-chat-gap-log.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AgentChatMessage.name, schema: AgentChatMessageSchema },
      { name: AgentChatGapLog.name, schema: AgentChatGapLogSchema },
    ]),
    RagAgentModule,
    ProjectsModule,
  ],
  controllers: [AgentChatController],
  providers: [AgentChatService, AgentChatHistoryService, AgentChatGapLogService],
  exports: [AgentChatService, AgentChatHistoryService, AgentChatGapLogService],
})
export class AgentChatModule {}
