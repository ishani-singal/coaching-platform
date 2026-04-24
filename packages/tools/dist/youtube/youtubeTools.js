"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchChannelVideos = fetchChannelVideos;
exports.fetchVideoMetadata = fetchVideoMetadata;
const BASE = 'https://www.googleapis.com/youtube/v3';
async function fetchChannelVideos(channelUrl) {
    const channelId = await resolveChannelId(channelUrl);
    // Get uploads playlist ID
    const chanRes = await ytGet('channels', { id: channelId, part: 'contentDetails' });
    const uploadsId = chanRes.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsId)
        return [];
    // Paginate playlist items
    const videoIds = [];
    let pageToken;
    do {
        const params = { playlistId: uploadsId, part: 'snippet', maxResults: '50' };
        if (pageToken)
            params.pageToken = pageToken;
        const res = await ytGet('playlistItems', params);
        for (const item of res.items ?? []) {
            videoIds.push(item.snippet.resourceId.videoId);
        }
        pageToken = res.nextPageToken;
    } while (pageToken);
    if (videoIds.length === 0)
        return [];
    // Batch fetch full video details (max 50 per request)
    const videos = [];
    for (let i = 0; i < videoIds.length; i += 50) {
        const batch = videoIds.slice(i, i + 50);
        const res = await ytGet('videos', { id: batch.join(','), part: 'snippet,contentDetails,statistics' });
        for (const v of res.items ?? []) {
            videos.push({
                videoId: v.id,
                title: v.snippet.title,
                description: v.snippet.description,
                thumbnailUrl: v.snippet.thumbnails?.medium?.url ?? '',
                publishedAt: v.snippet.publishedAt,
                duration: v.contentDetails.duration,
                viewCount: parseInt(v.statistics?.viewCount ?? '0', 10),
                channelTitle: v.snippet.channelTitle,
            });
        }
    }
    return videos;
}
async function fetchVideoMetadata(videoUrl) {
    const videoId = extractVideoId(videoUrl);
    const res = await ytGet('videos', { id: videoId, part: 'snippet,contentDetails,statistics' });
    const v = res.items?.[0];
    if (!v)
        throw new Error(`Video not found: ${videoUrl}`);
    return {
        videoId: v.id,
        title: v.snippet.title,
        description: v.snippet.description,
        thumbnailUrl: v.snippet.thumbnails?.medium?.url ?? '',
        publishedAt: v.snippet.publishedAt,
        duration: v.contentDetails.duration,
        viewCount: parseInt(v.statistics?.viewCount ?? '0', 10),
        channelTitle: v.snippet.channelTitle,
    };
}
async function resolveChannelId(url) {
    const channelMatch = url.match(/youtube\.com\/channel\/([A-Za-z0-9_-]+)/);
    if (channelMatch)
        return channelMatch[1];
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
function extractVideoId(url) {
    const m = url.match(/[?&]v=([A-Za-z0-9_-]+)/) ?? url.match(/youtu\.be\/([A-Za-z0-9_-]+)/);
    if (m)
        return m[1];
    throw new Error(`Cannot extract video ID from: ${url}`);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ytGet(endpoint, params) {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key)
        throw new Error('YOUTUBE_API_KEY not set');
    const qs = new URLSearchParams({ ...params, key }).toString();
    const res = await fetch(`${BASE}/${endpoint}?${qs}`);
    if (!res.ok)
        throw new Error(`YouTube API error: ${res.status}`);
    return res.json();
}
//# sourceMappingURL=youtubeTools.js.map