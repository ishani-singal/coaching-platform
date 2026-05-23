import { CoachProfile, ThemeConfig, CoachingPackage, CoachingType, NavItem, WebsiteConfig, ChatTool } from '@coaching/sdk';
/** Idempotently ensures a user_profiles row with role='coach' and a default slug/display_name exists. */
export declare function ensureCoachProfile(userId: string): Promise<void>;
export declare function upgradeToCoach(userId: string, slug: string, displayName: string): Promise<CoachProfile>;
export declare function getCoachBySlug(slug: string): Promise<CoachProfile>;
export declare function getCoachByCustomDomain(domain: string): Promise<CoachProfile | null>;
export declare function getCoachPackages(coachId: string): Promise<CoachingPackage[]>;
export declare function updateCoachTheme(coachId: string, themeConfig: ThemeConfig): Promise<void>;
export declare function setPersonaSnapshot(coachId: string, snapshotId: string): Promise<void>;
export declare function getCoachById(coachId: string): Promise<CoachProfile | null>;
export declare function updateCoachProfile(coachId: string, updates: {
    displayName?: string;
    slug?: string;
    coachingType?: CoachingType | string;
    customDomain?: string | null;
    bio?: string;
    logo?: string | null;
}): Promise<CoachProfile>;
export declare function checkSlugAvailable(slug: string, excludeCoachId?: string): Promise<boolean>;
export declare function saveCoachYouTubeChannel(coachId: string, channelUrl: string): Promise<void>;
export declare function updateSocialMedia(coachId: string, socialMedia: Record<string, string>): Promise<void>;
export declare function updateCoachingType(coachId: string, coachingType: CoachingType | string): Promise<void>;
export declare function getCoachYouTubeChannel(coachId: string): Promise<string | null>;
export declare function updateCoachNavItems(coachId: string, navItems: NavItem[]): Promise<void>;
export declare function updateCustomChatPrompt(coachId: string, prompt: string): Promise<void>;
export declare function updateListenerFirstMode(coachId: string, enabled: boolean): Promise<void>;
export declare function updateChatTools(coachId: string, tools: ChatTool[]): Promise<void>;
export declare function getWebsiteDraft(coachId: string): Promise<WebsiteConfig | null>;
export declare function saveWebsiteDraft(coachId: string, config: WebsiteConfig): Promise<void>;
export declare function publishWebsite(coachId: string): Promise<void>;
//# sourceMappingURL=coachTools.d.ts.map