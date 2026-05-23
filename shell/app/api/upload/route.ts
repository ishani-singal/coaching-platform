import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
  // Verify authenticated session
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 50 MB limit' }, { status: 413 });
  }

  // Sanitize filename — strip directory traversal and unusual characters
  const safeName = file.name.replace(/[^a-zA-Z0-9._\- ]/g, '_').replace(/\s+/g, '_');
  const path = `${user.id}/${Date.now()}_${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Use service role key for storage upload (bypasses RLS)
  const serviceClient = createServiceClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error: uploadError } = await serviceClient.storage
    .from('library-files')
    .upload(path, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = serviceClient.storage
    .from('library-files')
    .getPublicUrl(path);

  return NextResponse.json({ url: publicUrl, fileName: file.name, mimeType: file.type });
}
