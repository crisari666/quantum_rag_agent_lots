import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AgentChatMessageDocument = AgentChatMessage & Document;

@Schema({ timestamps: true, collection: 'agent_chat_messages' })
export class AgentChatMessage {
  @Prop({ required: true, index: true })
  conversationId!: string;

  @Prop({ required: true, enum: ['user', 'assistant'] })
  role!: 'user' | 'assistant';

  @Prop({ required: true })
  content!: string;

  @Prop({ type: [String], default: [] })
  sources!: string[];
}

export const AgentChatMessageSchema = SchemaFactory.createForClass(AgentChatMessage);

AgentChatMessageSchema.index({ conversationId: 1, createdAt: -1 });
