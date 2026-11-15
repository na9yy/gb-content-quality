# GameBoost Content Quality

Internal tool that scores gameboost.com blogs and product pages on helpful-content dimensions
(originality, effort, helpfulness, skill, accuracy, trust, people-first, spam).

Stack: Next.js on Vercel, Supabase (tables in `public`, service role only), Firecrawl, DataForSEO, Claude. Similarity via MinHash + TF-IDF (no embeddings API).

## Setup
1. Apply `supabase/migrations/001_init.sql`.
2. Add env vars from `.env.example` in Vercel.
