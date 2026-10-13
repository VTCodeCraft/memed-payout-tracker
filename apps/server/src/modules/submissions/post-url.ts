import type { Platform } from '../../models/campaign.model';

export interface NormalizedPost {
  platform: Platform;
  normalizedUrl: string;
}

const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com']);
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);

// Optional "<username>/" segment, then the post type and its shortcode.
const INSTAGRAM_POST_PATH = /^\/(?:[A-Za-z0-9._]{1,30}\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)\/?$/;
const YOUTUBE_SHORT_LINK_PATH = /^\/([A-Za-z0-9_-]{11})\/?$/;
const YOUTUBE_VIDEO_PATH = /^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})\/?$/;
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Reduces an Instagram post/reel or YouTube video link to one canonical URL, so
 * different links to the same post compare equal (tracking parameters, share
 * formats and reel-vs-post paths are dropped). Hosts are case-insensitive, but
 * post ids keep their case: both platforms treat them as case-sensitive, and
 * lowercasing would merge distinct posts. Returns undefined for anything that is
 * not a single post or video.
 */
export function normalizePostUrl(raw: string): NormalizedPost | undefined {
  if (!URL.canParse(raw)) return undefined;
  const url = new URL(raw); // lowercases the hostname

  const isWebUrl = url.protocol === 'https:' || url.protocol === 'http:';
  if (!isWebUrl || url.port !== '' || url.username !== '' || url.password !== '') return undefined;

  if (INSTAGRAM_HOSTS.has(url.hostname)) {
    const shortcode = INSTAGRAM_POST_PATH.exec(url.pathname)?.[1];
    return shortcode ? { platform: 'instagram', normalizedUrl: `https://www.instagram.com/p/${shortcode}/` } : undefined;
  }

  const videoId = youtubeVideoId(url);
  return videoId ? { platform: 'youtube', normalizedUrl: `https://www.youtube.com/watch?v=${videoId}` } : undefined;
}

function youtubeVideoId(url: URL): string | undefined {
  let id: string | null | undefined;
  if (url.hostname === 'youtu.be') {
    id = YOUTUBE_SHORT_LINK_PATH.exec(url.pathname)?.[1];
  } else if (YOUTUBE_HOSTS.has(url.hostname)) {
    id = /^\/watch\/?$/.test(url.pathname) ? url.searchParams.get('v') : YOUTUBE_VIDEO_PATH.exec(url.pathname)?.[1];
  }
  return id && YOUTUBE_VIDEO_ID.test(id) ? id : undefined;
}
