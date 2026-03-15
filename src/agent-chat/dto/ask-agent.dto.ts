import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const MAX_QUESTION_LENGTH = 10_000;
const MAX_CHAT_HISTORY_LENGTH = 50;
const MAX_MESSAGE_CONTENT_LENGTH = 5_000;

class ChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant', 'system'] })
  @IsString()
  role!: 'user' | 'assistant' | 'system';

  @ApiProperty({ example: 'Hello' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_CONTENT_LENGTH)
  content!: string;
}

/**
 * DTO for asking the agent a question with optional chat history.
 */
export class AskAgentDto {
  @ApiProperty({
    description: 'User question to the agent',
    example: 'Which projects have a pool and offer easy credit?',
    maxLength: MAX_QUESTION_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_QUESTION_LENGTH)
  question!: string;

  @ApiPropertyOptional({
    description: 'Previous messages for conversation context',
    type: [ChatMessageDto],
    maxItems: MAX_CHAT_HISTORY_LENGTH,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CHAT_HISTORY_LENGTH)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  chatHistory?: ChatMessageDto[];
}
