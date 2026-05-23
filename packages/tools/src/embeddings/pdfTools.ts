/**
 * Fetch a PDF from a public URL and extract its full text content.
 * pdf-parse is dynamically imported to avoid its module-load-time test file access
 * (which crashes Next.js routes at startup).
 */
export async function extractPdfText(url: string): Promise<string> {
  const { default: pdfParse } = await import('pdf-parse');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch PDF at ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const data = await pdfParse(buffer);
  return data.text ?? '';
}

/**
 * Fetch a Word document (.doc/.docx) from a public URL and extract its plain text.
 * mammoth is used for docx; .doc files are not supported by mammoth and will throw.
 */
export async function extractWordText(url: string): Promise<string> {
  const mammoth = await import('mammoth');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch Word document at ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? '';
}

/**
 * Detect whether a URL points to a Word document based on extension or content-type.
 */
export function isWordDocument(url: string): boolean {
  const lower = url.toLowerCase().split('?')[0];
  return lower.endsWith('.doc') || lower.endsWith('.docx');
}
