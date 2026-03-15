import { Body, Controller, Get, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ApiBody,
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
  @ApiResponse({ status: 200, description: 'Agent response.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  @ApiResponse({ status: 500, description: 'LLM or tool error.' })
  public async ask(@Body() dto: AskAgentDto) {
    const output = await this.agentChatService.askQuestion(
      dto.question,
      dto.chatHistory ?? [],
    );
    return { output };
  }

  @Get('admin/test')
  @ApiOperation({ summary: 'Smoke test' })
  @ApiResponse({ status: 200, description: 'Service is up.' })
  public adminTest(): { status: string } {
    return { status: 'ok' };
  }
}
