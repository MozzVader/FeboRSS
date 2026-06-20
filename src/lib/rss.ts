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
 * Reddit content parsing — revised strategy based on real Atom RSS data.
 *
 * Real RSS structure (old.reddit.com/r/SUBREDDIT.rss):
 *
 * 1. IMAGE POST (direct):
 *    <a href="https://old.reddit.com/r/.../comments/...">
 *      <img src="https://preview.redd.it/FILE?width=640&crop=smart&s=SIGNED_HASH" />
 *    </a>
 *    <a href="https://i.redd.it/FILE">[link]</a>
 *
 * 2. GIF POST:
 *    Same structure as image, but URLs end in .gif.
 *    i.redd.it/FILE.gif serves the actual animated GIF.
 *    preview.redd.it/FILE.gif?width=640&s=HASH also works (animated preview).
 *
 * 3. GALLERY POST:
 *    <img src="https://preview.redd.it/FILE?width=140&height=140&crop=1:1,smart&s=HASH" />
 *    <a href="https://www.reddit.com/gallery/ID">[link]</a>
 *    The thumbnail is tiny (140px) and no individual image URLs exist in RSS.
 *
 * 4. TEXT POST:
 *    No <img> tags, just text content in a <div class="md">.
 *
 * 5. VIDEO POST (v.redd.it):
 *    Similar to image but the underlying content is a video.
 *    RSS only provides a preview thumbnail, no .mp4 URL.
 */

/**
 * Extract the direct media URL from the [link] pattern.
 * Reddit includes a <a href="MEDIA_URL">[link]</a> for image/GIF posts.
 * This gives us the best-quality URL (i.redd.it) without preview params.
 */
function extractRedditDirectLink(content?: string): string | undefined {
  if (!content) return undefined;
  const match = content.match(
    /<a\s[^>]*href=["'](https?:\/\/i\.redd\.it\/[^"']+)["'][^>]*>\[link\]<\/a>/i
  );
  return match ? match[1] : undefined;
}

/**
 * Extract the [link] href to detect gallery posts.
 */
function extractRedditLinkUrl(content?: string): string | undefined {
  if (!content) return undefined;
  const match = content.match(
    /<a\s[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>\[link\]<\/a>/i
  );
  return match ? match[1] : undefined;
}

/**
 * Check if a post is a Reddit gallery.
 */
function isRedditGallery(content?: string): boolean {
  if (!content) return false;
  const linkUrl = extractRedditLinkUrl(content);
  return !!linkUrl && /\/gallery\//i.test(linkUrl);
}

/**
 * Extract Reddit preview image URL from <img> tags.
 * Matches both preview.redd.it (Reddit-hosted) and external-preview.redd.it (thumbnails
 * for external content like YouTube, redgifs, imgur, gfycat, etc.).
 * These are signed URLs with ?width=...&s=HASH — they MUST keep the params to work.
 */
function extractRedditPreviewImg(content?: string): string | undefined {
  if (!content) return undefined;
  const match = content.match(
    /<img[^>]+src=["'](https?:\/\/(?:external-)?preview\.redd\.it\/[^"']+)["']/i
  );
  return match ? match[1] : undefined;
}

/**
 * Determine the best imageUrl for card thumbnails.
 *
 * Priority:
 * 1. i.redd.it from [link] — direct image, best quality (covers images & GIFs)
 * 2. preview.redd.it from <img> — signed thumbnail (fallback, may be tiny for galleries)
 *
 * For gallery posts: skip the thumbnail if it's too small (width < 300),
 * since a 140x140 crop isn't useful as a card preview.
 */
function getRedditImageUrl(content?: string): string | undefined {
  if (!content) return undefined;

  // 1. Direct media link (i.redd.it) — best quality for images and GIFs
  const directUrl = extractRedditDirectLink(content);
  if (directUrl) return directUrl;

  // 2. Preview thumbnail from <img> tag
  const previewUrl = extractRedditPreviewImg(content);
  if (!previewUrl) return undefined;

  // Skip tiny thumbnails (width < 300) — likely a gallery post
  const widthMatch = previewUrl.match(/[?&]width=(\d+)/);
  if (widthMatch) {
    const w = parseInt(widthMatch[1], 10);
    if (w < 300) return undefined;
  }

  return previewUrl;
}

/**
 * Transform Reddit content for proper rendering in the article reader modal.
 *
 * Strategy:
 * 1. Replace the first <a> that wraps a preview <img> (the post header thumbnail)
 *    with just the <img> — removes the wrapping link to the post since we're already
 *    reading the article.
 * 2. Convert <a href="i.redd.it/...">[link]</a> into an <img> tag for the
 *    full-size image/GIF. This is the real content, not a navigation link.
 * 3. Remove the tiny table layout that Reddit uses for the post header.
 * 4. For gallery posts: inject a "view gallery" link.
 */
function transformRedditContent(content?: string): string | undefined {
  if (!content) return content;
  let result = content;

  // 1. Convert <a href="i.redd.it/...">[link]</a> → <img> (full-size image/GIF)
  // This targets specifically the [link] text to avoid touching post navigation links
  result = result.replace(
    /<a\s[^>]*href=["'](https?:\/\/i\.redd\.it\/[^"']+)["'][^>]*>\[link\]<\/a>/gi,
    '<img src="$1" alt="" loading="lazy" style="max-width:100%;border-radius:8px" />'
  );

  // 2. Remove the Reddit table layout wrapper around the thumbnail
  // Works for both preview.redd.it and external-preview.redd.it
  result = result.replace(
    /<table>\s*<tr>\s*<td>\s*<a\s[^>]*href=["'][^"']*["'][^>]*>\s*(<img[^>]*src=["']https?:\/\/(?:external-)?preview\.redd\.it\/[^"']+["'][^>]*\/?>)\s*<\/a>\s*<\/td>\s*<td>.*?<\/td>\s*<\/tr>\s*<\/table>/gis,
    '$1'
  );

  // 3. For gallery posts, add a link to view the gallery
  const galleryLink = content.match(
    /<a\s[^>]*href=["'](https?:\/\/(?:www\.)?reddit\.com\/gallery\/[^"']+)["'][^>]*>\[link\]<\/a>/i
  );
  if (galleryLink) {
    result = result.replace(
      /<a\s[^>]*href=["'](https?:\/\/(?:www\.)?reddit\.com\/gallery\/[^"']+)["'][^>]*>\[link\]<\/a>/gi,
      `<a href="$1" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;padding:6px 14px;border-radius:6px;background:var(--accent);color:var(--accent-foreground);font-size:13px;text-decoration:none">Ver galería en Reddit →</a>`
    );
  }

  // 4. For external links (redgifs, imgur, gfycat, youtube, etc.) that are NOT i.redd.it
  //    and NOT gallery, convert [link] into a styled button that opens the external content.
  //    These posts have an external-preview.redd.it thumbnail but the actual content
  //    lives on the external site.
  result = result.replace(
    /<a\s[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>\[link\]<\/a>/gi,
    (match, href: string) => {
      // Skip if already handled (i.redd.it converted to img, gallery converted to button)
      if (/i\.redd\.it/i.test(href)) return match;
      if (/\/gallery\//i.test(href)) return match;

      // Extract a short domain name for the button label
      let domain = 'enlace externo';
      try {
        const urlObj = new URL(href);
        domain = urlObj.hostname.replace('www.', '');
      } catch { /* keep default */ }

      return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;padding:6px 14px;border-radius:6px;background:#333;color:#fff;font-size:13px;text-decoration:none">Ver en ${domain} →</a>`;
    }
  );

  return result;
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
