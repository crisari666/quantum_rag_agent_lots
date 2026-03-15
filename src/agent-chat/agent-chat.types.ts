/**
 * A single message in the chat history (API format).
 */
export interface ChatMessageInput {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
}

/**
 * Result of asking the agent a question.
 */
export interface AgentChatResult {
  readonly output: string;
}
