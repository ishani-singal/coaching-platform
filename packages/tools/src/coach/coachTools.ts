import { supabase } from '@coaching/sdk';
import { CoachProfile, ThemeConfig, CoachingPackage, CoachingType, NavItem, WebsiteConfig, ChatTool } from '@coaching/sdk';

/** Idempotently ensures a user_profiles row with role='coach' and a default slug/display_name exists. */
export async function ensureCoachProfile(userId: string): Promise<void> {
  const slug = 'coach-' + userId.replace(/-/g, '').slice(0, 12);
  const { error } = await supabase
    .from('user_profiles')
    .upsert(
      { user_id: userId, role: 'coach', slug, display_name: 'My Coaching Practice' },
      { onConflict: 'user_id', ignoreDuplicates: true }
    );
  if (error) throw new Error(`ensureCoachProfile: ${error.message}`);
}

export async function upgradeToCoach(userId: string, slug: string, displayName: string): Promise<CoachProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, role: 'coach', slug, display_name: displayName }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapCoach(data);
}

export async function getCoachBySlug(slug: string): Promise<CoachProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error) throw new Error(`Coach not found: ${slug}`);
  return mapCoach(data);
}

export async function getCoachByCustomDomain(domain: string): Promise<CoachProfile | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('custom_domain', domain)
    .single();
  return data ? mapCoach(data) : null;
}

export async function getCoachPackages(coachId: string): Promise<CoachingPackage[]> {
  const { data } = await supabase
    .from('packages')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });
  return (data ?? []).map(mapPackage);
}

export async function updateCoachTheme(coachId: string, themeConfig: ThemeConfig): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ theme_config: themeConfig })
    .eq('user_id', coachId);
  if (error) throw new Error(error.message);
}

export async function setPersonaSnapshot(coachId: string, snapshotId: string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ persona_snapshot_id: snapshotId })
    .eq('user_id', coachId);
  if (error) throw new Error(error.message);
}

export async function getCoachById(coachId: string): Promise<CoachProfile | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', coachId)
    .maybeSingle();
  return data ? mapCoach(data) : null;
}

export async function updateCoachProfile(
  coachId: string,
  updates: { displayName?: string; slug?: string; coachingType?: CoachingType | string; customDomain?: string | null; bio?: string; logo?: string | null }
): Promise<CoachProfile> {
  const patch: Record<string, unknown> = {};
  if (updates.displayName  !== undefined) patch.display_name  = updates.displayName;
  if (updates.slug         !== undefined) patch.slug           = updates.slug;
  if (updates.coachingType !== undefined) patch.coaching_type  = updates.coachingType;
  if (updates.customDomain !== undefined) patch.custom_domain  = updates.customDomain || null;
  if (updates.bio          !== undefined) patch.bio            = updates.bio || null;
  if (updates.logo         !== undefined) patch.logo           = updates.logo || null;
  const { data, error } = await supabase
    .from('user_profiles')
    .update(patch)
    .eq('user_id', coachId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapCoach(data);
}

export async function checkSlugAvailable(slug: string, excludeCoachId?: string): Promise<boolean> {
  let query = supabase
    .from('user_profiles')
    .select('user_id')
    .eq('slug', slug);
  if (excludeCoachId) query = query.neq('user_id', excludeCoachId);
  const { data } = await query.maybeSingle();
  return data === null;
}

export async function saveCoachYouTubeChannel(coachId: string, channelUrl: string): Promise<void> {
  const { data } = await supabase
    .from('user_profiles')
    .select('social_media')
    .eq('user_id', coachId)
    .single();
  const current = (data?.social_media ?? {}) as Record<string, unknown>;
  const { error } = await supabase
    .from('user_profiles')
    .update({ social_media: { ...current, youtubeChannelUrl: channelUrl } })
    .eq('user_id', coachId);
  if (error) throw new Error(error.message);
}

export async function updateSocialMedia(coachId: string, socialMedia: Record<string, string>): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ social_media: socialMedia })
    .eq('user_id', coachId);
  if (error) throw new Error(error.message);
}

