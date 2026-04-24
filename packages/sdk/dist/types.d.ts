export interface AgentManifest {
    agentId: string;
    name: string;
    version: string;
    description: string;
    icon: string;
    domain: string[];
    defaultScope: 'global' | 'project' | 'workflow';
    actions: AgentAction[];
    panelSpec?: AgentPanelSpec;
    uiSpec?: AgentUXSpec;
    integrationTier: 1 | 2 | 3;
}
export interface AgentAction {
    name: string;
    description: string;
    params: Record<string, ParamSpec>;
}
export interface ParamSpec {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required: boolean;
    description: string;
    enum?: string[];
}
export interface AgentPanelSpec {
    layout: 'single-column' | 'two-column' | 'tabbed';
    sections: unknown[];
}
export interface AgentUXSpec {
    baseArchitecture: 'flow-wizard' | 'dashboard' | 'card-feed' | 'table' | 'calendar-view' | 'chat-augment';
}
export interface ContextRequest {
    userId: string;
    config: Record<string, unknown>;
    days?: number;
    includeRaw?: boolean;
}
export interface ContextResponse {
    snapshot: AgentContextSnapshot;
    cached?: boolean;
}
export interface AgentContextSnapshot {
    agentId: string;
    agentName: string;
    domain: string[];
    summary: string;
    keyEntities: EntityObject[];
    recentEvents: AgentEvent[];
    pendingActions: PendingAction[];
    rawContext?: Record<string, unknown>;
}
export interface EntityObject {
    id: string;
    type: string;
    label: string;
    attributes: Record<string, unknown>;
}
export interface AgentEvent {
    type: string;
    label: string;
    occurredAt: string;
    metadata: Record<string, unknown>;
}
export interface PendingAction {
    type: string;
    label: string;
    dueAt?: string;
    priority: 'low' | 'medium' | 'high';
}
export interface ActionRequest {
    userId: string;
    config: Record<string, unknown>;
    action: string;
    params: Record<string, unknown>;
}
export interface ActionResponse {
    success: boolean;
    message: string;
    data?: Record<string, unknown>;
}
export type BridgeMode = {
    mode: 'http';
    baseUrl?: string;
    authToken?: string;
} | {
    mode: 'direct';
    skillMap: Record<string, (userId: string, params: Record<string, unknown>) => Promise<unknown>>;
};
export type ViewType = 'client' | 'trainee' | 'delivery';
export type ContentType = 'text' | 'video' | 'pdf' | 'task' | 'check_in' | 'quiz' | 'facilitation_guide';
export type LibraryItemType = 'youtube' | 'book' | 'article' | 'pdf' | 'podcast';
export type EnrollmentType = 'client' | 'trainee';
export type PricingModel = 'free' | 'one_time' | 'subscription';
export type UserRole = 'client' | 'trainee' | 'coach';
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';
export interface ThemeConfig {
    primaryColor: string;
    fontFamily: string;
    sectionOrder: ('hero' | 'chat' | 'programs' | 'library' | 'booking' | 'payment')[];
    hiddenSections: string[];
}
export interface CoachProfile {
    coachId: string;
    slug: string;
    displayName: string;
    bio?: string;
    customDomain?: string;
    personaSnapshotId?: string;
    themeConfig?: ThemeConfig;
}
export interface ClientProfile {
    clientId: string;
    coachId: string;
    enrollmentId?: string;
    inviteToken?: string;
    name: string;
    email: string;
    phone?: string;
    goals: string;
    background: string;
    preferences: {
        learningStyle?: string;
        availability?: string;
        focusAreas?: string[];
    };
}
export interface ModuleSectionSpec {
    sectionId: string;
    sectionOrder: number;
    visibleTo: ViewType[];
    contentType: ContentType;
    body: Record<string, unknown>;
}
export interface ModuleRecord {
    moduleId: string;
    creatorCoachId: string;
    title: string;
    category: string;
    version: number;
    derivedFromModuleId?: string;
    isPublished: boolean;
    sections?: ModuleSectionSpec[];
}
export interface ProgramRecord {
    programId: string;
    creatorCoachId: string;
    title: string;
    description?: string;
    isPublished: boolean;
    modules?: ModuleRecord[];
}
export interface CoachingPackage {
    packageId: string;
    coachId: string;
    personaSnapshotId: string;
    title: string;
    description?: string;
    coverImageUrl?: string;
    pricingModel: PricingModel;
    priceUsd?: number;
    isPublished: boolean;
    programs?: ProgramRecord[];
}
export interface LicenseTerms {
    directCutPct: number;
    derivativeCutPct: number;
    propagateToDepth: number | null;
    canSublicense: boolean;
}
export interface AncestryRow {
    moduleId: string;
    ancestorModuleId: string;
    ancestorCoachId: string;
    depth: number;
    applicableCutPct: number;
}
export interface RevenueAllocation {
    coachId: string;
    role: 'delivering_coach' | 'licensor' | 'platform';
    ancestorDepth: number;
    amountUsd: number;
    pct: number;
}
export interface LibraryItem {
    itemId: string;
    coachId: string;
    itemType: LibraryItemType;
    title: string;
    url?: string;
    description?: string;
    tags: string[];
    thumbnailUrl?: string;
    metadata: Record<string, unknown>;
    displayOrder: number;
}
export interface PersonaSnapshot {
    id: string;
    coachId: string;
    version: number;
    tone: string;
    style: string;
    summary: string;
    rawSnapshot: Record<string, unknown>;
}
export interface PersonaSource {
    id: string;
    coachId: string;
    sourceType: 'youtube' | 'text' | 'file' | 'linkedin' | 'instagram';
    content?: string;
    url?: string;
    createdAt: string;
}
export interface PersonaRecommendation {
    type: 'module' | 'video' | 'book' | 'booking' | 'article';
    title: string;
    description: string;
    url?: string;
    packageId?: string;
    score: number;
    reasoning: string;
}
export interface EnrollmentRecord {
    enrollmentId: string;
    packageId: string;
    installingCoachId: string;
    clientId: string;
    enrollmentType: EnrollmentType;
    inviteToken: string;
    startedAt?: string;
    completedAt?: string;
    currentModuleId?: string;
}
export interface CoachingSession {
    sessionId: string;
    coachId: string;
    clientId: string;
    enrollmentId?: string;
    bookingRef?: string;
    paymentRef?: string;
    scheduledAt: string;
    durationMinutes: number;
    status: SessionStatus;
    sessionNotes?: string;
    createdAt: string;
}
export interface ScoredItem {
    item: LibraryItem | CoachingPackage;
    score: number;
    matchedGoals: string[];
}
export interface YoutubeVideo {
    videoId: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    publishedAt: string;
    duration: string;
    viewCount: number;
    channelTitle: string;
}
export interface BookingPage {
    bookingPageUrl: string;
    embedUrl: string;
    eventTypeId: string;
}
export interface PaymentLink {
    paymentLinkUrl: string;
    paymentLinkId: string;
}
export interface CalendarEvent {
    id: string;
    title: string;
    start: string;
    end: string;
    location?: string;
}
//# sourceMappingURL=types.d.ts.map