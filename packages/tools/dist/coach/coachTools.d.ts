import { CoachProfile, ThemeConfig, CoachingPackage } from '@coaching/sdk';
/** Idempotently ensures user_profiles + coach_profiles rows exist. Safe to call before any coach write. */
export declare function ensureCoachProfile(userId: string): Promise<void>;
export declare function upgradeToCoach(userId: string, slug: string, displayName: string): Promise<CoachProfile>;
export declare function getCoachBySlug(slug: string): Promise<CoachProfile>;
export declare function getCoachByCustomDomain(domain: string): Promise<CoachProfile | null>;
export declare function getCoachPackages(coachId: string): Promise<CoachingPackage[]>;
export declare function updateCoachTheme(coachId: string, themeConfig: ThemeConfig): Promise<void>;
export declare function setPersonaSnapshot(coachId: string, snapshotId: string): Promise<void>;
export declare function checkSlugAvailable(slug: string): Promise<boolean>;
//# sourceMappingURL=coachTools.d.ts.map