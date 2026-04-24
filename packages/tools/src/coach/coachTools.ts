import { supabase } from '@coaching/sdk';
import { CoachProfile, ThemeConfig, CoachingPackage } from '@coaching/sdk';

export async function upgradeToCoach(userId: string, slug: string, displayName: string): Promise<CoachProfile> {
  await supabase.from('user_profiles').upsert({ user_id: userId, role: 'coach' });
  const { data, error } = await supabase
    .from('coach_profiles')
    .insert({ coach_id: userId, slug, display_name: displayName })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapCoach(data);
}

export async function getCoachBySlug(slug: string): Promise<CoachProfile> {
  const { data, error } = await supabase
    .from('coach_profiles')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error) throw new Error(`Coach not found: ${slug}`);
  return mapCoach(data);
}

export async function getCoachByCustomDomain(domain: string): Promise<CoachProfile | null> {
  const { data } = await supabase
    .from('coach_profiles')
    .select('*')
    .eq('custom_domain', domain)
    .single();
  return data ? mapCoach(data) : null;
}

export async function getCoachPackages(coachId: string): Promise<CoachingPackage[]> {
  const { data } = await supabase
    .from('coaching_packages')
    .select('*')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });
  return (data ?? []).map(mapPackage);
}

export async function updateCoachTheme(coachId: string, themeConfig: ThemeConfig): Promise<void> {
  const { error } = await supabase
    .from('coach_profiles')
    .update({ theme_config: themeConfig })
    .eq('coach_id', coachId);
  if (error) throw new Error(error.message);
}

export async function setPersonaSnapshot(coachId: string, snapshotId: string): Promise<void> {
  const { error } = await supabase
    .from('coach_profiles')
    .update({ persona_snapshot_id: snapshotId })
    .eq('coach_id', coachId);
  if (error) throw new Error(error.message);
}

export async function checkSlugAvailable(slug: string): Promise<boolean> {
  const { data } = await supabase
    .from('coach_profiles')
    .select('coach_id')
    .eq('slug', slug)
    .maybeSingle();
  return data === null;
}

function mapCoach(row: Record<string, unknown>): CoachProfile {
  return {
    coachId:           row.coach_id as string,
    slug:              row.slug as string,
    displayName:       row.display_name as string,
    bio:               row.bio as string | undefined,
    customDomain:      row.custom_domain as string | undefined,
    personaSnapshotId: row.persona_snapshot_id as string | undefined,
    themeConfig:       row.theme_config as ThemeConfig | undefined,
  };
}

function mapPackage(row: Record<string, unknown>): CoachingPackage {
  return {
    packageId:         row.package_id as string,
    coachId:           row.coach_id as string,
    personaSnapshotId: row.persona_snapshot_id as string,
    title:             row.title as string,
    description:       row.description as string | undefined,
    coverImageUrl:     row.cover_image_url as string | undefined,
    pricingModel:      row.pricing_model as CoachingPackage['pricingModel'],
    priceUsd:          row.price_usd as number | undefined,
    isPublished:       row.is_published as boolean,
  };
}
