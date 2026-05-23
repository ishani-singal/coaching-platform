import { NextRequest } from 'next/server';
import { GoogleGenerativeAI, FunctionDeclaration, Content, Part, SchemaType } from '@google/generative-ai';

const AGENT_BASE = `http://localhost:${process.env.AGENT_PROGRAM_BUILDER_PORT ?? '3001'}`;

// -- Tool definitions (Gemini FunctionDeclaration format) ---------------------

const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'create_module',
    description: 'Create a new standalone coaching module',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title:    { type: SchemaType.STRING, description: 'Module title' },
        category: { type: SchemaType.STRING, description: 'Module category (e.g. mindset, nutrition, fitness)' },
      },
      required: ['title', 'category'],
    },
  },
  {
    name: 'update_module',
    description: 'Update the title or category of an existing module',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        moduleId: { type: SchemaType.STRING },
        title:    { type: SchemaType.STRING },
        category: { type: SchemaType.STRING },
      },
      required: ['moduleId'],
    },
  },
  {
    name: 'delete_module',
    description: 'Delete an existing module and all its sections',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { moduleId: { type: SchemaType.STRING } },
      required: ['moduleId'],
    },
  },
  {
    name: 'add_section',
    description: 'Add a new content section to a module',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        moduleId:    { type: SchemaType.STRING },
        order:       { type: SchemaType.NUMBER, description: 'Zero-based position in the module' },
        contentType: { type: SchemaType.STRING, description: 'One of: text, video, long_form_qa, single_choice, multi_choice, match_following, rating, image_embed, file' },
        body:        { type: SchemaType.OBJECT, description: 'Content body; shape depends on contentType', properties: {} },
      },
      required: ['moduleId', 'order', 'contentType', 'body'],
    },
  },
  {
    name: 'update_section',
    description: 'Update the content of an existing section',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        moduleId:    { type: SchemaType.STRING },
        sectionId:   { type: SchemaType.STRING },
        contentType: { type: SchemaType.STRING },
        body:        { type: SchemaType.OBJECT, properties: {} },
      },
      required: ['moduleId', 'sectionId'],
    },
  },
  {
    name: 'delete_section',
    description: 'Delete a section from a module',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        moduleId:  { type: SchemaType.STRING },
        sectionId: { type: SchemaType.STRING },
      },
      required: ['moduleId', 'sectionId'],
    },
  },
  {
    name: 'get_module_detail',
    description: 'Get the full detail of a module including its sections',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { moduleId: { type: SchemaType.STRING } },
      required: ['moduleId'],
    },
  },
  {
    name: 'build_program',
    description: 'Scaffold a program with periods and assign existing modules to those periods',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title:       { type: SchemaType.STRING },
        description: { type: SchemaType.STRING },
        periods: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              label:     { type: SchemaType.STRING },
              moduleIds: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            },
          },
        },
      },
      required: ['title', 'periods'],
    },
  },
  {
    name: 'build_program_with_periods',
    description: 'Build a program and create new modules within periods simultaneously',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title:       { type: SchemaType.STRING },
        description: { type: SchemaType.STRING },
        periods: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              label:   { type: SchemaType.STRING },
              modules: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    title:    { type: SchemaType.STRING },
                    category: { type: SchemaType.STRING },
                  },
                },
              },
            },
          },
        },
      },
      required: ['title', 'periods'],
    },
  },
  {
    name: 'create_inline_module',
    description: 'Create a new module and immediately add it to a period in a program',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        programId:    { type: SchemaType.STRING },
        periodOrder:  { type: SchemaType.NUMBER },
        title:        { type: SchemaType.STRING },
        category:     { type: SchemaType.STRING },
        displayOrder: { type: SchemaType.NUMBER },
      },
      required: ['programId', 'periodOrder', 'title', 'category'],
    },
  },
  {
    name: 'update_program',
    description: 'Update a program title or description',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        programId:   { type: SchemaType.STRING },
        title:       { type: SchemaType.STRING },
        description: { type: SchemaType.STRING },
      },
      required: ['programId'],
    },
  },
  {
    name: 'delete_program',
    description: 'Delete a program',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { programId: { type: SchemaType.STRING } },
      required: ['programId'],
    },
  },
  {
    name: 'add_module_to_period',
    description: 'Add an existing module to a period of a program',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        programId:    { type: SchemaType.STRING },
        moduleId:     { type: SchemaType.STRING },
        periodOrder:  { type: SchemaType.NUMBER },
        displayOrder: { type: SchemaType.NUMBER },
      },
      required: ['programId', 'moduleId', 'periodOrder'],
    },
  },
  {
    name: 'create_program_period',
    description: 'Add a new period to an existing program',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        programId:   { type: SchemaType.STRING },
        label:       { type: SchemaType.STRING },
        periodOrder: { type: SchemaType.NUMBER },
      },
      required: ['programId', 'label'],
    },
  },
  {
    name: 'delete_program_period',
    description: 'Delete a period from a program',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        programId:   { type: SchemaType.STRING },
        periodOrder: { type: SchemaType.NUMBER },
      },
      required: ['programId', 'periodOrder'],
    },
  },
  {
    name: 'rename_program_period',
    description: 'Rename a period in a program',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        programId:   { type: SchemaType.STRING },
        periodOrder: { type: SchemaType.NUMBER },
        label:       { type: SchemaType.STRING },
      },
      required: ['programId', 'periodOrder', 'label'],
    },
  },
  {
    name: 'assemble_package',
    description: 'Assemble a coaching package from programs',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title:        { type: SchemaType.STRING },
        description:  { type: SchemaType.STRING },
        programIds:   { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        pricingModel: { type: SchemaType.STRING, description: 'One of: free, one_time, subscription' },
        priceUsd:     { type: SchemaType.NUMBER },
        currencies:   { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      },
      required: ['title', 'programIds', 'pricingModel'],
    },
  },
  {
    name: 'update_package',
    description: 'Update a coaching package title, description, or pricing',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        packageId:    { type: SchemaType.STRING },
        title:        { type: SchemaType.STRING },
        description:  { type: SchemaType.STRING },
        pricingModel: { type: SchemaType.STRING },
        priceUsd:     { type: SchemaType.NUMBER },
      },
      required: ['packageId'],
    },
  },
  {
    name: 'publish_package',
    description: 'Publish a coaching package to make it available to clients',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { packageId: { type: SchemaType.STRING } },
      required: ['packageId'],
    },
  },
  {
    name: 'unpublish_package',
    description: 'Unpublish a coaching package',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { packageId: { type: SchemaType.STRING } },
      required: ['packageId'],
    },
  },
  {
    name: 'delete_package',
    description: 'Delete a coaching package',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { packageId: { type: SchemaType.STRING } },
      required: ['packageId'],
    },
  },
  {
    name: 'list_modules',
    description: 'List all modules belonging to the current coach',
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: 'list_programs',
    description: 'List all programs belonging to the current coach',
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: 'list_packages',
    description: 'List all packages belonging to the current coach',
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: 'get_program_detail',
    description: 'Get full program detail including periods and their modules',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { programId: { type: SchemaType.STRING } },
      required: ['programId'],
    },
  },
  {
    name: 'get_package_detail',
    description: 'Get full package detail including programs',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { packageId: { type: SchemaType.STRING } },
      required: ['packageId'],
    },
  },
  {
    name: 'get_module_by_name',
    description: 'Find a module by its title (case-insensitive partial match) and return its full detail including sections',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { name: { type: SchemaType.STRING, description: 'Module title or partial title to search for' } },
      required: ['name'],
    },
  },
  {
    name: 'get_program_by_name',
    description: 'Find a program by its title (case-insensitive partial match) and return its full detail including periods and modules',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { name: { type: SchemaType.STRING, description: 'Program title or partial title to search for' } },
      required: ['name'],
    },
  },
  {
    name: 'get_package_by_name',
    description: 'Find a package by its title (case-insensitive partial match) and return its full detail including programs',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { name: { type: SchemaType.STRING, description: 'Package title or partial title to search for' } },
      required: ['name'],
    },
  },
];

