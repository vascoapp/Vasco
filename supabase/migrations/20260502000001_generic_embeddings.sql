-- =============================================================================
-- GENERIC EMBEDDINGS TABLE + match_similar_items RPC (R279)
-- =============================================================================
-- Backs the generic semanticSearch.ts pipeline (searchMaterials,
-- searchSimilarJobs, searchRegulations). The specialized embedding tables
-- (customer_embeddings, material_embeddings, quote_line_embeddings, job_embeddings)
-- continue to serve their per-feature loops; this generic table covers the
-- type-agnostic search surface (SimilarJobsSuggest etc.) where 1536-d query
-- embeddings come from generate-embedding.
-- =============================================================================

create extension if not exists vector;

create table if not exists public.embeddings (
  id text primary key,
  item_type text not null check (item_type in ('material', 'job', 'regulation')),
  title text not null,
  description text default '',
  embedding vector(1536),
  metadata jsonb default '{}'::jsonb,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_embeddings_type on public.embeddings(item_type);
create index if not exists idx_embeddings_user on public.embeddings(user_id);
-- HNSW for cosine similarity search
create index if not exists idx_embeddings_vector on public.embeddings using hnsw (embedding vector_cosine_ops);

alter table public.embeddings enable row level security;

drop policy if exists "embeddings_owner_or_global" on public.embeddings;
create policy "embeddings_owner_or_global" on public.embeddings
  for select using (user_id is null or user_id = auth.uid());

drop policy if exists "embeddings_owner_write" on public.embeddings;
create policy "embeddings_owner_write" on public.embeddings
  for all using (user_id is null or user_id = auth.uid())
  with check (user_id is null or user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- match_similar_items — cosine similarity over the generic embeddings table
-- ---------------------------------------------------------------------------
create or replace function public.match_similar_items(
  query_embedding vector(1536),
  match_type text,
  match_count int default 5
)
returns table (
  id text,
  item_type text,
  title text,
  description text,
  similarity real,
  metadata jsonb
)
language plpgsql security definer set search_path = public as $$
begin
  return query
  select e.id,
         e.item_type,
         e.title,
         e.description,
         (1 - (e.embedding <=> query_embedding))::real as similarity,
         e.metadata
  from public.embeddings e
  where e.item_type = match_type
    and e.embedding is not null
    and (e.user_id is null or e.user_id = auth.uid())
  order by e.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
end;
$$;

grant execute on function public.match_similar_items(vector, text, int) to authenticated, service_role;
