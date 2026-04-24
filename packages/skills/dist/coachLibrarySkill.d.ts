import { LibraryItem } from '@coaching/sdk';
export declare function syncYoutubeChannel(coachId: string, channelUrl: string): Promise<{
    added: number;
    updated: number;
}>;
export declare function addBook(coachId: string, title: string, author: string, url: string | undefined, description: string, tags: string[]): Promise<LibraryItem>;
export declare function addArticle(coachId: string, title: string, url: string, description: string, tags: string[]): Promise<LibraryItem>;
export declare function addPdf(coachId: string, title: string, fileUrl: string, description: string, tags: string[]): Promise<LibraryItem>;
export declare function organizeLibrary(coachId: string, patches: {
    itemId: string;
    tags?: string[];
    displayOrder?: number;
}[]): Promise<void>;
export declare function getLibraryForPublicSite(coachId: string): Promise<{
    youtube: LibraryItem[];
    books: LibraryItem[];
    articles: LibraryItem[];
    podcasts: LibraryItem[];
}>;
//# sourceMappingURL=coachLibrarySkill.d.ts.map