-- Feature requests table
create table if not exists public.feature_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  user_email  text not null,
  content     text not null check (char_length(content) between 10 and 500),
  likes       integer not null default 0,
  dislikes    integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Feature votes table (one vote per user per request)
create table if not exists public.feature_votes (
  user_id     uuid not null references auth.users(id) on delete cascade,
  request_id  uuid not null references public.feature_requests(id) on delete cascade,
  vote        text not null check (vote in ('like', 'dislike')),
  created_at  timestamptz not null default now(),
  primary key (user_id, request_id)
);

-- RLS
alter table public.feature_requests enable row level security;
alter table public.feature_votes enable row level security;

-- Anyone authenticated can read requests
create policy "read feature_requests" on public.feature_requests
  for select using (auth.role() = 'authenticated');

-- Authenticated users can insert their own requests
create policy "insert feature_requests" on public.feature_requests
  for insert with check (auth.uid() = user_id);

-- Users can only delete their own requests
create policy "delete own feature_requests" on public.feature_requests
  for delete using (auth.uid() = user_id);

-- Anyone authenticated can read votes
create policy "read feature_votes" on public.feature_votes
  for select using (auth.role() = 'authenticated');

-- Users can manage their own votes
create policy "manage own feature_votes" on public.feature_votes
  for all using (auth.uid() = user_id);

-- Function to recalculate like/dislike counts for a request
create or replace function public.update_vote_counts(p_request_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.feature_requests
  set
    likes    = (select count(*) from public.feature_votes where request_id = p_request_id and vote = 'like'),
    dislikes = (select count(*) from public.feature_votes where request_id = p_request_id and vote = 'dislike')
  where id = p_request_id;
end;
$$;
