import { PersonaSnapshot } from '@coaching/sdk';
export interface PersonaContext {
    corpus: string;
    libraryItemCount: number;
}
/** Build a text corpus from user_profiles + coach_library_items for LLM persona extraction. */
export declare function buildPersonaContext(coachId: string): Promise<PersonaContext>;
export declare function getLatestPersonaSnapshot(coachId: string): Promise<PersonaSnapshot | null>;
export declare function savePersonaSnapshot(coachId: string, tone: string, style: string, summary: string, raw: Record<string, unknown>): Promise<PersonaSnapshot>;
/**
 * For every book/pdf library item that has a URL, fetch and parse the PDF,
 * then upsert the text chunks into Pinecone so they are available for RAG.
 * Skips items where the URL is missing or the fetch/parse fails.
 */
export declare function indexPdfLibraryItems(coachId: string): Promise<void>;
//# sourceMappingURL=personaTools.d.ts.map