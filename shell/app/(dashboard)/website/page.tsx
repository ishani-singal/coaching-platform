'use client';
import { useEffect, useState } from 'react';
import { useSession } from '@/components/SessionProvider';
import type { WebsiteConfig, NavItem } from '@coaching/sdk';
import WebsiteBuilderShell from '@/components/WebsiteBuilder/WebsiteBuilderShell';

interface ProfileData {
  slug: string;
  displayName: string;
  bio?: string;
  websiteNavBar?: NavItem[];
  websiteDraft?: WebsiteConfig | null;
}

export default function WebsitePage() {
  const { userId } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      fetch(`/api/coaches/profile?userId=${encodeURIComponent(userId)}`).then(r => r.json()),
      fetch('/api/website/draft').then(r => r.json()),
    ]).then(([profileRes, draftRes]: [
      { success: boolean; data?: { slug?: string; displayName?: string; bio?: string; websiteNavBar?: NavItem[] } | null },
      { success: boolean; data?: WebsiteConfig | null }
    ]) => {
      if (!profileRes.success || !profileRes.data) {
        setError('Profile not found. Please set up your profile in Settings first.');
        return;
      }
      setProfile({
        slug: profileRes.data.slug ?? '',
        displayName: profileRes.data.displayName ?? '',
        bio: profileRes.data.bio,
        websiteNavBar: profileRes.data.websiteNavBar,
        websiteDraft: draftRes.success ? draftRes.data : null,
      });
    }).catch(() => setError('Failed to load website builder.')).finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Loading website builder…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    // Escape the parent layout's p-8 to fill the viewport
    <div className="-m-8 h-[calc(100vh-4rem)]">
      <WebsiteBuilderShell profile={profile} />
    </div>
  );
}
