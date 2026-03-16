# Agent Chat API – Request Reference

Base path: **`/agent-chat`**

---

## 1. Ask the LLM agent a question

**`POST /agent-chat/ask`**

Sends a question to the agent and returns the generated answer. Optional chat history can be sent for conversation context.

### Request

**Headers**

- `Content-Type: application/json`

**Body (JSON)**

| Field         | Type     | Required | Constraints                          | Description                                    |
|---------------|----------|----------|--------------------------------------|------------------------------------------------|
| `question`    | `string` | Yes      | Non-empty, max 10,000 characters     | The question to ask the agent.                 |
| `chatHistory` | `array`  | No       | Max 50 items                         | Previous messages for conversation context.    |

**Chat history item**

| Field     | Type     | Required | Constraints                    | Description           |
|-----------|----------|----------|--------------------------------|-----------------------|
| `role`    | `string` | Yes      | `"user"` \| `"assistant"` \| `"system"` | Message role.   |
| `content` | `string` | Yes      | Non-empty, max 5,000 characters| Message content.      |

### Example request (no history)

```json
{
  "question": "Which projects have a pool and offer easy credit?"
}
```

### Example request (with chat history)

```json
{
  "question": "And what about payment plans?",
  "chatHistory": [
    { "role": "user", "content": "Which projects have a pool?" },
    { "role": "assistant", "content": "The following projects have a pool: Lote Norte, Lote Sur..." }
  ]
}
```

### Response

**200 OK**

```json
{
  "output": "Based on the documentation and project data..."
}
```

**400 Bad Request** – Validation failed (e.g. missing `question`, invalid `chatHistory`).

**500 Internal Server Error** – LLM or tool error (e.g. missing `OPENAI_API_KEY`).

---

## 2. Smoke test

**`GET /agent-chat/admin/test`**

Checks that the Agent Chat service is up. No request body.

### Response

**200 OK**

```json
{
  "status": "ok"
}
```
