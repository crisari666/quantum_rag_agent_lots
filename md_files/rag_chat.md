c# Context and Objective
We are building the Chat/RAG execution layer in a **NestJS** backend using **LangChain.js** and **Weaviate (v3 SDK)**. 
The ingestion pipeline is already complete. Documents are stored in Weaviate under the index `ProjectDocument` with metadata fields: `projectId`, `docType`, and `source`.
General knowledge documents (e.g., Urbanism laws, Ley 388, Ley 675) are stored with `projectId: "GLOBAL"`.

**The Goal:** Implement a Tool-Calling Agent that answers user questions by intelligently deciding whether to search within a specific project's documents or within the general knowledge base ("GLOBAL").

## Required Dependencies Check
Ensure these are installed (Modern LangChain architecture):
```bash
npm install @langchain/openai @langchain/weaviate @langchain/core langchain zod

```

1. The Retrieval Tool (chat.tools.ts)
Create a separate file or define this inside the service. This tool executes the semantic search with dynamic filtering. We must use the modern WeaviateStore from @langchain/weaviate.

```typescript
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { WeaviateStore } from "@langchain/weaviate";

export const createSearchWeaviateTool = (vectorStore: WeaviateStore) => new DynamicStructuredTool({
  name: "buscar_documentos",
  description: "Busca información legal, contratos, amenidades de proyectos, conceptos de urbanismo o reglas de propiedad horizontal. Si la pregunta es sobre conceptos generales o leyes, omite projectIds.",
  schema: z.object({
    consulta: z.string().describe("La pregunta semántica a buscar en la base de datos vectorial."),
    projectIds: z.array(z.string()).optional().describe("IDs de proyectos a filtrar. Déjalo vacío si es una pregunta general o conceptual."),
  }),
  func: async ({ consulta, projectIds }) => {
    let filter = undefined;
    
    // If the LLM provides specific project IDs, search those + GLOBAL knowledge
    if (projectIds && projectIds.length > 0) {
       filter = {
          where: {
            operator: 'ContainsAny',
            path: ['projectId'],
            valueStringArray: [...projectIds, "GLOBAL"],
          }
       };
    } else {
       // Force search ONLY in general knowledge
       filter = {
          where: {
            operator: 'Equal',
            path: ['projectId'],
            valueString: "GLOBAL",
          }
       };
    }

    const retriever = vectorStore.asRetriever({ k: 5, filter });
    const docs = await retriever.getRelevantDocuments(consulta);
    
    return JSON.stringify(docs.map(d => ({
      texto: d.pageContent,
      proyecto_id: d.metadata.projectId,
      fuente: d.metadata.source
    })));
  },
});
```


2. The Chat Service (chat.service.ts)
Implement the service that constructs the Agent, binds the tools, and executes the conversation. Use modern LangChain methods (createToolCallingAgent).

```typescript
import { Injectable } from '@nestjs/common';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { WeaviateStore } from '@langchain/weaviate';
import { createToolCallingAgent, AgentExecutor } from "langchain/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { WeaviateService } from './weaviate.service';
import { createSearchWeaviateTool } from './chat.tools';

@Injectable()
export class ChatService {
  constructor(private weaviateService: WeaviateService) {}

  async askAgent(question: string, currentProjectId?: string, chatHistory: any[] = []) {
    const llm = new ChatOpenAI({ modelName: 'gpt-4o', temperature: 0 });
    const embeddings = new OpenAIEmbeddings();

    // 1. Initialize Vector Store connection
    const vectorStore = new WeaviateStore(embeddings, {
      client: this.weaviateService.client,
      indexName: this.weaviateService.indexName,
      textKey: 'text',
      metadataKeys: ['projectId', 'docType', 'source'],
    });

    // 2. Initialize Tools
    const tools = [createSearchWeaviateTool(vectorStore)];

    // 3. Create the System Prompt
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `Eres un asesor experto de una Constructora. 
      Tienes acceso a una herramienta de búsqueda de documentos.
      
      Reglas estrictas:
      1. Si el usuario te pregunta por el proyecto actual, usa el ID proporcionado: {currentProjectId}.
      2. Si el usuario realiza preguntas utilizando el nombre de un proyecto busca el id del proyeto en el listado del proyectos para hacer la busqueda de los recursos necesario para el proyecto
      2. Si el usuario hace una pregunta sobre conceptos generales de urbanismo, Ley 388, Ley 675, pavimentos, etc., NO pases el ID del proyecto a la herramienta, haz una búsqueda general.
      3. Siempre cita la 'fuente' de donde extrajiste la información en tu respuesta final.
      4. Si la herramienta no devuelve resultados útiles, dile al usuario que no tienes esa información, no inventes datos.`],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]);

    // 4. Build and Execute the Agent
    const agent = await createToolCallingAgent({ llm, tools, prompt });
    
    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: true, // Useful for debugging tool calls in NestJS console
    });

    const result = await agentExecutor.invoke({
      input: question,
      currentProjectId: currentProjectId || "Ninguno especificado",
      chat_history: chatHistory,
    });

    return result.output;
  }
}
```

3. The Chat Controller (chat.controller.ts)
Expose the service via a POST endpoint.

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ChatService } from './chat.service';

class AskQuestionDto {
  question: string;
  projectId?: string;
  chatHistory?: any[]; // For future conversation memory implementation
}

@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  async ask(@Body() body: AskQuestionDto) {
    const answer = await this.chatService.askAgent(
      body.question,
      body.projectId,
      body.chatHistory || []
    );

    return {
      success: true,
      data: answer,
    };
  }
}
```

Current Task for Cursor Agent
Implement chat.tools.ts, chat.service.ts, and chat.controller.ts exactly as specified above.

Ensure the ChatModule imports the WeaviateModule so the WeaviateService can be injected.

Test the logic: Verify that if a user asks "¿Qué es un POT?" (General), the tool executes WITHOUT a projectId. If they ask "¿Cuánto cuesta la separación en este proyecto?", the tool executes WITH the injected currentProjectId.
