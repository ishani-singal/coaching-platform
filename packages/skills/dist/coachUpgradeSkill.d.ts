import { CoachProfile } from '@coaching/sdk';
import { checkSlugAvailable } from '@coaching/tools';
export declare function upgradeToCoach(userId: string, slug: string, displayName: string): Promise<{
    coachProfile: CoachProfile;
    subdomainUrl: string;
}>;
export { checkSlugAvailable };
//# sourceMappingURL=coachUpgradeSkill.d.ts.map