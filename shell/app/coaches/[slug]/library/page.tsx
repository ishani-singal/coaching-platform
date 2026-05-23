
import { getCoachBySlug } from '@coaching/tools';
import { getLibraryForPublicSite } from '@coaching/skills';
import { configureBridge } from '@coaching/tools';
import ThumbnailImage from '@/components/ThumbnailImage';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

export default async function CoachLibraryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const coach = await getCoachBySlug(slug);

  const library = await getLibraryForPublicSite(coach.userId).catch(() => ({
    youtube: [], books: [], articles: [], podcasts: [],
  }));

  const hasContent =
    library.youtube.length > 0 ||
    library.books.length > 0 ||
    library.articles.length > 0 ||
    library.podcasts.length > 0;

  return (
    <div className="py-12 px-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">{coach.displayName}&apos;s Library</h1>
      <p className="text-gray-500 mb-10">Resources, reads, and recommendations from {coach.displayName}.</p>

      {!hasContent && (
        <p className="text-gray-400 text-center py-24">No resources added yet — check back soon.</p>
      )}

      {library.youtube.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Videos</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {library.youtube.map(v => (
              <a key={v.itemId} href={v.url} target="_blank" rel="noreferrer" className="block group">
                {v.thumbnailUrl && (
                  <ThumbnailImage
                    src={v.thumbnailUrl}
                    alt={v.title}
                    className="w-full rounded-lg aspect-video object-cover mb-2 group-hover:opacity-90 transition-opacity"
                  />
                )}
                <p className="text-sm font-medium line-clamp-2 group-hover:text-indigo-600 transition-colors">{v.title}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {library.books.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Recommended Books</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {library.books.map(b => {
              const meta = b.metadata as Record<string, string> | undefined;
              return (
                <div key={b.itemId} className="border rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
                  <p className="text-sm font-semibold line-clamp-2 mb-1">{b.title}</p>
                  {meta?.author && <p className="text-xs text-gray-500 mb-2">{meta.author}</p>}
                  {b.description && <p className="text-xs text-gray-400 line-clamp-3 mb-3">{b.description}</p>}
                  {b.buyLink && (
                    <a
                      href={b.buyLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-indigo-600 font-medium hover:underline"
                    >
                      Get it →
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {library.articles.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Articles</h2>
          <div className="flex flex-col gap-3">
            {library.articles.map(a => (
              <a
                key={a.itemId}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-3 border rounded-xl p-4 bg-white hover:shadow-sm hover:border-indigo-200 transition-all"
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold mb-0.5 group-hover:text-indigo-600">{a.title}</p>
                  {a.description && <p className="text-xs text-gray-500 line-clamp-2">{a.description}</p>}
                </div>
                <span className="text-xs text-gray-400 shrink-0">→</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {library.podcasts.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Podcasts</h2>
          <div className="flex flex-col gap-3">
            {library.podcasts.map(p => (
              <a
                key={p.itemId}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-3 border rounded-xl p-4 bg-white hover:shadow-sm hover:border-indigo-200 transition-all"
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold mb-0.5">{p.title}</p>
                  {p.description && <p className="text-xs text-gray-500 line-clamp-2">{p.description}</p>}
                </div>
                <span className="text-xs text-gray-400 shrink-0">→</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
