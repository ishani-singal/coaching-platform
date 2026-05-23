import { getCoachBySlug, getPublishedPackagesForCoach, configureBridge } from '@coaching/tools';
import Link from 'next/link';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

export default async function PackagePage({ params }: { params: Promise<{ slug: string; packageId: string }> }) {
  const { slug, packageId } = await params;
  const coach = await getCoachBySlug(slug);
  const packages = await getPublishedPackagesForCoach(coach.userId);
  const pkg = packages.find(p => p.packageId === packageId);

  if (!pkg) return <div className="p-8 text-gray-400">Package not found.</div>;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto py-16 px-8">
        {pkg.coverImageUrl && <img src={pkg.coverImageUrl} alt={pkg.title} className="w-full rounded-xl mb-8 aspect-video object-cover" />}
        <h1 className="text-3xl font-bold mb-4">{pkg.title}</h1>
        {pkg.description && <p className="text-gray-600 mb-8 leading-relaxed">{pkg.description}</p>}
        <div className="flex items-center justify-between bg-gray-50 rounded-xl p-6">
          <div>
            <div className="text-sm text-gray-500 mb-1">Investment</div>
            <div className="text-2xl font-bold text-indigo-600">
              {pkg.pricingModel === 'free' ? 'Free' : pkg.priceUsd ? `$${pkg.priceUsd}` : 'Contact'}
            </div>
          </div>
          <Link
            href={`/coaches/${slug}/${packageId}/enroll`}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Enroll Now
          </Link>
        </div>
      </div>
    </div>
  );
}
