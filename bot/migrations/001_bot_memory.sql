-- Foil HQ Discord ops bot: persistent-memory schema.
-- Isolated from the main Foil app schema — bot_messages does NOT join any
-- user / scans / waitlist tables. The only sensitive surface is the message
-- content itself; access is gated by service-role key.
--
-- See docs/DECISIONS.md ADR-013 for the architectural rationale.

create extension if not exists vector;

-- Every @mention turn and every assistant reply lands as one row. Channel id
-- partitions naturally for "last 50 in this channel" recall + /reset.
create table if not exists bot_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null,
  user_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists bot_messages_channel_created_idx
  on bot_messages (channel_id, created_at desc);

-- Embeddings live in a 1:1 sidecar table. Reason: embeddings are wide (1536
-- floats = ~6KB) and we don't want them on every "fetch last 50" query.
create table if not exists bot_embeddings (
  message_id uuid primary key references bot_messages (id) on delete cascade,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

-- HNSW index for cosine-similarity retrieval. Defaults are fine for our
-- volume (single-digit thousands of messages); tune m/ef_construction only
-- if recall slows past ~50ms.
create index if not exists bot_embeddings_embedding_idx
  on bot_embeddings using hnsw (embedding vector_cosine_ops);

-- Top-k semantic search RPC, scoped to a single channel. Returns the
-- message rows joined with similarity score. Used by the /recall slash
-- command and by the conversation builder for cross-context lookups.
create or replace function bot_semantic_search(
  p_channel_id text,
  p_query_embedding vector(1536),
  p_top_k int default 5
)
returns table (
  id uuid,
  channel_id text,
  user_id text,
  role text,
  content text,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    m.id,
    m.channel_id,
    m.user_id,
    m.role,
    m.content,
    m.created_at,
    1 - (e.embedding <=> p_query_embedding) as similarity
  from bot_messages m
  inner join bot_embeddings e on e.message_id = m.id
  where m.channel_id = p_channel_id
  order by e.embedding <=> p_query_embedding
  limit p_top_k;
$$;

-- Lock the bot tables down to service-role access. The bot connects with
-- SUPABASE_SERVICE_ROLE_KEY (already in the Foil .env) so RLS off + grant
-- to service_role is the simplest secure posture for an isolated schema.
alter table bot_messages enable row level security;
alter table bot_embeddings enable row level security;

drop policy if exists bot_messages_service_all on bot_messages;
create policy bot_messages_service_all
  on bot_messages
  for all
  to service_role
  using (true) with check (true);

drop policy if exists bot_embeddings_service_all on bot_embeddings;
create policy bot_embeddings_service_all
  on bot_embeddings
  for all
  to service_role
  using (true) with check (true);
