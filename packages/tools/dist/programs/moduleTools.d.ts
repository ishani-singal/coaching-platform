import { ModuleRecord, ModuleSectionSpec, ContentType } from '@coaching/sdk';
export declare function createModule(coachId: string, title: string, category: string, derivedFromId?: string): Promise<ModuleRecord>;
export declare function addSection(moduleId: string, order: number, contentType: ContentType, body: Record<string, unknown>): Promise<ModuleSectionSpec>;
export declare function updateSection(moduleId: string, sectionId: string, patch: Partial<ModuleSectionSpec>): Promise<void>;
export declare function deleteSection(moduleId: string, sectionId: string): Promise<void>;
export declare function deleteModule(moduleId: string, coachId: string): Promise<void>;
export declare function reorderSections(moduleId: string, orderedSectionIds: string[]): Promise<void>;
export declare function getModuleWithSections(moduleId: string): Promise<ModuleRecord>;
export declare function forkModule(originalModuleId: string, newCoachId: string, opts?: {
    noSublicense?: boolean;
}): Promise<ModuleRecord>;
export declare function updateModule(moduleId: string, patch: {
    title?: string;
    category?: string;
}): Promise<void>;
export declare function getAllModuleSections(moduleId: string): Promise<ModuleSectionSpec[]>;
export declare function pruneEmptySections(moduleId: string): Promise<void>;
//# sourceMappingURL=moduleTools.d.ts.map