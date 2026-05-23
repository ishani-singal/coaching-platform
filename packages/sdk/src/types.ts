// ── Agent contract (skillz-compatible) ──────────────────────────────────────

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

// ── Bridge mode ───────────────────────────────────────────────────────────────

export type BridgeMode =
  | { mode: 'http'; baseUrl?: string; authToken?: string }
  | { mode: 'direct'; skillMap: Record<string, (userId: string, params: Record<string, unknown>) => Promise<unknown>> };

// ── Coaching domain types ────────────────────────────────────────────────────

export type ContentType     =
  | 'text' | 'video' | 'pdf' | 'task' | 'check_in' | 'quiz' | 'facilitation_guide'
  | 'long_form_qa' | 'single_choice' | 'multi_choice' | 'match_following' | 'rating'
  | 'assignment' | 'file' | 'image_embed';
export type PeriodType      = 'week' | 'day' | 'month' | 'quarter' | 'steps' | 'custom';
export type LibraryItemType = 'youtube' | 'book' | 'article' | 'pdf' | 'podcast' | 'note' | 'file';
export type CoachingType =
  | 'life_coach' | 'fitness_coach' | 'business_coach' | 'mental_health_coach'
  | 'nutrition_coach' | 'career_coach' | 'executive_coach' | 'wellness_coach';
export type EnrollmentType  = 'client' | 'trainee';
export type PricingModel    = 'free' | 'one_time' | 'subscription';
export type UserRole        = 'client' | 'trainee' | 'coach';
export type SessionStatus   = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export type NavItem = 'home' | 'services' | 'events' | 'about' | 'blog' | 'faq' | 'contact' | 'search' | 'library';

// ── Website Builder ───────────────────────────────────────────────────────────

export type WebsiteComponentType =
  | 'hero'
  | 'ribbon'
  | 'cta_button'
  | 'testimonial'
  | 'feature_block'
  | 'image_text'
  | 'custom_html';

export interface WebsiteComponent {
  id: string;
  type: WebsiteComponentType;
  x: number;   // px from canvas left
  y: number;   // px from canvas top
  w: number;   // width in px
  h: number;   // height in px
  props: Record<string, string>;
}

export interface WebsiteConfig {
  templateId: string;
  components: WebsiteComponent[];
}

export interface ThemeConfig {
  primaryColor: string;
  fontFamily: string;
  sectionOrder: ('hero' | 'chat' | 'programs' | 'library' | 'booking' | 'payment')[];
  hiddenSections: string[];
  navItems?: NavItem[];
}

export interface CoachProfile {
  userId: string;
  slug: string;
  displayName: string;
  bio?: string;
  logo?: string;
  customDomain?: string;
  personaSnapshotId?: string;
  themeConfig?: ThemeConfig;
  coachingType?: CoachingType | string;
  socialMedia?: Record<string, string>;
  websiteNavBar?: NavItem[];
  customChatPrompt?: string;
  listenerFirstMode?: boolean;
  chatTools?: ChatTool[];
  websiteDraft?: WebsiteConfig | null;
  websitePublished?: WebsiteConfig | null;
}

export type ChatToolType = 'listen_first' | 'reflective_acknowledgement' | 'reply_style';

export type ReplyStyle = 'narrative' | 'bullet' | 'mixed' | 'socratic';

export interface ChatToolSettings {
  /** @deprecated No longer used. Readiness is now determined automatically by an internal LLM check. */
  questionPhaseRounds?: number;
  /** reply_style: how the coach structures replies */
  replyStyle?: ReplyStyle;
}

export interface ChatTool {
  type: ChatToolType;
  enabled: boolean;
  settings?: ChatToolSettings;
}

export interface QuestionItem {
  id: string;
  text: string;
  /** Importance weight 1–7 (7 = must answer first) */
  weight: number;
  /** Priority rank (1 = ask next, ascending) */
  priority: number;
  answered: boolean;
  /** Answer quality 0.0–1.0. Set only when answered. 1.0 = explicit/specific, 0.7 = mostly answered, 0.4 = partial/implied, 0.1 = vague label only */
  quality?: number;
  /** True when the person volunteered this info unprompted — exclude from denominator, do not ask */
  deprecated?: boolean;
}

export interface QuestionState {
  questions: QuestionItem[];
  /** 0–100 — sum(weight * quality for answered active) / sum(weight for active) * 100. Active = not deprecated. */
  clarity: number;
}