// -- Tools that mutate state and should trigger a UI refresh ------------------

const REFRESH_TOOLS = new Set([
  'create_module', 'update_module', 'delete_module',
  'add_section',   'update_section', 'delete_section',
  'build_program', 'build_program_with_periods', 'create_inline_module',
  'update_program', 'delete_program', 'add_module_to_period',
  'create_program_period', 'delete_program_period', 'rename_program_period',
  'assemble_package', 'update_package', 'publish_package', 'unpublish_package', 'delete_package',
]);

// -- Helpers ------------------------------------------------------------------

function sseChunk(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

async function callAgent(action: string, params: Record<string, unknown>): Promise<unknown> {
  const token = process.env.SHELL_INTERNAL_TOKEN;
  const res = await fetch(`${AGENT_BASE}/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, params }),
  });
  return res.json();
}

// -- Route handler ------------------------------------------------------------

interface IncomingMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { messages: IncomingMessage[] };
  const incomingMessages = body.messages ?? [];

  // Fetch system context from agent
  let systemInstruction = 'You are a helpful coaching program builder assistant. Help coaches create modules, programs, and packages. Categories: mindset, nutrition, fitness, business, leadership, wellness, productivity. Pricing models: free, one_time, subscription.';
  try {
    const token = process.env.SHELL_INTERNAL_TOKEN;
    const ctxRes = await fetch(`${AGENT_BASE}/context`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (ctxRes.ok) {
      const ctxData = await ctxRes.json() as { systemPrompt?: string; context?: string };
      if (ctxData.systemPrompt) systemInstruction = ctxData.systemPrompt;
      else if (ctxData.context)  systemInstruction = ctxData.context;
    }
  } catch {
    // use default
  }

  // Convert incoming messages to Gemini Content history (all but last user message)
  const history: Content[] = incomingMessages.slice(0, -1).map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const lastMessage = incomingMessages[incomingMessages.length - 1]?.content ?? '';

  const encoder = new TextEncoder();
  const stream  = new ReadableStream({
    async start(controller) {
      function emit(chunk: string) {
        controller.enqueue(encoder.encode(chunk));
      }

      const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genai.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction,
        tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
      });

      // Mutable conversation contents for the agentic loop
      const contents: Content[] = [
        ...history,
        { role: 'user', parts: [{ text: lastMessage }] },
      ];

      const MAX_ITER = 10;

      try {
        for (let iter = 0; iter < MAX_ITER; iter++) {
          const response = await model.generateContent({ contents });

          const candidate = response.response.candidates?.[0];
          if (!candidate) break;

          const parts: Part[] = candidate.content?.parts ?? [];

          // Emit text parts
          for (const part of parts) {
            if ('text' in part && part.text) {
              emit(sseChunk({ type: 'text', chunk: part.text }));
            }
          }

          // Collect function calls
          const fnCalls = parts.filter(
            (p): p is Part & { functionCall: { name: string; args: Record<string, unknown> } } =>
              'functionCall' in p && !!p.functionCall
          );

          // No function calls → done
          if (fnCalls.length === 0) break;

          // Append model turn to contents
          contents.push({ role: 'model', parts });

          // Execute each tool call
          const fnResponseParts: Part[] = [];

          for (const fc of fnCalls) {
            const { name, args } = fc.functionCall;
            const toolCallId = `${name}-${Date.now()}`;

            emit(sseChunk({
              type:  'agui',
              event: { type: 'TOOL_CALL_START', toolCallId, toolName: name },
            }));

            let result: unknown;
            try {
              result = await callAgent(name, args);
            } catch (e) {
              result = { success: false, message: String(e) };
            }

            emit(sseChunk({
              type:  'agui',
              event: { type: 'TOOL_CALL_END', toolCallId, toolName: name, result },
            }));

            if (REFRESH_TOOLS.has(name)) {
              emit(sseChunk({ type: 'agui', event: { type: 'REFRESH_CONTENT' } }));
            }

            fnResponseParts.push({
              functionResponse: { name, response: result as object },
            });
          }

          // Append function responses as a user turn
          contents.push({ role: 'user', parts: fnResponseParts });
        }
      } catch (err) {
        emit(sseChunk({ type: 'error', message: String(err) }));
      }

      emit('data: [DONE]\n\n');
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
}
