import { LibraryItem } from '@coaching/sdk';
import { fetchChannelVideos, addLibraryItem, updateLibraryItem, reorderLibraryItems, getLibraryByCoach } from '@coaching/tools';
import { supabase } from '@coaching/sdk';

export async function syncYoutubeChannel(
  coachId: string,
  channelUrl: string
): Promise<{ added: number; updated: number }> {
  const videos = await fetchChannelVideos(channelUrl);
  let added = 0, updated = 0;

  for (const v of videos) {
    const { data: existing } = await supabase
      .from('coach_library_items')
      .select('item_id')
      .eq('coach_id', coachId)
      .eq('url', `https://youtube.com/watch?v=${v.videoId}`)
      .maybeSingle();

    if (existing) {
      await updateLibraryItem(existing.item_id as string, {
        title:        v.title,
        description:  v.description,
        thumbnailUrl: v.thumbnailUrl,
        metadata:     { duration: v.duration, viewCount: v.viewCount, publishedAt: v.publishedAt },
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
        metadata:     { duration: v.duration, viewCount: v.viewCount, publishedAt: v.publishedAt, channelTitle: v.channelTitle },
        displayOrder: 0,
      });
      added++;
    }
  }

  return { added, updated };
}

export async function addBook(coachId: string, title: string, author: string, url: string | undefined, description: string, tags: string[]): Promise<LibraryItem> {
  return addLibraryItem(coachId, { itemType: 'book', title, url, description, tags, metadata: { author }, displayOrder: 0 });
}

export async function addArticle(coachId: string, title: string, url: string, description: string, tags: string[]): Promise<LibraryItem> {
  return addLibraryItem(coachId, { itemType: 'article', title, url, description, tags, metadata: {}, displayOrder: 0 });
}

export async function addPdf(coachId: string, title: string, fileUrl: string, description: string, tags: string[]): Promise<LibraryItem> {
  return addLibraryItem(coachId, { itemType: 'pdf', title, url: fileUrl, description, tags, metadata: {}, displayOrder: 0 });
}

export async function organizeLibrary(
  coachId: string,
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
