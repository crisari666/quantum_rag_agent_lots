/**
 * A single message in the chat history (API format).
 */
export interface ChatMessageInput {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
}

import type {
  AgentChatMediaFile,
  AgentChatMediaKind,
  AgentChatMediaProject,
} from './agent-chat-media.builder';

export enum AgentChatInformationGap {
  DOCUMENT_SEARCH_NO_HITS = 'DOCUMENT_SEARCH_NO_HITS',
  NO_ENABLED_PROJECTS = 'NO_ENABLED_PROJECTS',
  MAX_ITERATIONS = 'MAX_ITERATIONS',
  EMPTY_MODEL_OUTPUT = 'EMPTY_MODEL_OUTPUT',
}

export type { AgentChatMediaFile, AgentChatMediaKind, AgentChatMediaProject };

/**
 * Result of asking the agent a question.
 * `sources` lists URLs or backend-relative paths from ingested document metadata when RAG was used; empty if only structured DB data was used.
 * `media` lists project marketing filenames when `list_projects` ran (for client previews).
 */
export interface AgentChatResult {
  readonly output: string;
  readonly sources: readonly string[];
  readonly informationGaps: readonly AgentChatInformationGap[];
  readonly media: readonly AgentChatMediaProject[];
}