export interface ClientProfile {
  clientId: string;
  coachId: string;
  inviteToken?: string;
  userId?: string;  // Supabase auth user_id — set when client creates an account
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
  // Enrollment fields — populated when the client is enrolled in a package
  packageId?: string;
  enrollmentType?: EnrollmentType;
  startedAt?: string;
  completedAt?: string;
  currentModuleId?: string;
  responses: EnrollmentResponse[];
}

export interface ModuleSectionSpec {
  sectionId: string;
  sectionOrder: number;
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
  noSublicense: boolean;
  sections?: ModuleSectionSpec[];
}

export interface ProgramPeriod {
  programId?: string;
  periodOrder: number;
  label: string;
  periodType: PeriodType;
  modules?: ModuleRecord[];
}

export interface ProgramRecord {
  programId: string;
  creatorCoachId: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  modules?: ModuleRecord[];
  periods?: ProgramPeriod[];
}

export interface CoachModuleClientData {
  recordId: string;
  coachId: string;
  moduleId: string;
  clientId: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type CertificateDesignVariant = 'classic' | 'modern' | 'minimal';

export interface CertificateTemplate {
  designVariant: CertificateDesignVariant;
  /** Main heading, e.g. "Certificate of Completion" */
  title: string;
  /** Secondary line, e.g. "This is to certify that" */
  subtitle?: string;
  /** Text after trainee name, e.g. "for successfully completing" */
  programLabel?: string;
  coachName?: string;
  coachTitle?: string;
  /** Publicly accessible image URL for coach logo */
  logoUrl?: string;
  /** Hex accent colour, e.g. "#4F46E5" */
  accentColor: string;
  /** Label below coach signature line, e.g. "Certified by" */
  signatoryLabel?: string;
}

export interface CoachingPackage {
  packageId: string;
  coachId: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  pricingModel: PricingModel;
  priceUsd?: number;
  currencies: string[];
  totalSeats?: number;
  showSeatsFilled: boolean;
  applyDeadline?: string;
  discountPrice?: number;
  discountUntil?: string;
  isPublished: boolean;
  certificateUrl?: string;
  certificateTemplate?: CertificateTemplate;
  includedProgramIds: string[];
  programs?: ProgramRecord[];
}

export interface LicenseTerms {
  directCutPct: number;
  derivativeCutPct: number;
  propagateToDepth: number | null;
  canSublicense: boolean;
  licenseFeeAmount?: number;
  licenseFeeCurrency?: string;
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
  buyLink?: string;
  embeddedAt?: string;
  transcript?: string;
  transcriptSource?: 'youtube_captions' | 'whisper' | 'manual' | 'text-extraction';
  transcriptLanguage?: string;
  chunksIndexed: boolean;
}

export interface CoachRecommendationSettings {
  coachId: string;
  tagWeight: number;
  semanticWeight: number;
  recencyBoost: number;
  preferredTypes: LibraryItemType[];
  maxResults: number;
}

export interface PineconeMatch {
  id: string;
  score: number;
  metadata: Record<string, string>;
}

// ── AG-UI event types (SSE events emitted alongside chat text stream) ─────────

export interface AguiEvent {
  type: 'TEXT_MESSAGE_START' | 'TEXT_MESSAGE_CONTENT' | 'TEXT_MESSAGE_END'
      | 'TOOL_CALL_START' | 'TOOL_CALL_END' | 'REFRESH_CONTENT';
}

export interface AguiLibraryCardEvent extends AguiEvent {
  type: 'TOOL_CALL_END';
  toolName: 'library_item_card';
  output: {
    itemId: string;
    title: string;
    itemType: LibraryItemType;
    description?: string;
    buyLink?: string;
    thumbnailUrl?: string;
    url?: string;
    tags: string[];
  };
}

export interface AguiToolCallStartEvent extends AguiEvent {
  type: 'TOOL_CALL_START';
  toolCallId: string;
  toolName: string;
  label: string;
}

export interface AguiModuleCardEvent extends AguiEvent {
  type: 'TOOL_CALL_END';
  toolName: 'module_card';
  toolCallId: string;
  output: { moduleId: string; title: string; category: string; };
}

export interface AguiProgramCardEvent extends AguiEvent {
  type: 'TOOL_CALL_END';
  toolName: 'program_card';
  toolCallId: string;
  output: { programId: string; title: string; periodCount?: number; };
}

export interface AguiPackageCardEvent extends AguiEvent {
  type: 'TOOL_CALL_END';
  toolName: 'package_card';
  toolCallId: string;
  output: { packageId: string; title: string; pricingModel: string; isPublished: boolean; };
}

export interface AguiRefreshContentEvent extends AguiEvent {
  type: 'REFRESH_CONTENT';
}

export type ProgramBuilderAguiEvent =
  | AguiToolCallStartEvent
  | AguiModuleCardEvent
  | AguiProgramCardEvent
  | AguiPackageCardEvent
  | AguiRefreshContentEvent;

export interface PersonaSnapshot {
  id: string;
  coachId: string;
  version: number;
  tone: string;
  style: string;
  summary: string;
  rawSnapshot: Record<string, unknown>;
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

export interface EnrollmentResponse {
  sectionId: string;
  responseData: Record<string, unknown>;
  submittedAt: string;
}

export interface CoachingSession {
  sessionId: string;
  coachId: string;
  clientId: string;
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

// Results from skillz agent bridge calls
export interface BookingPage {
  bookingPageUrl: string;
  embedUrl: string;
  eventTypeId: string;
}

export interface PaymentLink {
  paymentLinkUrl: string;
  paymentLinkId: string;
}

export type PaymentProvider = 'stripe' | 'razorpay';

export type PaymentMethod =
  | 'card'
  | 'google_pay'
  | 'us_bank_account'
  | 'upi'
  | 'netbanking'
  | 'wallet';

export type PaymentStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'requires_action';

export interface CreatePaymentLinkParams {
  amount: number;        // smallest currency unit (cents or paise)
  currency: string;      // ISO 4217 uppercase
  description: string;
  redirectUrl?: string;
  packageId?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
}

// ── Native Appointment Booking System ─────────────────────────────────────────

export interface CancellationPolicy {
  hours_notice: number;   // hours before appointment that cancellation is allowed with a refund
  refund_pct:   number;   // 0–100: percentage of price refunded when cancelled within notice window
}

export interface RecurrenceConfig {
  enabled:        boolean;
  frequency:      'weekly' | 'biweekly' | 'monthly';
  occurrences:    number;  // total number of sessions (including the first)
  interval_weeks: number;  // 1 = weekly, 2 = biweekly, 4 = monthly
}

export interface AppointmentType {
  appointmentTypeId:  string;
  coachId:            string;
  title:              string;
  description:        string | null;
  durationMins:       number;
  bufferMins:         number;
  priceUsd:           number;
  currency:           string;
  cancellationPolicy: CancellationPolicy;
  minNoticeHours:     number;
  maxDaysOut:         number;
  isActive:           boolean;
  recurrence:         RecurrenceConfig | null;
  createdAt:          string;
  updatedAt:          string;
}

export interface CoachAvailability {
  availabilityId: string;
  coachId:        string;
  dayOfWeek:      number;   // 0=Sun … 6=Sat
  startTime:      string;   // HH:MM
  endTime:        string;   // HH:MM
  timezone:       string;
}

export interface CoachCalendarConnection {
  connectionId:        string;
  coachId:             string;
  googleAccountEmail:  string;
  tokenExpiry:         string;
  selectedCalendarIds: string[];
}

export interface GoogleCalendarItem {
  id:      string;
  summary: string;
  primary: boolean;
}

export type AppointmentStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'expired';

export interface Appointment {
  appointmentId:       string;
  appointmentTypeId:   string;
  coachId:             string;
  clientName:          string;
  clientEmail:         string;
  startsAt:            string;   // ISO 8601
  endsAt:              string;
  timezone:            string;
  status:              AppointmentStatus;
  priceUsd:            number;
  currency:            string;
  paymentExternalId:   string | null;
  paymentProvider:     string | null;
  cancelledAt:         string | null;
  cancellationReason:  string | null;
  cancelledBy:         'coach' | 'client' | null;
  refundIssued:        boolean;
  refundAmountUsd:     number | null;
  confirmedAt:         string | null;
  recurrenceGroupId:   string | null;
  recurrenceIndex:     number | null;
  createdAt:           string;
}

export interface TimeSlot {
  startsAt: string;   // ISO 8601 UTC
  endsAt:   string;
  label:    string;   // e.g. "9:00 AM"
}
