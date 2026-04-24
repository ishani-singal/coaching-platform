import { YoutubeVideo } from '@coaching/sdk';

const BASE = 'https://www.googleapis.com/youtube/v3';

export async function fetchChannelVideos(channelUrl: string): Promise<YoutubeVideo[]> {
  const channelId = await resolveChannelId(channelUrl);

  // Get uploads playlist ID
  const chanRes = await ytGet('channels', { id: channelId, part: 'contentDetails' });
  const uploadsId = chanRes.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) return [];

  // Paginate playlist items
  const videoIds: string[] = [];
  let pageToken: string | undefined;
  do {
    const params: Record<string, string> = { playlistId: uploadsId, part: 'snippet', maxResults: '50' };
    if (pageToken) params.pageToken = pageToken;
    const res = await ytGet('playlistItems', params);
    for (const item of res.items ?? []) {
      videoIds.push(item.snippet.resourceId.videoId as string);
    }
    pageToken = res.nextPageToken;
  } while (pageToken);

  if (videoIds.length === 0) return [];

  // Batch fetch full video details (max 50 per request)
  const videos: YoutubeVideo[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const res = await ytGet('videos', { id: batch.join(','), part: 'snippet,contentDetails,statistics' });
    for (const v of res.items ?? []) {
      videos.push({
        videoId:      v.id,
        title:        v.snippet.title,
        description:  v.snippet.description,
        thumbnailUrl: v.snippet.thumbnails?.medium?.url ?? '',
        publishedAt:  v.snippet.publishedAt,
        duration:     v.contentDetails.duration,
        viewCount:    parseInt(v.statistics?.viewCount ?? '0', 10),
        channelTitle: v.snippet.channelTitle,
      });
    }
  }
  return videos;
}

export async function fetchVideoMetadata(videoUrl: string): Promise<YoutubeVideo> {
  const videoId = extractVideoId(videoUrl);
  const res = await ytGet('videos', { id: videoId, part: 'snippet,contentDetails,statistics' });
  const v = res.items?.[0];
  if (!v) throw new Error(`Video not found: ${videoUrl}`);
  return {
    videoId:      v.id,
    title:        v.snippet.title,
    description:  v.snippet.description,
    thumbnailUrl: v.snippet.thumbnails?.medium?.url ?? '',
    publishedAt:  v.snippet.publishedAt,
    duration:     v.contentDetails.duration,
    viewCount:    parseInt(v.statistics?.viewCount ?? '0', 10),
    channelTitle: v.snippet.channelTitle,
  };
}

async function resolveChannelId(url: string): Promise<string> {
  const channelMatch = url.match(/youtube\.com\/channel\/([A-Za-z0-9_-]+)/);
  if (channelMatch) return channelMatch[1];

  const handleMatch = url.match(/youtube\.com\/@([A-Za-z0-9_.-]+)/);
  if (handleMatch) {
    const res = await ytGet('channels', { forHandle: `@${handleMatch[1]}`, part: 'id' });
    return res.items?.[0]?.id ?? (() => { throw new Error(`Channel not found: ${url}`); })();
  }

  const customMatch = url.match(/youtube\.com\/c\/([A-Za-z0-9_.-]+)/);
  if (customMatch) {
    const res = await ytGet('channels', { forUsername: customMatch[1], part: 'id' });
    return res.items?.[0]?.id ?? (() => { throw new Error(`Channel not found: ${url}`); })();
  }

  throw new Error(`Cannot resolve channel from URL: ${url}`);
}

function extractVideoId(url: string): string {
  const m = url.match(/[?&]v=([A-Za-z0-9_-]+)/) ?? url.match(/youtu\.be\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  throw new Error(`Cannot extract video ID from: ${url}`);
}

async function ytGet(endpoint: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY not set');
  const qs = new URLSearchParams({ ...params, key }).toString();
  const res = await fetch(`${BASE}/${endpoint}?${qs}`);
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}
