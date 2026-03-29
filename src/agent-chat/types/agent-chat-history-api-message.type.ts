/**
 * A single persisted message returned to clients (e.g. last 10 for a conversation).
 * Assistant rows always include `sources` (possibly empty); user rows omit it.
 */
export type AgentChatHistoryApiMessage =
  | {
      readonly role: 'user';
      readonly content: string;
      readonly createdAt: string;
    }
  | {
      readonly role: 'assistant';
      readonly content: string;
      readonly createdAt: string;
      readonly sources: readonly string[];
    };
