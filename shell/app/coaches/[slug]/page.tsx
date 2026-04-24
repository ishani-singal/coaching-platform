import { getCoachBySlug } from '@coaching/tools';
import { getLatestPersonaSnapshot } from '@coaching/tools';
import { getPublishedPackagesForCoach } from '@coaching/tools';
import { getLibraryForPublicSite } from '@coaching/skills';
import { getBookingPages } from '@coaching/tools';
import { configureBridge } from '@coaching/tools';
import PersonaChatWidget from '@/components/PersonaChatWidget';
import BookingSection from '@/components/BookingSection';

// Configure bridge for server-side calls
configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

export default async function CoachPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [coach, packages] = await Promise.all([
    getCoachBySlug(slug),
    getPublishedPackagesForCoach('').then(() => null).catch(() => null), // will be loaded below
  ]);

  const [snapshot, publishedPackages, library, bookingPages] = await Promise.all([
    getLatestPersonaSnapshot(coach.coachId),
    getPublishedPackagesForCoach(coach.coachId),
    getLibraryForPublicSite(coach.coachId).catch(() => ({ youtube: [], books: [], articles: [], podcasts: [] })),
    getBookingPages(coach.coachId).catch(() => []),
  ]);

  const sectionOrder = coach.themeConfig?.sectionOrder ?? ['hero', 'chat', 'programs', 'library', 'booking'];
  const hidden = new Set(coach.themeConfig?.hiddenSections ?? []);

  return (
    <div className="min-h-screen bg-white">
      {sectionOrder.filter(s => !hidden.has(s)).map(section => {
        switch (section) {
          case 'hero':
            return (
              <section key="hero" className="bg-gradient-to-br from-indigo-50 to-white py-20 px-8 text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">{coach.displayName}</h1>
                {snapshot && <p className="text-lg text-gray-600 max-w-2xl mx-auto">{snapshot.summary}</p>}
                {coach.bio && <p className="text-gray-500 mt-4 max-w-xl mx-auto">{coach.bio}</p>}
              </section>
            );

          case 'chat':
            return (
              <section key="chat" className="py-16 px-8 max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-center mb-8">Chat with {coach.displayName}</h2>
                <PersonaChatWidget coachSlug={slug} />
              </section>
            );

          case 'programs':
            return (
              <section key="programs" className="py-16 px-8 max-w-5xl mx-auto">
                <h2 className="text-2xl font-bold text-center mb-8">Programs</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {publishedPackages.map(pkg => (
                    <div key={pkg.packageId} className="border rounded-xl p-6 hover:shadow-md transition-shadow">
                      {pkg.coverImageUrl && <img src={pkg.coverImageUrl} alt={pkg.title} className="w-full rounded-lg mb-4 aspect-video object-cover" />}
                      <h3 className="font-bold text-lg mb-2">{pkg.title}</h3>
                      {pkg.description && <p className="text-gray-600 text-sm mb-4">{pkg.description}</p>}
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-600">
                          {pkg.pricingModel === 'free' ? 'Free' : pkg.priceUsd ? `$${pkg.priceUsd}` : 'Contact'}
                        </span>
                        <a href={`/coaches/${slug}/${pkg.packageId}`} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm">Learn More</a>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );

          case 'library':
            return (
              <section key="library" className="py-16 px-8 max-w-5xl mx-auto bg-gray-50">
                <h2 className="text-2xl font-bold text-center mb-8">Resources</h2>
                {library.youtube.length > 0 && (
                  <div className="mb-8">
                    <h3 className="font-semibold text-gray-700 mb-4">Videos</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                      {library.youtube.slice(0, 8).map(v => (
                        <a key={v.itemId} href={v.url} target="_blank" rel="noreferrer" className="block">
                          {v.thumbnailUrl && <img src={v.thumbnailUrl} alt={v.title} className="w-full rounded-lg aspect-video object-cover mb-2" />}
                          <p className="text-sm font-medium line-clamp-2">{v.title}</p>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {library.books.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-4">Recommended Books</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {library.books.map(b => (
                        <div key={b.itemId} className="text-sm">
                          <div className="font-medium">{b.title}</div>
                          <div className="text-gray-500">{(b.metadata as Record<string, string>).author}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );

          case 'booking':
            return <BookingSection key="booking" bookingPages={bookingPages} coachSlug={slug} />;

          default:
            return null;
        }
      })}
    </div>
  );
}