export async function updateCoachingType(coachId: string, coachingType: CoachingType | string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ coaching_type: coachingType })
    .eq('user_id', coachId);
  if (error) throw new Error(error.message);
}

export async function getCoachYouTubeChannel(coachId: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('social_media')
    .eq('user_id', coachId)
    .single();
  return ((data?.social_media as Record<string, unknown>)?.youtubeChannelUrl as string) ?? null;
}

export async function updateCoachNavItems(coachId: string, navItems: NavItem[]): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ website_nav_bar: navItems })
    .eq('user_id', coachId);
  if (error) throw new Error(error.message);
}

export async function updateCustomChatPrompt(coachId: string, prompt: string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ custom_chat_prompt: prompt })
    .eq('user_id', coachId);
  if (error) throw new Error(error.message);
}

export async function updateListenerFirstMode(coachId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ listener_first_mode: enabled })
    .eq('user_id', coachId);
  if (error) throw new Error(error.message);
}

export async function updateChatTools(coachId: string, tools: ChatTool[]): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ chat_tools: tools })
    .eq('user_id', coachId);
  if (error) throw new Error(error.message);
}

export async function getWebsiteDraft(coachId: string): Promise<WebsiteConfig | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('website_draft')
    .eq('user_id', coachId)
    .single();
  return (data?.website_draft as WebsiteConfig | null) ?? null;
}

export async function saveWebsiteDraft(coachId: string, config: WebsiteConfig): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ website_draft: config })
    .eq('user_id', coachId);
  if (error) throw new Error(error.message);
}

export async function publishWebsite(coachId: string): Promise<void> {
  const { data } = await supabase
    .from('user_profiles')
    .select('website_draft')
    .eq('user_id', coachId)
    .single();
  if (!data?.website_draft) throw new Error('No draft to publish');
  const { error } = await supabase
    .from('user_profiles')
    .update({ website_published: data.website_draft })
    .eq('user_id', coachId);
  if (error) throw new Error(error.message);
}

function mapCoach(row: Record<string, unknown>): CoachProfile {
  return {
    userId:            row.user_id as string,
    slug:              row.slug as string,
    displayName:       row.display_name as string,
    bio:               row.bio as string | undefined,
    logo:              row.logo as string | undefined,
    customDomain:      row.custom_domain as string | undefined,
    personaSnapshotId: row.persona_snapshot_id as string | undefined,
    themeConfig:       row.theme_config as ThemeConfig | undefined,
    coachingType:      row.coaching_type as CoachingType | undefined,
    socialMedia:       (row.social_media ?? {}) as Record<string, string>,
    websiteNavBar:     (row.website_nav_bar as NavItem[] | undefined) ?? [],
    customChatPrompt:  row.custom_chat_prompt as string | undefined,
    listenerFirstMode: (row.listener_first_mode as boolean | undefined) ?? false,
    chatTools:         (row.chat_tools as ChatTool[] | undefined) ?? [],
    websiteDraft:      (row.website_draft as WebsiteConfig | undefined) ?? null,
    websitePublished:  (row.website_published as WebsiteConfig | undefined) ?? null,
  };
}

function mapPackage(row: Record<string, unknown>): CoachingPackage {
  return {
    packageId:        row.package_id as string,
    coachId:          row.coach_id as string,
    title:            row.title as string,
    description:      row.description as string | undefined,
    coverImageUrl:    row.cover_image_url as string | undefined,
    pricingModel:     row.pricing_model as CoachingPackage['pricingModel'],
    priceUsd:         row.price_usd as number | undefined,
    currencies:       (row.currencies as string[] | undefined) ?? ['USD'],
    totalSeats:       row.total_seats as number | undefined,
    showSeatsFilled:  (row.show_seats_filled as boolean) ?? false,
    applyDeadline:    row.apply_deadline as string | undefined,
    discountPrice:    row.discount_price as number | undefined,
    discountUntil:    row.discount_until as string | undefined,
    isPublished:      row.is_published as boolean,
    includedProgramIds: (row.included_program_ids as string[] | undefined) ?? [],
  };
}
