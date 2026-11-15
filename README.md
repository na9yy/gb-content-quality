# GameBoost Content Quality

Internal tool that scores gameboost.com blogs and product pages on helpful-content dimensions
(originality, effort, helpfulness, skill, accuracy, trust, people-first, spam).

Stack: Next.js on Vercel, Supabase (schema `content_quality`), Firecrawl, DataForSEO, Claude, OpenAI embeddings.

## Setup
1. Apply `supabase/migrations/001_init.sql`.
2. Add env vars from `.env.example` in Vercel.
3. Expose the `content_quality` schema in Supabase API settings.
