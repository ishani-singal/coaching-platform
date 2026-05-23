import { LibraryItem, LibraryItemType } from '@coaching/sdk';
export declare function addLibraryItem(coachId: string, item: Partial<LibraryItem>): Promise<LibraryItem>;
export declare function updateLibraryItem(itemId: string, patch: Partial<LibraryItem>): Promise<void>;
export declare function markLibraryItemEmbedded(itemId: string): Promise<void>;
export declare function removeLibraryItem(itemId: string): Promise<void>;
export declare function reorderLibraryItems(coachId: string, orderedItemIds: string[]): Promise<void>;
export declare function getLibraryItemByUrl(coachId: string, url: string): Promise<LibraryItem | null>;
export declare function getLibraryByCoach(coachId: string, itemType?: LibraryItemType): Promise<LibraryItem[]>;
export declare function getUnembeddedLibraryItems(coachId: string): Promise<LibraryItem[]>;
export declare function addBook(coachId: string, title: string, author: string, fileUrl: string | undefined, buyLink: string | undefined, description: string, tags: string[], thumbnailUrl?: string): Promise<LibraryItem>;
export declare function addArticle(coachId: string, title: string, url: string, description: string, tags: string[]): Promise<LibraryItem>;
export declare function addPdf(coachId: string, title: string, fileUrl: string, description: string, tags: string[]): Promise<LibraryItem>;
export declare function getCoachesWithYoutubeChannel(): Promise<{
    coachId: string;
    channelUrl: string;
}[]>;
export declare function searchLibrary(coachId: string, query: string): Promise<LibraryItem[]>;
//# sourceMappingURL=libraryTools.d.ts.map