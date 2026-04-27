import { randomUUID } from 'crypto';
import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'; 
import { AgentChatGapLogService } from './agent-chat-gap-log.service';
import { AgentChatHistoryService } from './agent-chat-history.service';
import { AgentChatService } from './agent-chat.service';
import { AskAgentDto } from './dto/ask-agent.dto';
import type { AgentChatHistoryApiMessage } from './types/agent-chat-history-api-message.type';

@ApiTags('Agent Chat')
@Controller('agent-chat')
export class AgentChatController {
  private readonly logger = new Logger(AgentChatController.name);

  public constructor(
    private readonly agentChatService: AgentChatService,
    private readonly agentChatHistoryService: AgentChatHistoryService,
    private readonly agentChatGapLogService: AgentChatGapLogService,
  ) {}

  @Post('ask')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Ask the LLM agent a question' })
  @ApiBody({ type: AskAgentDto })
  @ApiOkResponse({
    description:
      'Agent answer plus unique document sources (URL or ingest path) when RAG was used.',
    schema: {
      type: 'object',
      required: ['output', 'sources', 'media'],
      properties: {
        output: {
          type: 'string',
          description: 'Final natural-language answer.',
        },
        sources: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Non-empty when the agent called document search; each entry is Weaviate `source` metadata (e.g. URL or upload path). Empty if only structured project listing was used.',
        },
        media: {
          type: 'array',
          description:
            'When list_projects ran: projects with marketing files (images, horizontal images, videos, brochure, etc.). Client maps filenames to upload URLs.',
          items: {
            type: 'object',
            required: ['projectId', 'title', 'location', 'files'],
            properties: {
              projectId: { type: 'string' },
              title: { type: 'string' },
              location: { type: 'string' },
              files: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['kind', 'filename'],
                  properties: {
                    kind: { type: 'string' },
                    filename: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        conversationId: {
          type: 'string',
          format: 'uuid',
          description:
            'UUID v4 for this thread. Send on the next ask to continue; omitted on first message.',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  @ApiResponse({ status: 500, description: 'LLM or tool error.' })
  public async ask(@Body() dto: AskAgentDto) {
    const conversationId = dto.conversationId ?? randomUUID();
    const historyForAgent =
      dto.conversationId !== undefined
        ? await this.agentChatHistoryService.findMessagesForAgentContext(
            dto.conversationId,
          )
        : (dto.chatHistory ?? []);
    const { output, sources, informationGaps, media } =
      await this.agentChatService.askQuestion(dto.question, historyForAgent);
    await this.agentChatHistoryService.appendExchange({
      conversationId,
      question: dto.question,
      output,
      sources,
    });
    if (informationGaps.length > 0) {
      await this.agentChatGapLogService.appendIfNeeded({
        conversationId,
        question: dto.question,
        output,
        sources,
        reasons: informationGaps,
      });
      this.logger.warn(
        `agent_chat_gap conversationId=${conversationId} reasons=${informationGaps.join(',')}`,
      );
    }
    return { output, sources, media, conversationId };
  }

  @Get('conversations/:conversationId/messages')
  @ApiOperation({
    summary: 'Get the last 10 persisted messages for a conversation',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'UUID v4 returned by POST /agent-chat/ask',
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Up to 10 messages in chronological order (oldest first).',
    schema: {
      type: 'object',
      required: ['messages'],
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            required: ['role', 'content', 'createdAt'],
            properties: {
              role: { type: 'string', enum: ['user', 'assistant'] },
              content: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              sources: {
                type: 'array',
                items: { type: 'string' },
                description: 'Present on assistant messages (RAG sources).',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid conversation id.' })
  public async getConversationMessages(
    @Param('conversationId', new ParseUUIDPipe({ version: '4' }))
    conversationId: string,
  ): Promise<{ messages: AgentChatHistoryApiMessage[] }> {
    const messages =
      await this.agentChatHistoryService.findLastMessagesByConversationId(
        conversationId,
      );
    return { messages };
  }

  @Get('admin/test')
  @ApiOperation({ summary: 'Smoke test' })
  @ApiResponse({ status: 200, description: 'Service is up.' })
  public adminTest(): { status: string } {
    return { status: 'ok' };
  }
}
