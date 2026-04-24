import { LibraryItem, LibraryItemType } from '@coaching/sdk';
export declare function addLibraryItem(coachId: string, item: Partial<LibraryItem>): Promise<LibraryItem>;
export declare function updateLibraryItem(itemId: string, patch: Partial<LibraryItem>): Promise<void>;
export declare function removeLibraryItem(itemId: string): Promise<void>;
export declare function reorderLibraryItems(coachId: string, orderedItemIds: string[]): Promise<void>;
export declare function getLibraryByCoach(coachId: string, itemType?: LibraryItemType): Promise<LibraryItem[]>;
export declare function searchLibrary(coachId: string, query: string): Promise<LibraryItem[]>;
//# sourceMappingURL=libraryTools.d.ts.map