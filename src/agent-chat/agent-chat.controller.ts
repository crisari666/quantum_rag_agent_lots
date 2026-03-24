import { Body, Controller, Get, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AgentChatService } from './agent-chat.service';
import { AskAgentDto } from './dto/ask-agent.dto';

@ApiTags('Agent Chat')
@Controller('agent-chat')
export class AgentChatController {
  public constructor(private readonly agentChatService: AgentChatService) {}

  @Post('ask')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Ask the LLM agent a question' })
  @ApiBody({ type: AskAgentDto })
  @ApiOkResponse({
    description:
      'Agent answer plus unique document sources (URL or ingest path) when RAG was used.',
    schema: {
      type: 'object',
      required: ['output', 'sources'],
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
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  @ApiResponse({ status: 500, description: 'LLM or tool error.' })
  public async ask(@Body() dto: AskAgentDto) {
    const { output, sources } = await this.agentChatService.askQuestion(
      dto.question,
      dto.chatHistory ?? [],
    );
    return { output, sources };
  }

  @Get('admin/test')
  @ApiOperation({ summary: 'Smoke test' })
  @ApiResponse({ status: 200, description: 'Service is up.' })
  public adminTest(): { status: string } {
    return { status: 'ok' };
  }
}
