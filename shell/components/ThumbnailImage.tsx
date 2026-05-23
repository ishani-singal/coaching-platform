'use client';

interface ThumbnailImageProps {
  src: string;
  alt: string;
  className?: string;
}

/** For a YouTube i.ytimg.com URL, returns the next fallback thumbnail quality. */
function nextYtThumb(src: string): string | null {
  if (src.includes('/maxresdefault.')) return src.replace('/maxresdefault.', '/hqdefault.');
  if (src.includes('/hqdefault.'))    return src.replace('/hqdefault.',    '/mqdefault.');
  if (src.includes('/mqdefault.'))    return src.replace('/mqdefault.',    '/default.');
  return null;
}

export default function ThumbnailImage({ src, alt, className }: ThumbnailImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={e => {
        const img = e.target as HTMLImageElement;
        const fallback = nextYtThumb(img.src);
        if (fallback) {
          img.src = fallback;
        } else {
          img.style.display = 'none';
        }
      }}
    />
  );
}
