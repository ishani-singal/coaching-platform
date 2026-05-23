import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { PineconeMatch } from '@coaching/sdk';

let _pinecone: Pinecone | null = null;
function getPinecone(): Pinecone {
  if (!_pinecone) {
    _pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  }
  return _pinecone;
}

function getIndex() {
  const indexName = process.env.PINECONE_INDEX ?? 'coaching-platform';
  return getPinecone().index(indexName);
}

async function embed(text: string): Promise<number[]> {
  // When LLM_PROVIDER=azure-openai, embeddings use AZURE_OPENAI_EMBEDDING_DEPLOYMENT (text-embedding-3-small).
  // EMBEDDING_PROVIDER can override this independently (e.g. force gemini even when LLM is Azure).
  const embeddingProvider = process.env.EMBEDDING_PROVIDER ?? process.env.LLM_PROVIDER ?? 'gemini';

  if (embeddingProvider === 'azure-openai') {
    const client = new OpenAI({
      baseURL: process.env.AZURE_OPENAI_ENDPOINT!,
      apiKey:  process.env.AZURE_OPENAI_API_KEY!,
    });
    const deployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ?? 'text-embedding-3-small';
    // Pass dimensions=768 to match the Pinecone index dimension (same as Gemini text-embedding-004)
    const res = await client.embeddings.create({ model: deployment, input: text, dimensions: 768 });
    return res.data[0].embedding;
  }

  // default: Gemini text-embedding-004 (768 dimensions)
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genai.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

function chunkText(text: string, maxTokens = 500): string[] {
  // Rough split: ~4 chars per token
  const chunkSize = maxTokens * 4;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize).trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks.length ? chunks : [text];
}

// ── Library namespace: lib_<coachId> ─────────────────────────────────────────

export async function upsertLibraryChunks(
  coachId: string,
  itemId: string,
  chunks: string[],
  metadata: Record<string, string>
): Promise<void> {
  const ns = getIndex().namespace(`lib_${coachId}`);
  const vectors = await Promise.all(
    chunks.map(async (chunk, i) => ({
      id: `${itemId}_${i}`,
      values: await embed(chunk),
      metadata: { ...metadata, itemId, chunkIndex: String(i), text: chunk.slice(0, 512) },
    }))
  );
  await ns.upsert(vectors);
}

export async function upsertLibraryItem(
  coachId: string,
  itemId: string,
  fullText: string,
  metadata: Record<string, string>
): Promise<void> {
  const chunks = chunkText(fullText);
  await upsertLibraryChunks(coachId, itemId, chunks, metadata);
}

export async function vectorSearchLibrary(
  coachId: string,
  query: string,
  topK = 5
): Promise<PineconeMatch[]> {
  const ns = getIndex().namespace(`lib_${coachId}`);
  const queryEmbedding = await embed(query);
  const result = await ns.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });
  return (result.matches ?? []).map(m => ({
    id: m.id,
    score: m.score ?? 0,
    metadata: (m.metadata ?? {}) as Record<string, string>,
  }));
}

export async function deleteLibraryItemVectors(
  coachId: string,
  itemId: string
): Promise<void> {
  const ns = getIndex().namespace(`lib_${coachId}`);
  // Delete all chunk vectors for this item (prefix-based delete not supported in all plans,
  // so we list by metadata filter if available, otherwise delete by known IDs up to 100 chunks)
  const ids = Array.from({ length: 100 }, (_, i) => `${itemId}_${i}`);
  await ns.deleteMany(ids);
}

// ── Persona namespace: persona_<coachId> ─────────────────────────────────────

export async function upsertPersonaChunks(
  coachId: string,
  chunks: string[],
  metadata: Record<string, string>
): Promise<void> {
  const ns = getIndex().namespace(`persona_${coachId}`);
  const vectors = await Promise.all(
    chunks.map(async (chunk, i) => ({
      id: `${coachId}_persona_${i}`,
      values: await embed(chunk),
      metadata: { ...metadata, coachId, chunkIndex: String(i), text: chunk.slice(0, 512) },
    }))
  );
  await ns.upsert(vectors);
}

export async function vectorSearchPersona(
  coachId: string,
  query: string,
  topK = 3
): Promise<PineconeMatch[]> {
  const ns = getIndex().namespace(`persona_${coachId}`);
  const queryEmbedding = await embed(query);
  const result = await ns.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });
  return (result.matches ?? []).map(m => ({
    id: m.id,
    score: m.score ?? 0,
    metadata: (m.metadata ?? {}) as Record<string, string>,
  }));
}

export async function hasPersonaVectors(coachId: string): Promise<boolean> {
  const stats = await getIndex().describeIndexStats();
  const ns = stats.namespaces?.[`persona_${coachId}`];
  return (ns?.recordCount ?? 0) > 0;
}

// ── Chat memory namespace: mem_<coachId>_<clientId> ──────────────────────────

export async function upsertChatMemory(
  coachId: string,
  clientId: string,
  turn: { role: 'user' | 'assistant'; content: string; timestamp: string }
): Promise<void> {
  const ns = getIndex().namespace(`mem_${coachId}_${clientId}`);
  const id = `${clientId}_${turn.timestamp}_${turn.role}`;
  const values = await embed(turn.content);
  await ns.upsert([{
    id,
    values,
    metadata: {
      role: turn.role,
      content: turn.content.slice(0, 512),
      timestamp: turn.timestamp,
      clientId,
      coachId,
    },
  }]);
}

export async function searchChatMemory(
  coachId: string,
  clientId: string,
  query: string,
  topK = 3
): Promise<PineconeMatch[]> {
  const ns = getIndex().namespace(`mem_${coachId}_${clientId}`);
  const queryEmbedding = await embed(query);
  const result = await ns.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });
  return (result.matches ?? []).map(m => ({
    id: m.id,
    score: m.score ?? 0,
    metadata: (m.metadata ?? {}) as Record<string, string>,
  }));
}

// ── Q&A namespace: qa_<coachId> ──────────────────────────────────────────────

export async function upsertQAAnswer(
  coachId: string,
  questionId: string,
  question: string,
  answer: string
): Promise<void> {
  const ns = getIndex().namespace(`qa_${coachId}`);
  const combined = `Question: ${question}\nAnswer: ${answer}`;
  const values = await embed(combined);
  await ns.upsert([{
    id: questionId,
    values,
    metadata: {
      questionId,
      coachId,
      question: question.slice(0, 512),
      answer: answer.slice(0, 512),
    },
  }]);
}

export async function vectorSearchQA(
  coachId: string,
  query: string,
  topK = 3
): Promise<PineconeMatch[]> {
  const ns = getIndex().namespace(`qa_${coachId}`);
  const queryEmbedding = await embed(query);
  const result = await ns.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });
  return (result.matches ?? []).map(m => ({
    id: m.id,
    score: m.score ?? 0,
    metadata: (m.metadata ?? {}) as Record<string, string>,
  }));
}
