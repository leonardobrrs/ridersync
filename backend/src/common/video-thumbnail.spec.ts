import { resolveVideoThumbnail, youtubeVideoId } from './video-thumbnail';

describe('miniaturas de vídeo externo', () => {
  it.each([
    ['https://www.youtube.com/watch?v=RiderSync01', 'RiderSync01'],
    ['https://youtu.be/RiderSync01?t=30', 'RiderSync01'],
    ['https://m.youtube.com/watch?v=RiderSync01&list=x', 'RiderSync01'],
    ['https://www.youtube.com/shorts/RiderSync01', 'RiderSync01'],
    ['https://www.youtube.com/embed/RiderSync01', 'RiderSync01'],
    ['https://www.youtube.com/live/RiderSync01', 'RiderSync01'],
  ])('extrai o ID de %s', (url, id) => {
    expect(youtubeVideoId(url)).toBe(id);
  });

  it.each(['https://www.youtube.com/', 'https://www.youtube.com/watch?v=curto', 'https://evil.example/watch?v=RiderSync01', 'nada'])('ignora %s', (url) => {
    expect(youtubeVideoId(url)).toBeNull();
  });

  it('YouTube gera miniatura sem chamada externa', async () => {
    const fetchSpy = jest.fn();
    await expect(resolveVideoThumbnail('https://youtu.be/RiderSync01', fetchSpy)).resolves.toBe('https://i.ytimg.com/vi/RiderSync01/hqdefault.jpg');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Vimeo usa oEmbed e só aceita imagens do CDN do Vimeo', async () => {
    const ok = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ thumbnail_url: 'https://i.vimeocdn.com/video/1_640.jpg' }) });
    await expect(resolveVideoThumbnail('https://vimeo.com/123', ok as unknown as typeof fetch)).resolves.toBe('https://i.vimeocdn.com/video/1_640.jpg');
    const evil = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ thumbnail_url: 'https://evil.example/x.jpg' }) });
    await expect(resolveVideoThumbnail('https://vimeo.com/123', evil as unknown as typeof fetch)).resolves.toBeNull();
    const down = jest.fn().mockRejectedValue(new Error('rede'));
    await expect(resolveVideoThumbnail('https://vimeo.com/123', down as unknown as typeof fetch)).resolves.toBeNull();
  });

  it('outros links ficam sem miniatura', async () => {
    await expect(resolveVideoThumbnail('https://open.spotify.com/album/x')).resolves.toBeNull();
  });
});
