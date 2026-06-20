import Parser from "rss-parser";

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "FeedReader/1.0",
    Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml",
  },
});

/** Check if a feed URL belongs to Reddit */
export function isRedditFeed(url: string): boolean {
  return /reddit\.com/i.test(url);
}

/**
 * Reddit image handling — 3 distinct scenarios:
 *
 * 1. Post with <a href="i.redd.it/..."> (no <img>) → e.g. Ragnar
 *    - imageUrl comes from the <a> tag
 *    - Content has no <img>, so transform adds one
 *    - imageUrl is NOT in content before transform, but IS after
 *
 * 2. Post with <img src="preview.redd.it/..."> AND <a href="i.redd.it/...">
 *    - e.g. GTA VI
 *    - imageUrl comes from <img> (thumbnail, but good enough for cards)
 *    - Content already has <img> → transform also converts the <a> link
 *
 * 3. Post with <img src="preview.redd.it/...width=140"> (tiny thumbnail, no <a>)
 *    - e.g. Firefly
 *    - The <img> is too small; transform upgrades it to full-size
 */

/**
 * Extract Reddit image URL from <a> tags.
 * Matches both i.redd.it and preview.redd.it URLs.
 */
function extractRedditImageUrl(content?: string): string | undefined {
  if (!content) return undefined;
  const match = content.match(
    /<a[^>]+href=["'](https?:\/\/(?:preview|i)\.redd\.it\/[^"']+)["'][^>]*>/i
  );
  return match ? match[1] : undefined;
}

/**
 * Extract Reddit image URL from <img> tags (preview.redd.it thumbnails).
 */
function extractRedditImgSrc(content?: string): string | undefined {
  if (!content) return undefined;
  const match = content.match(
    /<img[^>]+src=["'](https?:\/\/preview\.redd\.it\/[^"']+)["']/i
  );
  return match ? match[1] : undefined;
}

/**
 * Transform Reddit content:
 * - Convert <a href="redd.it/..."> links to <img> tags
 * - Replace tiny preview.redd.it thumbnails (width < 300) with full-size versions
 */
function transformRedditContent(content?: string): string | undefined {
  if (!content) return content;
  let result = content;

  // 1. Convert <a> links with reddit image URLs into <img> tags
  result = result.replace(
    /<a\s[^>]*href=["'](https?:\/\/(?:preview|i)\.redd\.it\/[^"']+)["'][^>]*>[^<]*<\/a>/gi,
    '<img src="$1" alt="" loading="lazy" />'
  );

  // 2. Replace tiny preview thumbnails (width < 300) with full-size versions
  result = result.replace(
    /(<img[^>]+src=["'])(https?:\/\/preview\.redd\.it\/[^"']+\?width=)(\d{1,3})(?:[^"']*)(["'])/gi,
    (_match, prefix, baseUrl, width, quote) => {
      const w = parseInt(width, 10);
      if (w < 300) {
        // Remove query params for full-size image
        const cleanUrl = baseUrl.replace(/[?&].*/g, "");
        return prefix + cleanUrl + quote;
      }
      return _match;
    }
  );

  return result;
}

/**
 * For Reddit feeds, determine the best imageUrl for card thumbnails.
 * Priority:
 * 1. <a> link with redd.it (direct image, highest quality) — covers scenario 1 & 2
 * 2. <img> src with preview.redd.it — covers scenario 3
 */
function getRedditImageUrl(content?: string): string | undefined {
  if (!content) return undefined;
  // Prefer <a> links (direct, full-size images like i.redd.it)
  const linkUrl = extractRedditImageUrl(content);
  if (linkUrl) return linkUrl;
  // Fall back to <img> src (preview thumbnails)
  return extractRedditImgSrc(content);
}

export interface ParsedFeed {
  title: string;
  description?: string;
  siteUrl?: string;
  imageUrl?: string;
  items: ParsedArticle[];
}

export interface ParsedArticle {
  title: string;
  url: string;
  content?: string;
  summary?: string;
  author?: string;
  imageUrl?: string;
  publishedAt?: Date;
}

export async function parseFeedUrl(url: string): Promise<ParsedFeed> {
  const feed = await parser.parseURL(url);
  const reddit = isRedditFeed(url);

  const items: ParsedArticle[] = feed.items
    .filter((item) => item.title && item.link)
    .map((item) => {
      const rawContent = item["content:encoded"] || item.content || undefined;
      let imageUrl: string | undefined = undefined;
      let content = rawContent;

      if (reddit) {
        // Reddit-specific: best image URL for thumbnails (cards)
        imageUrl = getRedditImageUrl(rawContent);
        // Reddit-specific: transform content for proper rendering in modal
        content = transformRedditContent(rawContent);
      } else {
        // Standard image detection (works for most feeds)
        if (item.enclosure?.url && item.enclosure.type?.startsWith("image")) {
          imageUrl = item.enclosure.url;
        } else if (item["media:content"]?.$.url) {
          imageUrl = item["media:content"].$.url;
        } else {
          const imgMatch =
            item.content?.match(/<img[^>]+src=["']([^"']+)["']/i) ||
            item["content:encoded"]?.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (imgMatch) imageUrl = imgMatch[1];
        }
      }

      return {
        title: item.title!,
        url: item.link!,
        content,
        summary: item.contentSnippet || item.summary || undefined,
        author: item.creator || item.author || undefined,
        imageUrl,
        publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
      };
    });

  let imageUrl: string | undefined = undefined;
  if (feed.image?.url) {
    imageUrl = feed.image.url;
  } else if (feed.image?.link) {
    imageUrl = feed.image.link;
  }

  return {
    title: feed.title || "Sin titulo",
    description: feed.description || undefined,
    siteUrl: feed.link || undefined,
    imageUrl,
    items,
  };
}
