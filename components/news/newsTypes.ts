/** Shape of one entry in the news index (public/news/index.json). */
export interface NewsIndexEntry {
  slug: string;
  title: string;
  date: string;      // YYYY-MM-DD
  category: string;
  image: string;
  excerpt: string;
}
