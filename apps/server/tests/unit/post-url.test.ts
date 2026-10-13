import { normalizePostUrl } from '../../src/modules/submissions/post-url';

const instagram = (code: string) => ({ platform: 'instagram', normalizedUrl: `https://www.instagram.com/p/${code}/` });
const youtube = (id: string) => ({ platform: 'youtube', normalizedUrl: `https://www.youtube.com/watch?v=${id}` });

describe('normalizePostUrl', () => {
  describe('Instagram', () => {
    it.each([
      'https://www.instagram.com/p/C8xYz12AbCd/',
      'https://www.instagram.com/p/C8xYz12AbCd',
      'https://instagram.com/reel/C8xYz12AbCd/?igsh=MWQ1ZGUxMzBkMA==',
      'https://m.instagram.com/reels/C8xYz12AbCd/',
      'https://www.instagram.com/tv/C8xYz12AbCd/',
      'http://WWW.INSTAGRAM.COM/p/C8xYz12AbCd/?utm_source=ig_web_copy_link#comments',
      'https://www.instagram.com/memepage_99/reel/C8xYz12AbCd/',
    ])('maps %s to the canonical post URL', (url) => {
      expect(normalizePostUrl(url)).toEqual(instagram('C8xYz12AbCd'));
    });

    it('keeps shortcode case, so posts differing only in case stay distinct', () => {
      expect(normalizePostUrl('https://www.instagram.com/p/AbCdEfG/')).toEqual(instagram('AbCdEfG'));
      expect(normalizePostUrl('https://www.instagram.com/p/abcdefg/')).toEqual(instagram('abcdefg'));
    });
  });

  describe('YouTube', () => {
    it.each([
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123',
      'https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=abc123',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/live/dQw4w9WgXcQ?feature=shared',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    ])('maps %s to the canonical video URL', (url) => {
      expect(normalizePostUrl(url)).toEqual(youtube('dQw4w9WgXcQ'));
    });

    it('keeps video id case', () => {
      expect(normalizePostUrl('https://youtu.be/AAAAAAAAAAa')).toEqual(youtube('AAAAAAAAAAa'));
      expect(normalizePostUrl('https://youtu.be/AAAAAAAAAAA')).toEqual(youtube('AAAAAAAAAAA'));
    });
  });

  it.each([
    ['not a URL', 'just some text'],
    ['a scheme-less link', 'instagram.com/p/C8xYz12AbCd/'],
    ['a non-web scheme', 'javascript:alert(1)'],
    ['an ftp URL', 'ftp://www.instagram.com/p/C8xYz12AbCd/'],
    ['a custom port', 'https://www.instagram.com:8443/p/C8xYz12AbCd/'],
    ['embedded credentials', 'https://user:pass@www.instagram.com/p/C8xYz12AbCd/'],
    ['a lookalike host', 'https://instagram.com.evil.example/p/C8xYz12AbCd/'],
    ['another platform', 'https://www.tiktok.com/@user/video/123456789'],
    ['an Instagram profile', 'https://www.instagram.com/memepage_99/'],
    ['an Instagram story', 'https://www.instagram.com/stories/memepage_99/3141592653589793/'],
    ['an Instagram post without a shortcode', 'https://www.instagram.com/p/'],
    ['a YouTube channel', 'https://www.youtube.com/@SomeChannel'],
    ['a YouTube playlist', 'https://www.youtube.com/playlist?list=PL1234567890'],
    ['a watch link without a video id', 'https://www.youtube.com/watch?list=PL123'],
    ['a video id of the wrong length', 'https://youtu.be/dQw4w9WgXc'],
    ['a video id with invalid characters', 'https://www.youtube.com/watch?v=dQw4w9WgX!Q'],
  ])('rejects %s', (_label, url) => {
    expect(normalizePostUrl(url)).toBeUndefined();
  });
});
