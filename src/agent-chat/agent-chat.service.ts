import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { RagAgentService } from '../rag-agent/rag-agent.service';
import { ProjectsService } from '../projects/projects.service';
import {
  createSearchProjectDocumentsTool,
  createSearchProjectsTool,
} from './tools/agent-tools.factory';
import type { AgentChatResult, ChatMessageInput } from './agent-chat.types';
import type { StructuredToolInterface } from '@langchain/core/tools';

const OPENAI_API_KEY_ENV = 'OPENAI_API_KEY';
const DEFAULT_MODEL_NAME = 'gpt-4o';
const DEFAULT_TEMPERATURE = 0;
const MAX_AGENT_ITERATIONS = 10;

const SYSTEM_PROMPT = `You are the expert sales assistant for the construction company (parcelization / lots).
Your goal is to combine structured data (database: projects) with unstructured data (documents) to answer the sales team accurately.

Rules:
1. For general project features (e.g. climate, pool, prices), use 'list_projects' first.
2. For contracts, credits, or qualitative descriptions, use 'search_project_documents'.
3. For combined questions (e.g. "Projects with a pool that offer easy credit"), FIRST list or identify projects, get their IDs, THEN use those IDs in 'search_project_documents' to search documents.
4. Always mention the project name and the source of your information.`;

/**
 * Service that runs the LLM agent with tools to answer questions using projects and RAG documents.
 */
@Injectable()
export class AgentChatService {
  public constructor(
    private readonly configService: ConfigService,
    private readonly ragAgentService: RagAgentService,
    private readonly projectsService: ProjectsService,
  ) {}

  /**
   * Sends a question to the agent and returns the final answer and document sources from RAG when used.
   */
  public async askQuestion(
    question: string,
    chatHistory: ChatMessageInput[] = [],
  ): Promise<AgentChatResult> {
    const collectedSources = new Set<string>();
    const collectDocumentSources = (sources: readonly string[]): void => {
      for (const s of sources) {
        collectedSources.add(s);
      }
    };
    const tools: StructuredToolInterface[] = [
      createSearchProjectsTool(this.projectsService),
      createSearchProjectDocumentsTool(
        this.ragAgentService,
        collectDocumentSources,
      ),
    ];
    const llm = this.createLlm();
    const modelWithTools = llm.bindTools(tools);
    const messages = this.buildMessages(question, chatHistory);
    let currentMessages: BaseMessage[] = [...messages];
    let iterations = 0;
    while (iterations < MAX_AGENT_ITERATIONS) {
      iterations += 1;
      const response = (await modelWithTools.invoke(
        currentMessages,
      )) as AIMessageChunk;
      const toolCalls = response.tool_calls ?? [];
      if (toolCalls.length === 0) {
        const content =
          typeof response.content === 'string'
            ? response.content
            : String(response.content ?? '');
        const output = content.trim() || 'No response generated.';
        return {
          output,
          sources: this.sortSources(collectedSources),
        };
      }
      currentMessages = [...currentMessages, response];
      const toolResults = await this.runToolCalls(toolCalls, tools);
      for (const { toolCallId, content } of toolResults) {
        currentMessages.push(
          new ToolMessage({
            content,
            tool_call_id: toolCallId,
          }),
        );
      }
    }
    return {
      output:
        'Maximum agent iterations reached. Please try a simpler question.',
      sources: this.sortSources(collectedSources),
    };
  }

  private sortSources(sources: Set<string>): string[] {
    return [...sources].sort((left, right) => left.localeCompare(right));
  }

  private createLlm(): ChatOpenAI {
    const apiKey =
      this.configService.get<string>(OPENAI_API_KEY_ENV) ??
      process.env[OPENAI_API_KEY_ENV] ??
      '';
    if (!apiKey) {
      throw new Error(`${OPENAI_API_KEY_ENV} is not configured.`);
    }
    return new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: DEFAULT_MODEL_NAME,
      temperature: DEFAULT_TEMPERATURE,
    });
  }

  private buildMessages(
    question: string,
    chatHistory: ChatMessageInput[],
  ): BaseMessage[] {
    const out: BaseMessage[] = [new SystemMessage(SYSTEM_PROMPT)];
    for (const msg of chatHistory) {
      if (msg.role === 'user') {
        out.push(new HumanMessage(msg.content));
      } else if (msg.role === 'assistant') {
        out.push(new AIMessage(msg.content));
      }
    }
    out.push(new HumanMessage(question));
    return out;
  }

  private async runToolCalls(
    toolCalls: Array<{ id?: string; name: string; args: Record<string, unknown> }>,
    tools: StructuredToolInterface[],
  ): Promise<Array<{ toolCallId: string; content: string }>> {
    const results: Array<{ toolCallId: string; content: string }> = [];
    const toolMap = new Map(tools.map((t) => [t.name, t]));
    for (const tc of toolCalls) {
      const toolCallId = tc.id ?? `call_${Date.now()}`;
      const tool = toolMap.get(tc.name);
      let content: string;
      if (!tool) {
        content = `Unknown tool: ${tc.name}`;
      } else {
        try {
          const output = await tool.invoke(tc.args);
          content =
            typeof output === 'string' ? output : JSON.stringify(output);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          content = `Tool error: ${message}`;
        }
      }
      results.push({ toolCallId, content });
    }
    return results;
  }
}
