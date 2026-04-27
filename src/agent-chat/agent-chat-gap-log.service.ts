import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AgentChatInformationGap } from './agent-chat.types';
import {
  AgentChatGapLog,
  AgentChatGapLogDocument,
} from './schemas/agent-chat-gap-log.schema';

@Injectable()
export class AgentChatGapLogService {
  public constructor(
    @InjectModel(AgentChatGapLog.name)
    private readonly gapLogModel: Model<AgentChatGapLogDocument>,
  ) {}

  public async appendIfNeeded(params: {
    readonly conversationId: string;
    readonly question: string;
    readonly output: string;
    readonly sources: readonly string[];
    readonly reasons: readonly AgentChatInformationGap[];
  }): Promise<void> {
    if (params.reasons.length === 0) {
      return;
    }
    await this.gapLogModel.create({
      conversationId: params.conversationId,
      question: params.question,
      output: params.output,
      sources: [...params.sources],
      reasons: [...params.reasons],
    });
  }
}
