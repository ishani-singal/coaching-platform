"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureCoachProfile = ensureCoachProfile;
exports.upgradeToCoach = upgradeToCoach;
exports.getCoachBySlug = getCoachBySlug;
exports.getCoachByCustomDomain = getCoachByCustomDomain;
exports.getCoachPackages = getCoachPackages;
exports.updateCoachTheme = updateCoachTheme;
exports.setPersonaSnapshot = setPersonaSnapshot;
exports.checkSlugAvailable = checkSlugAvailable;
const sdk_1 = require("@coaching/sdk");
/** Idempotently ensures user_profiles + coach_profiles rows exist. Safe to call before any coach write. */
async function ensureCoachProfile(userId) {
    const { error: upErr } = await sdk_1.supabase
        .from('user_profiles')
        .upsert({ user_id: userId, role: 'coach' }, { onConflict: 'user_id' });
    if (upErr)
        throw new Error(`ensureCoachProfile user_profiles: ${upErr.message}`);
    const slug = 'coach-' + userId.replace(/-/g, '').slice(0, 12);
    const { error: cpErr } = await sdk_1.supabase
        .from('coach_profiles')
        .upsert({ coach_id: userId, slug, display_name: 'My Coaching Practice' }, { onConflict: 'coach_id', ignoreDuplicates: true });
    if (cpErr)
        throw new Error(`ensureCoachProfile coach_profiles: ${cpErr.message}`);
}
async function upgradeToCoach(userId, slug, displayName) {
    await sdk_1.supabase.from('user_profiles').upsert({ user_id: userId, role: 'coach' });
    const { data, error } = await sdk_1.supabase
        .from('coach_profiles')
        .insert({ coach_id: userId, slug, display_name: displayName })
        .select()
        .single();
    if (error)
        throw new Error(error.message);
    return mapCoach(data);
}
async function getCoachBySlug(slug) {
    const { data, error } = await sdk_1.supabase
        .from('coach_profiles')
        .select('*')
        .eq('slug', slug)
        .single();
    if (error)
        throw new Error(`Coach not found: ${slug}`);
    return mapCoach(data);
}
async function getCoachByCustomDomain(domain) {
    const { data } = await sdk_1.supabase
        .from('coach_profiles')
        .select('*')
        .eq('custom_domain', domain)
        .single();
    return data ? mapCoach(data) : null;
}
async function getCoachPackages(coachId) {
    const { data } = await sdk_1.supabase
        .from('coaching_packages')
        .select('*')
        .eq('coach_id', coachId)
        .order('created_at', { ascending: false });
    return (data ?? []).map(mapPackage);
}
async function updateCoachTheme(coachId, themeConfig) {
    const { error } = await sdk_1.supabase
        .from('coach_profiles')
        .update({ theme_config: themeConfig })
        .eq('coach_id', coachId);
    if (error)
        throw new Error(error.message);
}
async function setPersonaSnapshot(coachId, snapshotId) {
    const { error } = await sdk_1.supabase
        .from('coach_profiles')
        .update({ persona_snapshot_id: snapshotId })
        .eq('coach_id', coachId);
    if (error)
        throw new Error(error.message);
}
async function checkSlugAvailable(slug) {
    const { data } = await sdk_1.supabase
        .from('coach_profiles')
        .select('coach_id')
        .eq('slug', slug)
        .maybeSingle();
    return data === null;
}
function mapCoach(row) {
    return {
        coachId: row.coach_id,
        slug: row.slug,
        displayName: row.display_name,
        bio: row.bio,
        customDomain: row.custom_domain,
        personaSnapshotId: row.persona_snapshot_id,
        themeConfig: row.theme_config,
    };
}
function mapPackage(row) {
    return {
        packageId: row.package_id,
        coachId: row.coach_id,
        personaSnapshotId: row.persona_snapshot_id,
        title: row.title,
        description: row.description,
        coverImageUrl: row.cover_image_url,
        pricingModel: row.pricing_model,
        priceUsd: row.price_usd,
        isPublished: row.is_published,
    };
}
//# sourceMappingURL=coachTools.js.map