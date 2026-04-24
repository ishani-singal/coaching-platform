import { ModuleRecord, ModuleSectionSpec, ViewType, ContentType } from '@coaching/sdk';
export declare function scaffoldModule(coachId: string, title: string, category: string): Promise<ModuleRecord>;
export declare function addContentToSection(sectionId: string, contentType: ContentType, body: Record<string, unknown>, visibleTo: ViewType[]): Promise<void>;
export declare function forkModule(originalModuleId: string, newCoachId: string): Promise<ModuleRecord>;
export declare function previewModule(moduleId: string, viewType: ViewType): Promise<ModuleSectionSpec[]>;
//# sourceMappingURL=moduleAuthoringSkill.d.ts.map