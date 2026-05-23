import { getCoachBySlug, configureBridge } from '@coaching/tools';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

configureBridge({ mode: 'http', authToken: process.env.SKILLZ_AGENT_AUTH_TOKEN });

interface AppointmentType {
  appointment_type_id: string;
  title:               string;
  description:         string | null;
  duration_mins:       number;
  price_usd:           number;
  currency:            string;
  is_active:           boolean;
  recurrence:          { enabled: boolean; frequency: string; occurrences: number } | null;
}

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const coach = await getCoachBySlug(slug);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: types } = await supabase
    .from('appointment_types')
    .select('appointment_type_id, title, description, duration_mins, price_usd, currency, is_active, recurrence')
    .eq('coach_id', coach.userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  const appointmentTypes = (types ?? []) as AppointmentType[];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto py-12 px-6">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Book with {coach.displayName}</h1>
          <p className="text-gray-500 mt-2">Choose a session type to get started</p>
        </div>

        {appointmentTypes.length === 0 ? (
          <div className="text-center text-gray-400 py-16 bg-white rounded-2xl border">
            <p className="text-lg">No sessions available at the moment.</p>
            <p className="text-sm mt-1">Check back later!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {appointmentTypes.map(t => (
              <Link
                key={t.appointment_type_id}
                href={`/coaches/${slug}/book/${t.appointment_type_id}`}
                className="block bg-white border rounded-2xl p-6 hover:border-indigo-400 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600">{t.title}</h2>
                    {t.description && <p className="text-sm text-gray-500 mt-1">{t.description}</p>}
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                      <span>⏱ {t.duration_mins} min</span>
                      {t.recurrence?.enabled
                        ? (
                          <span className="text-indigo-600 font-medium">
                            🔁 {t.recurrence.occurrences}× {t.recurrence.frequency}
                            {t.price_usd > 0 && ` · ${t.currency} ${(t.price_usd * t.recurrence.occurrences).toFixed(2)} total`}
                          </span>
                        )
                        : t.price_usd > 0
                        ? <span className="font-medium text-gray-800">💳 {t.currency} {Number(t.price_usd).toFixed(2)}</span>
                        : <span className="text-green-600 font-medium">🆓 Free</span>
                      }
                    </div>
                  </div>
                  <span className="text-indigo-500 text-sm font-medium mt-1 shrink-0 group-hover:underline">Select →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
