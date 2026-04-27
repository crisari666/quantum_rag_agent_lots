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
import type { ProjectDocument } from '../projects/schemas/project.schema';
import {
  createSearchProjectDocumentsTool,
  createSearchProjectsTool,
  LIST_PROJECTS_EMPTY_TOOL_OUTPUT,
} from './tools/agent-tools.factory';
import {
  buildAgentChatMediaFromProjects,
  filterProjectsByQuestionKeywords,
} from './agent-chat-media.builder';
import {
  AgentChatInformationGap,
  type AgentChatResult,
  type AgentChatMediaProject,
  type ChatMessageInput,
} from './agent-chat.types';
import type { StructuredToolInterface } from '@langchain/core/tools';

const OPENAI_API_KEY_ENV = 'OPENAI_API_KEY';
const DEFAULT_MODEL_NAME = 'gpt-4o';
const DEFAULT_TEMPERATURE = 0;
const MAX_AGENT_ITERATIONS = 10;

const SYSTEM_PROMPT = `You are the expert sales assistant for the construction company (parcelization / lots).
Your goal is to combine structured data (database: projects) with unstructured data (documents) to answer the sales team accurately.

Rules:
1. For general project features (e.g. climate, pool, prices, images, gallery, videos, brochure, plano), use 'list_projects' first.
2. For contracts, credits, or qualitative descriptions, use 'search_project_documents'.
3. For combined questions (e.g. "Projects with a pool that offer easy credit"), FIRST list or identify projects, get their IDs, THEN use those IDs in 'search_project_documents' to search documents.
4. If the user gives a project name (but no ID), ALWAYS call 'list_projects' to resolve the project ID before calling 'search_project_documents'.
5. Never send project titles/names to 'search_project_documents.projectIds'; pass IDs only.
6. If no project can be resolved from the provided name, ask a short clarification question before searching documents.
7. Always mention the project name and the source of your information.
8. For prices: only state COP/USD amounts that appear in 'list_projects' (priceSell, priceSellUsd, and each lotOptions row). If lotOptions is [], say the list price is priceSell (and priceSellUsd if non-zero); do not invent extra tiers. If lotOptions has rows, present each variant's area and price clearly.
9. Never invent numeric prices or lot sizes from documents alone when 'list_projects' was not used or contradicts the documents; prefer structured list_projects data for figures.
10. For photos, galería, imágenes, videos, brochure, plano, or material visual: use 'list_projects' and answer from each project's media JSON (images, cardProject, horizontalImages, verticalVideos, reelVideo, plane, brochure). List filenames or counts; if arrays are empty and strings blank, say no media is registered for that project—do not claim RAG found nothing without checking list_projects first.
11. Match the user's city or region (e.g. Cartagena) to location, city, or title fields in list_projects before describing a project's media.`;

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
    const informationGaps = new Set<AgentChatInformationGap>();
    const collectDocumentSources = (sources: readonly string[]): void => {
      for (const s of sources) {
        collectedSources.add(s);
      }
    };
    const onDocumentSearchNoHits = (): void => {
      informationGaps.add(AgentChatInformationGap.DOCUMENT_SEARCH_NO_HITS);
    };
    let lastListedProjects: readonly ProjectDocument[] | null = null;
    const tools: StructuredToolInterface[] = [
      createSearchProjectsTool(this.projectsService, (projects) => {
        lastListedProjects = projects;
      }),
      createSearchProjectDocumentsTool(
        this.ragAgentService,
        collectDocumentSources,
        onDocumentSearchNoHits,
      ),
    ];
    const llm = this.createLlm();
    const modelWithTools = llm.bindTools(tools);
    const messages = this.buildMessages(question, chatHistory);
    const resolveMedia = (): readonly AgentChatMediaProject[] => {
      const list = lastListedProjects;
      if (!list?.length) {
        return [];
      }
      const narrowed = filterProjectsByQuestionKeywords([...list], question);
      if (!narrowed?.length) {
        return [];
      }
      return buildAgentChatMediaFromProjects(narrowed);
    };
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
        const trimmed = content.trim();
        if (trimmed.length === 0) {
          informationGaps.add(AgentChatInformationGap.EMPTY_MODEL_OUTPUT);
        }
        const output = trimmed || 'No response generated.';
        return {
          output,
          sources: this.sortSources(collectedSources),
          informationGaps: [...informationGaps],
          media: resolveMedia(),
        };
      }
      currentMessages = [...currentMessages, response];
      const toolResults = await this.runToolCalls(
        toolCalls,
        tools,
        informationGaps,
      );
      for (const { toolCallId, content } of toolResults) {
        currentMessages.push(
          new ToolMessage({
            content,
            tool_call_id: toolCallId,
          }),
        );
      }
    }
    informationGaps.add(AgentChatInformationGap.MAX_ITERATIONS);
    return {
      output:
        'Maximum agent iterations reached. Please try a simpler question.',
      sources: this.sortSources(collectedSources),
      informationGaps: [...informationGaps],
      media: resolveMedia(),
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
    informationGaps: Set<AgentChatInformationGap>,
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
          if (
            tc.name === 'list_projects' &&
            content === LIST_PROJECTS_EMPTY_TOOL_OUTPUT
          ) {
            informationGaps.add(AgentChatInformationGap.NO_ENABLED_PROJECTS);
          }
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
