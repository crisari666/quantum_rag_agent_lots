# Agent Chat API — Frontend integration

This document describes the HTTP contract for the RAG sales assistant exposed by `AgentChatController`. The agent combines structured project data from MongoDB with semantic search over ingested project documents (Weaviate).

## Base path and discovery

- **Global API prefix:** `rag` (set in `main.ts`).
- **OpenAPI (Swagger):** `{origin}/api` (Swagger UI; tag **Agent Chat**).

All paths below are relative to your backend origin, for example `https://api.example.com`.

---

## `POST /rag/agent-chat/ask`

Sends the user’s question (and optional prior turns) to the LLM agent. The response is a single final answer plus deduplicated document **sources** when the agent used document search, and a **`conversationId`** used for persisted history.

**Persisted history:** Each successful ask appends the user question and assistant answer to MongoDB. To load the last **10** messages for the UI, use **`GET /rag/agent-chat/conversations/:conversationId/messages`**. Details, limits, and thread rules are in [`agent-chat-history-frontend.md`](./agent-chat-history-frontend.md).

### Headers

| Header           | Value              |
|------------------|--------------------|
| `Content-Type`   | `application/json` |

### Request body (`application/json`)

| Field              | Type   | Required | Constraints |
|--------------------|--------|----------|-------------|
| `question`         | string | yes      | Non-empty, max **10 000** characters |
| `conversationId`   | string | no       | UUID **v4**. Omit on first message; reuse the id from the previous response to continue the same thread. When set, prior turns are loaded from the server (up to **50** messages) and **`chatHistory` is ignored**. |
| `chatHistory`      | array  | no       | Max **50** items; used only when **`conversationId` is omitted** |

Each element of `chatHistory` must be an object:

| Field     | Type   | Required | Constraints |
|-----------|--------|----------|-------------|
| `role`    | string | yes      | One of: `user`, `assistant`, `system` |
| `content` | string | yes      | Non-empty, max **5 000** characters |

**Conversation context:** If **`conversationId` is omitted:** the server builds the model input as: system instructions (fixed) → **only** `user` and `assistant` messages from `chatHistory` (in order) → the new `question` as the latest user message. Messages with `role: "system"` in `chatHistory` are accepted by validation but are **not** forwarded to the model; prefer sending only `user` / `assistant` for history. If **`conversationId` is set:** context comes from **stored** messages instead of `chatHistory` (see history doc).

Extra properties on the body are stripped (`whitelist: true`).

### Success response

**Status:** `200 OK`

**Body:**

```json
{
  "output": "string — final natural-language answer",
  "sources": ["string", "..."],
  "conversationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field              | Description |
|--------------------|-------------|
| `output`           | The agent’s reply. If the model returns empty content, the API may normalize to a short fallback string. |
| `sources`          | Sorted list of unique **source** values from Weaviate document metadata (e.g. original URL or ingest path). **Empty array** when the answer relied only on structured project listing (no document search tool). **Non-empty** when document search was used during the turn. |
| `conversationId`   | UUID v4 for this chat thread; send on the next `ask` to continue, and use with `GET .../conversations/:conversationId/messages` for the last 10 UI messages. |

### Error responses

| Status | When |
|--------|------|
| `400`  | Validation failed (invalid types, empty `question`, oversize strings, too many history items, invalid `role`, etc.). Nest typically returns a JSON body with `message` and `statusCode`. |
| `500`  | LLM misconfiguration (e.g. missing `OPENAI_API_KEY`), tool errors surfaced as agent failure, or other server errors. |

There is no streaming endpoint; each call waits for the full agent run (multiple internal tool rounds, capped by a maximum iteration count).

### Example (`fetch`)

```typescript
const baseUrl = 'https://your-api-host';
const response = await fetch(`${baseUrl}/rag/agent-chat/ask`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: 'Which projects mention easy credit in the brochures?',
    chatHistory: [
      { role: 'user', content: 'Hi, I need financing options.' },
      {
        role: 'assistant',
        content: 'I can check project documents for credit and payment terms.',
      },
    ],
  }),
});
if (!response.ok) {
  throw new Error(`Agent chat failed: ${response.status}`);
}
const data: {
  output: string;
  sources: string[];
  conversationId: string;
} = await response.json();
```

### UI hints

- **Sources:** Render `sources` as links or labels when non-empty so users can see which documents grounded the answer.
- **History:** Prefer storing **`conversationId`** and either refetch **`GET .../messages`** for display or, when not using `conversationId` on ask, keep local `chatHistory` (max 50) for the next request.
- **Loading:** Expect latency comparable to several LLM + retrieval round-trips; show a clear loading state and optionally disable repeat submits.

---

## `GET /rag/agent-chat/conversations/:conversationId/messages`

Returns the **last 10** persisted messages (chronological order). See [`agent-chat-history-frontend.md`](./agent-chat-history-frontend.md).

---

## `GET /rag/agent-chat/admin/test`

Smoke test endpoint.

### Success response

**Status:** `200 OK`

**Body:**

```json
{ "status": "ok" }
```

Useful for health checks or verifying routing to the Agent Chat module.

---

## TypeScript types (reference)

```typescript
export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatHistoryMessage {
  role: ChatRole;
  content: string;
}

export interface AskAgentRequestBody {
  question: string;
  conversationId?: string;
  chatHistory?: ChatHistoryMessage[];
}

export interface AskAgentResponseBody {
  output: string;
  sources: string[];
  conversationId: string;
}
```

---

## Related backend behavior (non-contract)

The agent uses tools for listing projects and searching project documents; the exact tool names and parameters are internal. Frontend integrations only need the HTTP contract above.
