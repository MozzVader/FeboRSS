import Parser from "rss-parser";

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "FeedReader/1.0",
    Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml",
  },
});

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

  const items: ParsedArticle[] = feed.items
    .filter((item) => item.title && item.link)
    .map((item) => {
      let imageUrl: string | undefined = undefined;

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

      return {
        title: item.title!,
        url: item.link!,
        content: item["content:encoded"] || item.content || undefined,
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