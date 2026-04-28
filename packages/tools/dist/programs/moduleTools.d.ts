import { ModuleRecord, ModuleSectionSpec, ViewType, ContentType } from '@coaching/sdk';
export declare function createModule(coachId: string, title: string, category: string, derivedFromId?: string, sourceProgramId?: string): Promise<ModuleRecord>;
export declare function addSection(moduleId: string, order: number, visibleTo: ViewType[], contentType: ContentType, body: Record<string, unknown>): Promise<ModuleSectionSpec>;
export declare function updateSection(sectionId: string, patch: Partial<ModuleSectionSpec>): Promise<void>;
export declare function deleteSection(sectionId: string): Promise<void>;
export declare function reorderSections(moduleId: string, orderedSectionIds: string[]): Promise<void>;
export declare function publishModule(moduleId: string): Promise<void>;
export declare function getModuleWithSections(moduleId: string, viewType: ViewType): Promise<ModuleRecord>;
export declare function forkModule(originalModuleId: string, newCoachId: string): Promise<ModuleRecord>;
export declare function updateModule(moduleId: string, patch: {
    title?: string;
    category?: string;
}): Promise<void>;
export declare function getAllModuleSections(moduleId: string): Promise<ModuleSectionSpec[]>;
//# sourceMappingURL=moduleTools.d.ts.map