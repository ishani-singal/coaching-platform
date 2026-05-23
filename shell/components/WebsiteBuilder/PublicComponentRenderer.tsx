import type { WebsiteConfig, WebsiteComponent } from '@coaching/sdk';

interface Props {
  config: WebsiteConfig | null | undefined;
}

function renderComponent(comp: WebsiteComponent) {
  const p = comp.props;

  switch (comp.type) {
    case 'ribbon':
      return (
        <div
          key={comp.id}
          className="w-full py-2.5 px-4 text-center text-sm font-medium"
          style={{ backgroundColor: p.bgColor || '#fef08a', color: p.textColor || '#78350f' }}
        >
          {p.text}
        </div>
      );
    case 'hero':
      return (
        <section key={comp.id} className="py-20 px-8 text-center bg-gradient-to-br from-indigo-50 to-white">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{p.heading}</h1>
          {p.subheading && <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">{p.subheading}</p>}
          {p.ctaText && (
            <a
              href={p.ctaUrl || '#'}
              className="inline-block bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold text-base hover:bg-indigo-700 transition-colors"
            >
              {p.ctaText}
            </a>
          )}
        </section>
      );
    case 'cta_button':
      return (
        <div key={comp.id} className="flex justify-center py-8 px-4">
          <a
            href={p.url || '#'}
            className="inline-block px-8 py-3 rounded-xl font-semibold text-base shadow transition-colors"
            style={{
              backgroundColor: p.bgColor || '#4f46e5',
              color: p.textColor || '#ffffff',
            }}
          >
            {p.text}
          </a>
        </div>
      );
    case 'testimonial':
      return (
        <section key={comp.id} className="py-12 px-8 max-w-2xl mx-auto">
          <blockquote className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <p className="text-lg italic text-gray-700 mb-4">"{p.quote}"</p>
            <footer>
              <p className="font-semibold text-gray-900">{p.name}</p>
              {p.title && <p className="text-sm text-gray-500">{p.title}</p>}
            </footer>
          </blockquote>
        </section>
      );
    case 'feature_block':
      return (
        <section key={comp.id} className="py-12 px-8 max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="text-4xl mb-4">{p.icon}</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">{p.heading}</h3>
            <p className="text-gray-600">{p.body}</p>
          </div>
        </section>
      );
    case 'image_text':
      return (
        <section key={comp.id} className="py-16 px-8 max-w-5xl mx-auto">
          <div className={`flex flex-col md:flex-row gap-8 items-center ${p.layout === 'right' ? 'md:flex-row-reverse' : ''}`}>
            {p.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.imageUrl}
                alt={p.imageAlt || ''}
                className="w-full md:w-1/2 rounded-2xl object-cover aspect-video"
              />
            )}
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{p.heading}</h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{p.body}</p>
            </div>
          </div>
        </section>
      );
    case 'custom_html':
      return (
        <section key={comp.id} className="py-8 px-8 max-w-5xl mx-auto">
          <div dangerouslySetInnerHTML={{ __html: p.html || '' }} />
        </section>
      );
    default:
      return null;
  }
}

export default function PublicComponentRenderer({ config }: Props) {
  if (!config || config.components.length === 0) return null;

  // Render ribbon first (if any), then other components sorted by y
  const ribbons = config.components.filter(c => c.type === 'ribbon');
  const rest = config.components.filter(c => c.type !== 'ribbon').sort((a, b) => a.y - b.y);

  return (
    <>
      {ribbons.map(comp => renderComponent(comp))}
      {rest.map(comp => renderComponent(comp))}
    </>
  );
}
