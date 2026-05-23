import { createClient } from '@supabase/supabase-js';

interface Appointment {
  appointment_id:    string;
  status:            string;
  client_name:       string;
  client_email:      string;
  starts_at:         string;
  ends_at:           string;
  timezone:          string;
  price_usd:         number;
  currency:          string;
  appointment_types: { title: string; duration_mins: number } | null;
}

export default async function ConfirmPage({
  params,
  searchParams,
}: {
  params:       Promise<{ slug: string; typeId: string }>;
  searchParams: Promise<{ appointment_id?: string }>;
}) {
  const { slug }          = await params;
  const { appointment_id } = await searchParams;

  if (!appointment_id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">No appointment ID provided.</p>
      </div>
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data } = await supabase
    .from('appointments')
    .select('appointment_id, status, client_name, client_email, starts_at, ends_at, timezone, price_usd, currency, appointment_types(title, duration_mins)')
    .eq('appointment_id', appointment_id)
    .single();

  const appt = data as Appointment | null;

  if (!appt) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Appointment not found.</p>
      </div>
    );
  }

  const isPending = appt.status === 'pending_payment';
  const isConfirmed = appt.status === 'confirmed';

  const starts = new Date(appt.starts_at).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white border rounded-2xl shadow-sm p-8 text-center space-y-5">
        {isConfirmed ? (
          <>
            <div className="text-5xl">🎉</div>
            <h1 className="text-2xl font-bold text-gray-900">You&apos;re booked!</h1>
            <p className="text-gray-500">A confirmation has been sent to {appt.client_email}.</p>
          </>
        ) : isPending ? (
          <>
            <div className="text-5xl">⏳</div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Pending</h1>
            <p className="text-gray-500">Complete your payment to confirm your booking. Your slot is held for 15 minutes.</p>
          </>
        ) : (
          <>
            <div className="text-5xl">✅</div>
            <h1 className="text-2xl font-bold text-gray-900">Booking Received</h1>
          </>
        )}

        <div className="bg-gray-50 border rounded-xl p-5 text-left space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Session</span>
            <span className="font-medium">{appt.appointment_types?.title ?? 'Session'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Date &amp; Time</span>
            <span className="font-medium text-right">{starts}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Timezone</span>
            <span className="font-medium">{appt.timezone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Duration</span>
            <span className="font-medium">{appt.appointment_types?.duration_mins} min</span>
          </div>
          {Number(appt.price_usd) > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Amount</span>
              <span className="font-medium">{appt.currency} {Number(appt.price_usd).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Name</span>
            <span className="font-medium">{appt.client_name}</span>
          </div>
        </div>

        <a
          href={`/coaches/${slug}/book`}
          className="block text-sm text-indigo-600 hover:underline"
        >
          ← Back to sessions
        </a>
      </div>
    </div>
  );
}
