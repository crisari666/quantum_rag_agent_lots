import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import type { AgentChatInformationGap } from '../agent-chat.types';

export type AgentChatGapLogDocument = AgentChatGapLog & Document;

@Schema({ timestamps: true, collection: 'agent_chat_gap_logs' })
export class AgentChatGapLog {
  @Prop({ required: true, index: true })
  conversationId!: string;

  @Prop({ required: true })
  question!: string;

  @Prop({ required: true })
  output!: string;

  @Prop({ type: [String], default: [] })
  sources!: string[];

  @Prop({ type: [String], required: true })
  reasons!: AgentChatInformationGap[];
}

export const AgentChatGapLogSchema = SchemaFactory.createForClass(AgentChatGapLog);

AgentChatGapLogSchema.index({ conversationId: 1, createdAt: -1 });
