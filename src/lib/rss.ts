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
 * Reddit puts image URLs inside <a> tags instead of <img> tags.
 * This extracts the image URL from those links.
 */
function extractRedditImageUrl(content?: string): string | undefined {
  if (!content) return undefined;
  const match = content.match(
    /<a[^>]+href=["'](https?:\/\/(?:preview|i)\.redd\.it\/[^"']+)["'][^>]*>/i
  );
  return match ? match[1] : undefined;
}

/**
 * Transform Reddit content: convert <a href="preview.redd.it/..."> to <img> tags
 * so images render properly in the reading modal.
 */
function transformRedditContent(content?: string): string | undefined {
  if (!content) return content;
  return content.replace(
    /<a\s[^>]*href=["'](https?:\/\/(?:preview|i)\.redd\.it\/[^"']+)["'][^>]*>[^<]*<\/a>/gi,
    '<img src="$1" alt="" loading="lazy" />'
  );
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
      let imageUrl: string | undefined = undefined;

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

      // Reddit-specific: extract image URL from <a> tags
      if (!imageUrl && reddit) {
        imageUrl =
          extractRedditImageUrl(item["content:encoded"]) ||
          extractRedditImageUrl(item.content);
      }

      // Get raw content
      let content = item["content:encoded"] || item.content || undefined;

      // Reddit-specific: transform <a> image links into <img> tags
      if (reddit && content) {
        content = transformRedditContent(content);
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