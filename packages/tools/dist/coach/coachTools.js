"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureCoachProfile = ensureCoachProfile;
exports.upgradeToCoach = upgradeToCoach;
exports.getCoachBySlug = getCoachBySlug;
exports.getCoachByCustomDomain = getCoachByCustomDomain;
exports.getCoachPackages = getCoachPackages;
exports.updateCoachTheme = updateCoachTheme;
exports.setPersonaSnapshot = setPersonaSnapshot;
exports.getCoachById = getCoachById;
exports.updateCoachProfile = updateCoachProfile;
exports.checkSlugAvailable = checkSlugAvailable;
exports.saveCoachYouTubeChannel = saveCoachYouTubeChannel;
exports.updateSocialMedia = updateSocialMedia;
exports.updateCoachingType = updateCoachingType;
exports.getCoachYouTubeChannel = getCoachYouTubeChannel;
exports.updateCoachNavItems = updateCoachNavItems;
exports.updateCustomChatPrompt = updateCustomChatPrompt;
exports.updateListenerFirstMode = updateListenerFirstMode;
exports.updateChatTools = updateChatTools;
exports.getWebsiteDraft = getWebsiteDraft;
exports.saveWebsiteDraft = saveWebsiteDraft;
exports.publishWebsite = publishWebsite;
const sdk_1 = require("@coaching/sdk");
/** Idempotently ensures a user_profiles row with role='coach' and a default slug/display_name exists. */
async function ensureCoachProfile(userId) {
    const slug = 'coach-' + userId.replace(/-/g, '').slice(0, 12);
    const { error } = await sdk_1.supabase
        .from('user_profiles')
        .upsert({ user_id: userId, role: 'coach', slug, display_name: 'My Coaching Practice' }, { onConflict: 'user_id', ignoreDuplicates: true });
    if (error)
        throw new Error(`ensureCoachProfile: ${error.message}`);
}
async function upgradeToCoach(userId, slug, displayName) {
    const { data, error } = await sdk_1.supabase
        .from('user_profiles')
        .upsert({ user_id: userId, role: 'coach', slug, display_name: displayName }, { onConflict: 'user_id' })
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapCoach(data);
}
async function getCoachBySlug(slug) {
    const { data, error } = await sdk_1.supabase
        .from('user_profiles')
        .select('*')
        .eq('slug', slug)
        .single();
    if (error)
        throw new Error(`Coach not found: ${slug}`);
    return mapCoach(data);
}
async function getCoachByCustomDomain(domain) {
    const { data } = await sdk_1.supabase
        .from('user_profiles')
        .select('*')
        .eq('custom_domain', domain)
        .single();
    return data ? mapCoach(data) : null;
}
async function getCoachPackages(coachId) {
    const { data } = await sdk_1.supabase
        .from('packages')
        .select('*')
        .eq('coach_id', coachId)
        .order('created_at', { ascending: false });
    return (data ?? []).map(mapPackage);
}
async function updateCoachTheme(coachId, themeConfig) {
    const { error } = await sdk_1.supabase
        .from('user_profiles')
        .update({ theme_config: themeConfig })
        .eq('user_id', coachId);
    if (error)
        throw new Error(error.message);
}
async function setPersonaSnapshot(coachId, snapshotId) {
    const { error } = await sdk_1.supabase
        .from('user_profiles')
        .update({ persona_snapshot_id: snapshotId })
        .eq('user_id', coachId);
    if (error)
        throw new Error(error.message);
}
async function getCoachById(coachId) {
    const { data } = await sdk_1.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', coachId)
        .maybeSingle();
    return data ? mapCoach(data) : null;
}
async function updateCoachProfile(coachId, updates) {
    const patch = {};
    if (updates.displayName !== undefined)
        patch.display_name = updates.displayName;
    if (updates.slug !== undefined)
        patch.slug = updates.slug;
    if (updates.coachingType !== undefined)
        patch.coaching_type = updates.coachingType;
    if (updates.customDomain !== undefined)
        patch.custom_domain = updates.customDomain || null;
    if (updates.bio !== undefined)
        patch.bio = updates.bio || null;
    if (updates.logo !== undefined)
        patch.logo = updates.logo || null;
    const { data, error } = await sdk_1.supabase
        .from('user_profiles')
        .update(patch)
        .eq('user_id', coachId)
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapCoach(data);
}
async function checkSlugAvailable(slug, excludeCoachId) {
    let query = sdk_1.supabase
        .from('user_profiles')
        .select('user_id')
        .eq('slug', slug);
    if (excludeCoachId)
        query = query.neq('user_id', excludeCoachId);
    const { data } = await query.maybeSingle();
    return data === null;
}
async function saveCoachYouTubeChannel(coachId, channelUrl) {
    const { data } = await sdk_1.supabase
        .from('user_profiles')
        .select('social_media')
        .eq('user_id', coachId)
        .single();
    const current = (data?.social_media ?? {});
    const { error } = await sdk_1.supabase
        .from('user_profiles')
        .update({ social_media: { ...current, youtubeChannelUrl: channelUrl } })
        .eq('user_id', coachId);
    if (error)
        throw new Error(error.message);
}
async function updateSocialMedia(coachId, socialMedia) {
    const { error } = await sdk_1.supabase
        .from('user_profiles')
        .update({ social_media: socialMedia })
        .eq('user_id', coachId);
    if (error)
        throw new Error(error.message);
}
async function updateCoachingType(coachId, coachingType) {
    const { error } = await sdk_1.supabase
        .from('user_profiles')
        .update({ coaching_type: coachingType })
        .eq('user_id', coachId);
    if (error)
        throw new Error(error.message);
}
async function getCoachYouTubeChannel(coachId) {
    const { data } = await sdk_1.supabase
        .from('user_profiles')
        .select('social_media')
        .eq('user_id', coachId)
        .single();
    return data?.social_media?.youtubeChannelUrl ?? null;
}
async function updateCoachNavItems(coachId, navItems) {
    const { error } = await sdk_1.supabase
        .from('user_profiles')
        .update({ website_nav_bar: navItems })
        .eq('user_id', coachId);
    if (error)
        throw new Error(error.message);
}
async function updateCustomChatPrompt(coachId, prompt) {
    const { error } = await sdk_1.supabase
        .from('user_profiles')
        .update({ custom_chat_prompt: prompt })
        .eq('user_id', coachId);
    if (error)
        throw new Error(error.message);
}
async function updateListenerFirstMode(coachId, enabled) {
    const { error } = await sdk_1.supabase
        .from('user_profiles')
        .update({ listener_first_mode: enabled })
        .eq('user_id', coachId);
    if (error)
        throw new Error(error.message);
}
async function updateChatTools(coachId, tools) {
    const { error } = await sdk_1.supabase
        .from('user_profiles')
        .update({ chat_tools: tools })
        .eq('user_id', coachId);
    if (error)
        throw new Error(error.message);
}
async function getWebsiteDraft(coachId) {
    const { data } = await sdk_1.supabase
        .from('user_profiles')
        .select('website_draft')
        .eq('user_id', coachId)
        .single();
    return data?.website_draft ?? null;
}
async function saveWebsiteDraft(coachId, config) {
    const { error } = await sdk_1.supabase
        .from('user_profiles')
        .update({ website_draft: config })
        .eq('user_id', coachId);
    if (error)
        throw new Error(error.message);
}
async function publishWebsite(coachId) {
    const { data } = await sdk_1.supabase
        .from('user_profiles')
        .select('website_draft')
        .eq('user_id', coachId)
        .single();
    if (!data?.website_draft)
        throw new Error('No draft to publish');
    const { error } = await sdk_1.supabase
        .from('user_profiles')
        .update({ website_published: data.website_draft })
        .eq('user_id', coachId);
    if (error)
        throw new Error(error.message);
}
function mapCoach(row) {
    return {
        userId: row.user_id,
        slug: row.slug,
        displayName: row.display_name,
        bio: row.bio,
        logo: row.logo,
        customDomain: row.custom_domain,
        personaSnapshotId: row.persona_snapshot_id,
        themeConfig: row.theme_config,
        coachingType: row.coaching_type,
        socialMedia: (row.social_media ?? {}),
        websiteNavBar: row.website_nav_bar ?? [],
        customChatPrompt: row.custom_chat_prompt,
        listenerFirstMode: row.listener_first_mode ?? false,
        chatTools: row.chat_tools ?? [],
        websiteDraft: row.website_draft ?? null,
        websitePublished: row.website_published ?? null,
    };
}
function mapPackage(row) {
    return {
        packageId: row.package_id,
        coachId: row.coach_id,
        title: row.title,
        description: row.description,
        coverImageUrl: row.cover_image_url,
        pricingModel: row.pricing_model,
        priceUsd: row.price_usd,
        currencies: row.currencies ?? ['USD'],
        totalSeats: row.total_seats,
        showSeatsFilled: row.show_seats_filled ?? false,
        applyDeadline: row.apply_deadline,
        discountPrice: row.discount_price,
        discountUntil: row.discount_until,
        isPublished: row.is_published,
        includedProgramIds: row.included_program_ids ?? [],
    };
}
//# sourceMappingURL=coachTools.js.map