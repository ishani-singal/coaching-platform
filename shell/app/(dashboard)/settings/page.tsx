'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSession } from '@/components/SessionProvider';

const AGENT_URL = '/api/agents/coaching-program-builder/action';

const COACHING_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '',                   label: 'Select type…' },
  { value: 'life_coach',         label: 'Life Coach' },
  { value: 'fitness_coach',      label: 'Fitness Coach' },
  { value: 'business_coach',     label: 'Business Coach' },
  { value: 'mental_health_coach',label: 'Mental Health Coach' },
  { value: 'nutrition_coach',    label: 'Nutrition Coach' },
  { value: 'career_coach',       label: 'Career Coach' },
  { value: 'executive_coach',    label: 'Executive Coach' },
  { value: 'wellness_coach',     label: 'Wellness Coach' },
];

export default function SettingsPage() {
  const { userId } = useSession();
  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [coachingType, setCoachingType] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [slugStatus, setSlugStatus] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isExistingProfile, setIsExistingProfile] = useState(false);

  const [channelUrl, setChannelUrl] = useState('');
  const [channelSaved, setChannelSaved] = useState('');
  const [channelSaving, setChannelSaving] = useState(false);

  const [linkedin, setLinkedin] = useState('');
  const [instagram, setInstagram] = useState('');
  const [socialSaved, setSocialSaved] = useState('');
  const [socialSaving, setSocialSaving] = useState(false);

  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoSaved, setLogoSaved] = useState('');
  const logoFileRef = useRef<HTMLInputElement>(null);

  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [gmailDisconnecting, setGmailDisconnecting] = useState(false);
  const [gmailStatus, setGmailStatus] = useState('');

  useEffect(() => {
    if (!userId) return;

    fetch(`/api/coaches/profile?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then((d: { success: boolean; data?: { slug?: string; displayName?: string; bio?: string; coachingType?: string; customDomain?: string; logo?: string; socialMedia?: { linkedin?: string; instagram?: string; youtubeChannelUrl?: string } } | null }) => {
        if (d.success && d.data) {
          setSlug(d.data.slug ?? '');
          setDisplayName(d.data.displayName ?? '');
          setBio(d.data.bio ?? '');
          setCoachingType(d.data.coachingType ?? '');
          setCustomDomain(d.data.customDomain ?? '');
          setChannelUrl(d.data.socialMedia?.youtubeChannelUrl ?? '');
          const social = d.data.socialMedia ?? {};
          setLinkedin(social.linkedin ?? '');
          setInstagram(social.instagram ?? '');
          setLogoUrl(d.data.logo ?? '');
          setIsExistingProfile(true);
        }
      })
      .finally(() => setProfileLoading(false));
  }, [userId]);

  useEffect(() => {
    fetch('/api/auth/gmail/status')
      .then(r => r.json())
      .then((d: { connected: boolean; email: string | null }) => {
        setGmailConnected(d.connected);
        setGmailEmail(d.email);
      })
      .finally(() => setGmailLoading(false));

    // Handle OAuth callback result in URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail_connected') === '1') {
      setGmailStatus('✓ Gmail connected successfully');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('gmail_error')) {
      setGmailStatus(`✗ Connection failed: ${params.get('gmail_error')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function checkSlug() {
    if (!slug) return;
    const params = new URLSearchParams({ slug });
    if (isExistingProfile && userId) params.set('excludeCoachId', userId);
    const r = await fetch(`/api/coaches/slug-check?${params.toString()}`).then(r => r.json()) as { available: boolean };
    setSlugStatus(r.available ? '✓ Available' : '✗ Taken');
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileStatus('');

    try {
      if (!isExistingProfile) {
        // First time: run full upgrade (LLM persona init, package seeding)
        const r = await fetch('/api/coaches/upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, slug, displayName }),
        }).then(r => r.json()) as { success: boolean; message?: string; data: { subdomainUrl: string } };

        if (!r.success) {
          setProfileStatus(`✗ Failed: ${r.message}`);
          return;
        }
        setIsExistingProfile(true);

        // Save coaching type if selected
        if (coachingType) {
          await fetch('/api/coaches/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, coachingType }),
          });
        }

        setProfileStatus(`✓ Profile created! Your site: ${r.data?.subdomainUrl}`);
      } else {
        // Existing profile: update in place
        const r = await fetch('/api/coaches/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, displayName, slug, bio: bio || undefined, coachingType: coachingType || undefined, customDomain: customDomain || undefined }),
        }).then(r => r.json()) as { success: boolean; message?: string };

        setProfileStatus(r.success ? '✓ Profile saved' : `✗ Failed: ${r.message}`);
      }
    } finally {
      setProfileSaving(false);
    }
  }

  async function saveLogo(e: React.FormEvent) {
    e.preventDefault();
    setLogoUploading(true);
    setLogoSaved('');
    try {
      let finalUrl = logoUrl;
      if (logoFile) {
        const supabase = createClient();
        const ext = logoFile.name.split('.').pop() ?? 'bin';
        const filePath = `logos/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('library-files').upload(filePath, logoFile);
        if (upErr) throw new Error(upErr.message);
        const { data: urlData } = supabase.storage.from('library-files').getPublicUrl(filePath);
        finalUrl = urlData.publicUrl;
        setLogoUrl(finalUrl);
        setLogoFile(null);
      }
      const r = await fetch('/api/coaches/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, logo: finalUrl || null }),
      }).then(r => r.json()) as { success: boolean; message?: string };
      setLogoSaved(r.success ? '✓ Logo saved' : `✗ Failed: ${r.message}`);
    } catch (err) {
      setLogoSaved(`✗ ${(err as Error).message}`);
    } finally {
      setLogoUploading(false);
    }
  }

  async function saveSocial(e: React.FormEvent) {
    e.preventDefault();
    setSocialSaving(true); setSocialSaved('');
    const r = await fetch('/api/coaches/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, socialMedia: { linkedin: linkedin || undefined, instagram: instagram || undefined } }),
    }).then(r => r.json()) as { success: boolean; message?: string };
    setSocialSaving(false);
    setSocialSaved(r.success ? '✓ Social profiles saved' : `✗ Failed: ${r.message}`);
  }

  async function saveChannel(e: React.FormEvent) {
    e.preventDefault();
    setChannelSaving(true); setChannelSaved('');
    const r = await fetch(AGENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'save_youtube_channel', params: { channelUrl } }),
    }).then(r => r.json()) as { success: boolean; message?: string };
    setChannelSaving(false);
    setChannelSaved(r.success ? '✓ Channel saved' : `✗ Failed: ${r.message}`);
  }

  async function disconnectGmail() {
    setGmailDisconnecting(true);
    const r = await fetch('/api/auth/gmail/disconnect', { method: 'POST' }).then(r => r.json()) as { success?: boolean; error?: string };
    setGmailDisconnecting(false);
    if (r.success) {
      setGmailConnected(false);
      setGmailEmail(null);
      setGmailStatus('Gmail disconnected');
    } else {
      setGmailStatus(`✗ Failed: ${r.error}`);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="bg-white rounded-xl shadow p-6 max-w-lg">
        <h2 className="font-semibold mb-4">Coach Profile</h2>
        {profileLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <form onSubmit={saveProfile} className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 uppercase">Display Name</label>
              <input className="w-full border rounded px-3 py-2 text-sm mt-1" placeholder="Your Name" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase">Bio</label>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm mt-1 resize-y"
                rows={4}
                placeholder="Tell people about yourself, your experience, and what makes your coaching unique…"
                value={bio}
                onChange={e => setBio(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase">Slug</label>
              <div className="flex gap-2 mt-1">
                <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="yourslug" value={slug} onChange={e => { setSlug(e.target.value); setSlugStatus(''); }} required />
                <button type="button" onClick={checkSlug} className="border rounded px-3 py-2 text-sm text-gray-700">Check</button>
              </div>
              {slugStatus && <p className="text-xs mt-1 text-gray-600">{slugStatus}</p>}
              <p className="text-xs text-gray-400 mt-1">Your public URL will be <span className="font-mono">{slug || 'yourslug'}.your-domain.com</span></p>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase">Custom Domain</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm mt-1"
                placeholder="coach.yourdomain.com"
                value={customDomain}
                onChange={e => setCustomDomain(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">Optional. Point your domain's DNS A/CNAME to this platform first.</p>
            </div>
            <div>
              <label htmlFor="coachingType" className="text-xs text-gray-500 uppercase">Coaching Persona</label>
              <select
                id="coachingType"
                className="w-full border rounded px-3 py-2 text-sm mt-1 bg-white"
                value={coachingType}
                onChange={e => setCoachingType(e.target.value)}
              >
                {COACHING_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={profileSaving}
              className="bg-indigo-600 text-white px-4 py-2 rounded text-sm w-full disabled:opacity-50"
            >
              {profileSaving ? 'Saving…' : isExistingProfile ? 'Save Profile' : 'Create Coach Profile'}
            </button>
            {profileStatus && <p className="text-sm text-green-700 break-all">{profileStatus}</p>}
          </form>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-6 max-w-lg">
        <h2 className="font-semibold mb-1">Brand Logo</h2>
        <p className="text-xs text-gray-500 mb-4">Your logo is automatically included on certificates you issue.</p>
        {profileLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <form onSubmit={saveLogo} className="space-y-3">
            <div className="flex items-center gap-3">
              {logoUrl && (
                <img src={logoUrl} alt="Logo" className="h-12 w-12 object-contain rounded border border-gray-200 bg-gray-50" />
              )}
              <div className="flex-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => logoFileRef.current?.click()}
                  className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                >
                  {logoFile ? logoFile.name : 'Choose file…'}
                </button>
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null;
                    setLogoFile(f);
                    if (f) setLogoUrl(URL.createObjectURL(f));
                  }}
                />
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => { setLogoUrl(''); setLogoFile(null); }}
                    className="text-xs text-red-500 hover:text-red-700 px-2"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400">PNG, JPG or SVG. Transparent background recommended.</p>
            <button
              type="submit"
              disabled={logoUploading}
              className="bg-indigo-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            >
              {logoUploading ? 'Saving…' : 'Save Logo'}
            </button>
            {logoSaved && <p className="text-sm text-green-700">{logoSaved}</p>}
          </form>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-6 max-w-lg">
        <h2 className="font-semibold mb-1">Social Profiles</h2>
        <p className="text-xs text-gray-500 mb-4">Connect your social profiles. These are used to enrich your AI persona.</p>
        {profileLoading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : (
          <form onSubmit={saveSocial} className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 uppercase">LinkedIn URL</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm mt-1"
                placeholder="https://www.linkedin.com/in/yourprofile"
                value={linkedin}
                onChange={e => setLinkedin(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase">Instagram URL</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm mt-1"
                placeholder="https://www.instagram.com/yourhandle"
                value={instagram}
                onChange={e => setInstagram(e.target.value)}
              />
            </div>
            <button type="submit" disabled={socialSaving}
              className="bg-indigo-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
              {socialSaving ? 'Saving...' : 'Save Social Profiles'}
            </button>
            {socialSaved && <p className="text-sm text-green-700">{socialSaved}</p>}
          </form>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-6 max-w-lg">
        <h2 className="font-semibold mb-1">YouTube Channel</h2>
        <p className="text-xs text-gray-500 mb-4">Connect your YouTube channel to pick videos when building module sections.</p>
        {profileLoading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : (
          <form onSubmit={saveChannel} className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 uppercase">Channel URL</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm mt-1"
                placeholder="https://www.youtube.com/@YourChannel"
                value={channelUrl}
                onChange={e => setChannelUrl(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">Supports /@handle, /channel/ID, and /c/name formats.</p>
            </div>
            <button type="submit" disabled={!channelUrl.trim() || channelSaving}
              className="bg-indigo-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
              {channelSaving ? 'Saving...' : 'Save Channel'}
            </button>
            {channelSaved && <p className="text-sm text-green-700">{channelSaved}</p>}
          </form>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-6 max-w-lg">
        <h2 className="font-semibold mb-1">Gmail for Sending Emails</h2>
        <p className="text-xs text-gray-500 mb-4">Connect your Gmail account to send enrollment invites and nudges directly from your own email address.</p>
        {gmailLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : gmailConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              <span className="text-green-600 text-sm">✓ Connected as <strong>{gmailEmail}</strong></span>
            </div>
            <button
              type="button"
              onClick={disconnectGmail}
              disabled={gmailDisconnecting}
              className="border border-red-300 text-red-600 hover:bg-red-50 px-4 py-2 rounded text-sm disabled:opacity-50"
            >
              {gmailDisconnecting ? 'Disconnecting…' : 'Disconnect Gmail'}
            </button>
          </div>
        ) : (
          <a
            href="/api/auth/gmail"
            className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:border-indigo-400 hover:text-indigo-600 text-gray-700 px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="currentColor"/>
            </svg>
            Connect Gmail
          </a>
        )}
        {gmailStatus && (
          <p className={`text-xs mt-3 ${gmailStatus.startsWith('✓') ? 'text-green-700' : 'text-red-600'}`}>{gmailStatus}</p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-6 max-w-lg">
        <h2 className="font-semibold mb-1">Public Site Navigation</h2>
        <p className="text-xs text-gray-500 mb-4">Manage your website navigation and design in the Website Builder.</p>
        <a
          href="/website"
          className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Open Website Builder →
        </a>
      </div>
    </div>
  );
}

