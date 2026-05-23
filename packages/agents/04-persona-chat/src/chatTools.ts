import type { FunctionDeclaration } from '@google/generative-ai';
import { SchemaType } from '@google/generative-ai';
import { vectorSearchLibrary, vectorSearchQA, getLibraryByCoach } from '@coaching/tools';
import type { ToolExecutor } from '@coaching/tools';

// ── Tool declarations ────────────────────────────────────────────────────────

export const CHAT_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'search_library',
    description: "Search the coach's resource library for content relevant to the current topic. Use when you need supporting evidence, a framework, or a specific resource.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: {
          type: SchemaType.STRING,
          description: 'Specific search query based on the client\'s situation',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_qa',
    description: "Search the coach's personal Q&A for relevant first-hand experience, opinions, or answers. Use first before searching the library.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: {
          type: SchemaType.STRING,
          description: 'Search query matching the client\'s question or topic',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'recommend_resource',
    description: 'Surface a specific library resource as a card recommendation to the client. Call this when you reference a book, article, video, or other resource in your response.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        item_id: {
          type: SchemaType.STRING,
          description: 'The itemId of the library resource to recommend',
        },
        title: {
          type: SchemaType.STRING,
          description: 'Title of the resource (for logging)',
        },
        reason: {
          type: SchemaType.STRING,
          description: 'Brief reason why this resource is relevant (for logging)',
        },
      },
      required: ['item_id', 'title', 'reason'],
    },
  },
];

// ── Tool executor factory ────────────────────────────────────────────────────

export function buildToolExecutor(
  coachId: string,
  recommendedItemIds: string[],
): ToolExecutor {
  return async (name: string, args: Record<string, unknown>) => {
    if (name === 'search_qa') {
      const query = String(args.query ?? '');
      const matches = await vectorSearchQA(coachId, query, 3);
      if (!matches.length) return 'No relevant personal experience found.';
      return matches
        .map(m => `Q: ${m.metadata.question}\nA: ${m.metadata.answer}`)
        .join('\n\n');
    }

    if (name === 'search_library') {
      const query = String(args.query ?? '');
      const matches = await vectorSearchLibrary(coachId, query, 5);
      if (!matches.length) return 'No relevant library content found.';

      // Fetch item metadata so we can include buy links + titles
      const allItems = await getLibraryByCoach(coachId);
      const itemMap = new Map(allItems.map(i => [i.itemId, i]));

      return matches
        .map(m => {
          const item = itemMap.get(m.metadata.itemId);
          if (!item) return m.metadata.text ?? '';
          const buyNote = item.itemType === 'book' && item.buyLink
            ? ` (buy: ${item.buyLink})`
            : '';
          return `[${item.itemType.toUpperCase()}] "${item.title}"${buyNote} (id: ${item.itemId}): ${m.metadata.text ?? item.description ?? ''}`;
        })
        .join('\n\n');
    }

    if (name === 'recommend_resource') {
      const itemId = String(args.item_id ?? '');
      if (itemId && !recommendedItemIds.includes(itemId)) {
        recommendedItemIds.push(itemId);
      }
      return { success: true };
    }

    return { error: `Unknown tool: ${name}` };
  };
}
