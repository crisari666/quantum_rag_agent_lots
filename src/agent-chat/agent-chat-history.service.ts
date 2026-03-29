import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AgentChatMessage,
  AgentChatMessageDocument,
} from './schemas/agent-chat-message.schema';
import type { ChatMessageInput } from './agent-chat.types';
import type { AgentChatHistoryApiMessage } from './types/agent-chat-history-api-message.type';

const AGENT_CHAT_HISTORY_API_LIMIT = 10;
const AGENT_CHAT_CONTEXT_DB_LIMIT = 50;

/**
 * Persists agent chat turns and reads recent messages for the API and agent context.
 */
@Injectable()
export class AgentChatHistoryService {
  public constructor(
    @InjectModel(AgentChatMessage.name)
    private readonly messageModel: Model<AgentChatMessageDocument>,
  ) {}

  /**
   * Returns the last N persisted messages in chronological order (oldest first).
   */
  public async findLastMessagesByConversationId(
    conversationId: string,
  ): Promise<AgentChatHistoryApiMessage[]> {
    const documents = await this.messageModel
      .find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(AGENT_CHAT_HISTORY_API_LIMIT)
      .lean()
      .exec();
    const chronological = [...documents].reverse();
    return chronological.map((document) =>
      this.mapDocumentToApiMessage(document),
    );
  }

  /**
   * Loads up to N prior messages for LLM context (chronological, user/assistant only).
   */
  public async findMessagesForAgentContext(
    conversationId: string,
  ): Promise<ChatMessageInput[]> {
    const documents = await this.messageModel
      .find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(AGENT_CHAT_CONTEXT_DB_LIMIT)
      .lean()
      .exec();
    const chronological = [...documents].reverse();
    return chronological.map((document) => ({
      role: document.role,
      content: document.content,
    }));
  }

  /**
   * Stores the user question and assistant reply for a conversation turn.
   */
  public async appendExchange(params: {
    readonly conversationId: string;
    readonly question: string;
    readonly output: string;
    readonly sources: readonly string[];
  }): Promise<void> {
    await this.messageModel.insertMany([
      {
        conversationId: params.conversationId,
        role: 'user' as const,
        content: params.question,
        sources: [],
      },
      {
        conversationId: params.conversationId,
        role: 'assistant' as const,
        content: params.output,
        sources: [...params.sources],
      },
    ]);
  }

  private mapDocumentToApiMessage(
    document: AgentChatMessage & { createdAt?: Date },
  ): AgentChatHistoryApiMessage {
    const createdAt =
      document.createdAt instanceof Date
        ? document.createdAt.toISOString()
        : new Date().toISOString();
    if (document.role === 'assistant') {
      return {
        role: 'assistant',
        content: document.content,
        createdAt,
        sources: document.sources?.length ? [...document.sources] : [],
      };
    }
    return {
      role: 'user',
      content: document.content,
      createdAt,
    };
  }
}
