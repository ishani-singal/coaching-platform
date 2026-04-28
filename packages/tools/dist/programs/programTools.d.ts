import { ProgramRecord, ProgramPeriod, PeriodType, ModuleRecord } from '@coaching/sdk';
export declare function createProgram(coachId: string, title: string, description?: string): Promise<ProgramRecord>;
export declare function addModuleToProgram(programId: string, moduleId: string, order: number): Promise<void>;
export declare function removeModuleFromProgram(programId: string, moduleId: string): Promise<void>;
export declare function reorderModules(programId: string, orderedModuleIds: string[]): Promise<void>;
export declare function publishProgram(programId: string): Promise<void>;
export declare function getProgramWithModules(programId: string): Promise<ProgramRecord>;
export declare function listModulesForCoach(coachId: string): Promise<ModuleRecord[]>;
export declare function listProgramsForCoach(coachId: string): Promise<ProgramRecord[]>;
export declare function createProgramPeriod(programId: string, periodOrder: number, label: string, periodType: PeriodType): Promise<ProgramPeriod>;
export declare function addModuleToPeriod(programId: string, moduleId: string, periodId: string, displayOrder: number): Promise<void>;
export declare function getProgramWithPeriods(programId: string): Promise<ProgramRecord>;
//# sourceMappingURL=programTools.d.ts.map