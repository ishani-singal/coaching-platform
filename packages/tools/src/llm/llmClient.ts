/**
 * Unified LLM client.
 *
 * Reads LLM_PROVIDER env var at call-time:
 *   gemini       → Google Gemini 2.5 Flash (default)
 *   azure-openai → Azure AI Foundry endpoint (OpenAI-compatible)
 *
 * Embeddings use Gemini text-embedding-004 when LLM_PROVIDER=gemini,
 * or Azure OpenAI (AZURE_OPENAI_EMBEDDING_DEPLOYMENT) when LLM_PROVIDER=azure-openai.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { FunctionDeclaration, Part, Content } from '@google/generative-ai';
import OpenAI from 'openai';

export type LLMProvider = 'gemini' | 'azure-openai';

export interface ThoughtChunk {
  type: 'thought' | 'text';
  chunk: string;
}

export type ToolChunk =
  | { type: 'tool_start'; toolCallId: string; toolName: string }
  | { type: 'tool_end';   toolCallId: string; toolName: string; result: unknown }
  | ThoughtChunk;

export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<unknown>;

export interface LLMClient {
  generateText(systemPrompt: string, userPrompt: string): Promise<string>;
  streamChat(
    systemPrompt: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    message: string
  ): AsyncGenerator<string>;
  streamChatWithThinking(
    systemPrompt: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    message: string
  ): AsyncGenerator<ThoughtChunk>;
  streamChatWithTools(
    systemPrompt: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    message: string,
    tools: FunctionDeclaration[],
    executor: ToolExecutor
  ): AsyncGenerator<ToolChunk>;
}

// ── Retry helper ─────────────────────────────────────────────────────────────

function parseRetryAfterMs(errorMessage: string): number {
  // Gemini includes "Please retry in X.Xs" in the error body
  const match = errorMessage.match(/retry in (\d+(?:\.\d+)?)s/i);
  return match ? Math.ceil(parseFloat(match[1])) * 1000 + 500 : 15_000;
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e: unknown) {
      lastError = e;
      const msg = (e as Error).message ?? String(e);
      const isRateLimit = msg.includes('429') || msg.toLowerCase().includes('quota');
      if (!isRateLimit || attempt === maxAttempts) throw e;
      const waitMs = parseRetryAfterMs(msg);
      console.log(`[llm] Rate limited. Retrying in ${waitMs}ms (attempt ${attempt}/${maxAttempts})…`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  throw lastError;
}

// ── Gemini implementation ────────────────────────────────────────────────────

function createGeminiClient(): LLMClient {
  return {
    async generateText(systemPrompt, userPrompt) {
      return withRetry(async () => {
        const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genai.getGenerativeModel({
          model: 'gemini-2.5-flash',
          systemInstruction: systemPrompt,
        });
        const result = await model.generateContent(userPrompt);
        return result.response.text();
      });
    },

    async *streamChat(systemPrompt, history, message) {
      const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genai.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt,
      });
      const chat = model.startChat({
        history: history.map(m => ({
          role:  m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      });
      // streaming can't be wrapped in withRetry (generator), but it's less likely to hit quota mid-stream
      const result = await withRetry(() => chat.sendMessageStream(message));
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) yield text;
      }
    },

    async *streamChatWithThinking(systemPrompt, history, message) {
      // Gemini 2.5 Flash thinks internally — we stream text only.
      // (The agent already ignores 'thought' events from Gemini, so there is
      //  no value in requesting thought tokens via thinkingConfig.)
      const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genai.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt,
      });
      const chat = model.startChat({
        history: history.map(m => ({
          role:  m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      });
      const result = await withRetry(() => chat.sendMessageStream(message));
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) yield { type: 'text', chunk: text } as ThoughtChunk;
      }
    },

    async *streamChatWithTools(systemPrompt, history, message, tools, executor) {
      const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genai.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: tools }],
      });

      // Build mutable contents for the agentic loop
      const contents: Content[] = [
        ...history.map(m => ({
          role:  m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        { role: 'user', parts: [{ text: message }] },
      ];

      const MAX_ITERS = 5;
      for (let iter = 0; iter < MAX_ITERS; iter++) {
        const response = await withRetry(() => model.generateContent({ contents }));
        const candidate = response.response.candidates?.[0];
        if (!candidate) break;

        const parts: Part[] = candidate.content?.parts ?? [];

        // Collect function calls
        const fnCalls = parts.filter(
          (p): p is Part & { functionCall: { name: string; args: Record<string, unknown> } } =>
            'functionCall' in p && !!p.functionCall
        );

        if (fnCalls.length === 0) {
          // No tool calls — stream the final text response
          const fullText = parts.map(p => ('text' in p ? p.text : '')).join('');
          if (fullText) {
            // Stream word-by-word so the line-filter in the caller works correctly
            for (const line of fullText.split('\n')) {
              yield { type: 'text', chunk: line + '\n' } as ToolChunk;
            }
          }
          break;
        }

        // Append model turn before executing tools
        contents.push({ role: 'model', parts });

        // Execute each tool call
        const fnResponseParts: Part[] = [];
        for (const fc of fnCalls) {
          const { name, args } = fc.functionCall;
          const toolCallId = `${name}-${Date.now()}`;

          yield { type: 'tool_start', toolCallId, toolName: name } as ToolChunk;

          let result: unknown;
          try {
            result = await executor(name, args);
          } catch (e) {
            result = { error: String(e) };
          }

          yield { type: 'tool_end', toolCallId, toolName: name, result } as ToolChunk;

          fnResponseParts.push({
            functionResponse: { name, response: result as object },
          } as Part);
        }

        // Append tool results and loop
        contents.push({ role: 'user', parts: fnResponseParts });
      }
    },
  };
}

// ── Azure OpenAI implementation ──────────────────────────────────────────────

function createAzureOpenAIClient(): LLMClient {
  const client = new OpenAI({
    baseURL: process.env.AZURE_OPENAI_ENDPOINT!,
    apiKey:  process.env.AZURE_OPENAI_API_KEY!,
  });
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'Phi-4-mini-reasoning-1';

  return {
    async generateText(systemPrompt, userPrompt) {
      const completion = await client.chat.completions.create({
        model: deployment,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
      });
      return completion.choices[0]?.message?.content ?? '';
    },

    async *streamChat(systemPrompt, history, message) {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...history.map(m => ({
          role:    m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user', content: message },
      ];

      const stream = await client.chat.completions.create({
        model: deployment,
        messages,
        stream: true,
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) yield text;
      }
    },

    async *streamChatWithThinking(systemPrompt, history, message) {
      // Phi-4 and similar reasoning models on Azure emit thinking inside <think>…</think>
      // tags in the response content. Parse these out and yield them as thought chunks.
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...history.map(m => ({
          role:    m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user', content: message },
      ];

      const stream = await client.chat.completions.create({
        model: deployment,
        messages,
        stream: true,
      });

      // Buffer to detect cross-chunk <think> tag boundaries
      let buf = '';
      let inThink = false;

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (!text) continue;
        buf += text;

        // Process buffer character by character for tag detection
        while (buf.length > 0) {
          if (inThink) {
            const closeIdx = buf.indexOf('</think>');
            if (closeIdx === -1) {
              // Still inside think block — need more data (keep up to 8 chars as look-ahead buffer)
              if (buf.length > 8) {
                yield { type: 'thought', chunk: buf.slice(0, buf.length - 8) } as ThoughtChunk;
                buf = buf.slice(buf.length - 8);
              }
              break;
            }
            // Emit thought content up to closing tag
            if (closeIdx > 0) yield { type: 'thought', chunk: buf.slice(0, closeIdx) } as ThoughtChunk;
            buf = buf.slice(closeIdx + '</think>'.length);
            inThink = false;
          } else {
            const openIdx = buf.indexOf('<think>');
            if (openIdx === -1) {
              // No think tag — keep last 6 chars as partial-tag buffer
              if (buf.length > 7) {
                yield { type: 'text', chunk: buf.slice(0, buf.length - 7) } as ThoughtChunk;
                buf = buf.slice(buf.length - 7);
              }
              break;
            }
            // Emit text before the opening tag
            if (openIdx > 0) yield { type: 'text', chunk: buf.slice(0, openIdx) } as ThoughtChunk;
            buf = buf.slice(openIdx + '<think>'.length);
            inThink = true;
          }
        }
      }

      // Flush remaining buffer
      if (buf.length > 0) {
        yield { type: inThink ? 'thought' : 'text', chunk: buf } as ThoughtChunk;
      }
    },

    async *streamChatWithTools(systemPrompt, history, message, _tools, _executor) {
      // Azure/Phi-4 does not support function calling — fall back to plain streaming
      yield* this.streamChatWithThinking(systemPrompt, history, message);
    },
  };
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function getLLMClient(provider?: LLMProvider): LLMClient {
  const p = provider ?? (process.env.LLM_PROVIDER as LLMProvider | undefined) ?? 'azure-openai';
  return p === 'azure-openai' ? createAzureOpenAIClient() : createGeminiClient();
}
