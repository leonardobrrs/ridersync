const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtube-nocookie.com']);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeVideoId(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (!YOUTUBE_HOSTS.has(u.hostname)) return null;
  const candidate =
    u.hostname === 'youtu.be'
      ? u.pathname.slice(1).split('/')[0]
      : u.pathname === '/watch'
        ? u.searchParams.get('v')
        : u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/)?.[1];
  return candidate && YOUTUBE_ID.test(candidate) ? candidate : null;
}

export function isVimeoUrl(raw: string) {
  try {
    return ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(new URL(raw).hostname);
  } catch {
    return false;
  }
}

/**
 * Miniatura de vídeo externo. YouTube: URL estável derivada do ID (sem chamada externa).
 * Vimeo: oEmbed oficial, aceitando somente imagens servidas pelo CDN do Vimeo.
 * Qualquer falha resulta em null (o item continua válido, apenas sem miniatura).
 */
export async function resolveVideoThumbnail(url: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const yt = youtubeVideoId(url);
  if (yt) return `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
  if (!isVimeoUrl(url)) return null;
  try {
    const res = await fetchImpl(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { thumbnail_url?: unknown };
    if (typeof body.thumbnail_url !== 'string') return null;
    const thumb = new URL(body.thumbnail_url);
    return thumb.protocol === 'https:' && thumb.hostname.endsWith('.vimeocdn.com') ? thumb.toString() : null;
  } catch {
    return null;
  }
}
