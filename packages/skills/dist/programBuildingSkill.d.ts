import { ProgramRecord, ModuleSectionSpec, ViewType } from '@coaching/sdk';
export declare function buildProgram(coachId: string, title: string, moduleIds: string[]): Promise<ProgramRecord>;
export declare function previewProgram(programId: string, viewType: ViewType): Promise<ModuleSectionSpec[]>;
//# sourceMappingURL=programBuildingSkill.d.ts.map