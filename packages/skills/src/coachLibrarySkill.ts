import { LibraryItem } from '@coaching/sdk';
import { fetchChannelVideos, addLibraryItem, updateLibraryItem, getLibraryItemByUrl, getLibraryByCoach } from '@coaching/tools';

export async function syncYoutubeChannel(
  coachId: string,
  channelUrl: string
): Promise<{ added: number; updated: number }> {
  const videos = await fetchChannelVideos(channelUrl);
  let added = 0, updated = 0;

  for (const v of videos) {
    const existing = await getLibraryItemByUrl(coachId, `https://youtube.com/watch?v=${v.videoId}`);

    if (existing) {
      await updateLibraryItem(existing.itemId, {
        title:        v.title,
        description:  v.description,
        thumbnailUrl: v.thumbnailUrl,
        metadata:     { duration: v.duration, viewCount: v.viewCount, publishedAt: v.publishedAt, channelTitle: v.channelTitle, channelUrl },
      });
      updated++;
    } else {
      await addLibraryItem(coachId, {
        itemType:     'youtube',
        title:        v.title,
        url:          `https://youtube.com/watch?v=${v.videoId}`,
        description:  v.description,
        thumbnailUrl: v.thumbnailUrl,
        tags:         [],
        metadata:     { duration: v.duration, viewCount: v.viewCount, publishedAt: v.publishedAt, channelTitle: v.channelTitle, channelUrl },
        displayOrder: 0,
      });
      added++;
    }
  }

  return { added, updated };
}


export async function organizeLibrary(
  patches: { itemId: string; tags?: string[]; displayOrder?: number }[]
): Promise<void> {
  await Promise.all(
    patches.map(p => updateLibraryItem(p.itemId, { tags: p.tags, displayOrder: p.displayOrder }))
  );
}

export async function getLibraryForPublicSite(coachId: string): Promise<{
  youtube: LibraryItem[];
  books: LibraryItem[];
  articles: LibraryItem[];
  podcasts: LibraryItem[];
}> {
  const [youtube, books, articles, podcasts] = await Promise.all([
    getLibraryByCoach(coachId, 'youtube'),
    getLibraryByCoach(coachId, 'book'),
    getLibraryByCoach(coachId, 'article'),
    getLibraryByCoach(coachId, 'podcast'),
  ]);
  return { youtube, books, articles, podcasts };
}
