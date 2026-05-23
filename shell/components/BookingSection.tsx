import Link from 'next/link';

interface AppointmentType {
  appointment_type_id: string;
  title:               string;
  description:         string | null;
  duration_mins:       number;
  price_usd:           number;
  currency:            string;
}

type Props = { appointmentTypes: AppointmentType[]; coachSlug: string };

export default function BookingSection({ appointmentTypes, coachSlug }: Props) {
  if (appointmentTypes.length === 0) return null;

  return (
    <section className="py-16 px-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-8">Book a Session</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {appointmentTypes.map(t => (
          <div key={t.appointment_type_id} className="border rounded-xl p-6 hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-lg mb-1">{t.title}</h3>
            {t.description && <p className="text-sm text-gray-500 mb-3">{t.description}</p>}
            <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
              <span>⏱ {t.duration_mins} min</span>
              {Number(t.price_usd) > 0
                ? <span>💳 {t.currency} {Number(t.price_usd).toFixed(2)}</span>
                : <span className="text-green-600">🆓 Free</span>
              }
            </div>
            <Link
              href={`/coaches/${coachSlug}/book/${t.appointment_type_id}`}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm inline-block hover:bg-indigo-700"
            >
              Book Now
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
