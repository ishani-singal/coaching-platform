import { ProgramRecord, ProgramPeriod, PeriodType, ModuleRecord } from '@coaching/sdk';
export declare function createProgram(coachId: string, title: string, description?: string): Promise<ProgramRecord>;
export declare function addModuleToPeriodByOrder(programId: string, periodOrder: number, moduleId: string, displayOrder: number): Promise<void>;
export declare function removeModuleFromPeriod(programId: string, periodOrder: number, moduleId: string): Promise<void>;
export declare function removeModuleFromProgram(programId: string, moduleId: string): Promise<void>;
export declare function updateProgram(programId: string, coachId: string, patch: {
    title?: string;
    description?: string;
    coverImageUrl?: string;
}): Promise<void>;
export declare function deleteProgram(programId: string, coachId: string): Promise<void>;
export declare function getProgramWithModules(programId: string): Promise<ProgramRecord>;
export declare function listModulesForCoach(coachId: string): Promise<ModuleRecord[]>;
export declare function listProgramsForCoach(coachId: string): Promise<ProgramRecord[]>;
export declare function createProgramPeriod(programId: string, periodOrder: number, label: string, periodType: PeriodType): Promise<ProgramPeriod>;
export declare function deleteProgramPeriod(programId: string, periodOrder: number): Promise<void>;
export declare function updateProgramPeriod(programId: string, periodOrder: number, patch: {
    label?: string;
}): Promise<void>;
export declare function getProgramWithPeriods(programId: string): Promise<ProgramRecord>;
//# sourceMappingURL=programTools.d.ts.map