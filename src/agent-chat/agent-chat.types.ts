/**
 * A single message in the chat history (API format).
 */
export interface ChatMessageInput {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
}

/**
 * Result of asking the agent a question.
 * `sources` lists URLs or backend-relative paths from ingested document metadata when RAG was used; empty if only structured DB data was used.
 */
export interface AgentChatResult {
  readonly output: string;
  readonly sources: readonly string[];
}
