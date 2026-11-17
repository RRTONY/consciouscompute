import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://consciouscompute.org", changeFrequency: "monthly", priority: 1 }];
}
