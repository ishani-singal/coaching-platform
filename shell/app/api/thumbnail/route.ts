import { NextRequest, NextResponse } from 'next/server';

async function fetchSpotifyThumbnail(url: string): Promise<string | null> {
  try {
    const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d.thumbnail_url ?? null;
  } catch {
    return null;
  }
}

async function fetchSoundCloudThumbnail(url: string): Promise<string | null> {
  try {
    const r = await fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d.thumbnail_url ?? null;
  } catch {
    return null;
  }
}

async function fetchApplePodcastsThumbnail(url: string): Promise<string | null> {
  try {
    const match = url.match(/\/id(\d+)/);
    if (!match) return null;
    const r = await fetch(`https://itunes.apple.com/lookup?id=${match[1]}&media=podcast`);
    if (!r.ok) return null;
    const d = await r.json();
    return d.results?.[0]?.artworkUrl600 ?? d.results?.[0]?.artworkUrl100 ?? null;
  } catch {
    return null;
  }
}

async function fetchOpenGraphThumbnail(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const html = await r.text();
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ thumbnailUrl: null }, { status: 400 });

  let thumbnailUrl: string | null = null;

  if (url.includes('spotify.com')) {
    thumbnailUrl = await fetchSpotifyThumbnail(url);
  } else if (url.includes('soundcloud.com')) {
    thumbnailUrl = await fetchSoundCloudThumbnail(url);
  } else if (url.includes('podcasts.apple.com')) {
    thumbnailUrl = await fetchApplePodcastsThumbnail(url);
  }

  if (!thumbnailUrl) {
    thumbnailUrl = await fetchOpenGraphThumbnail(url);
  }

  return NextResponse.json({ thumbnailUrl });
}
