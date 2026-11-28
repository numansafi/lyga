-- Atomic Sync PIN rate-limit counter to prevent concurrent check-then-write races.
create or replace function public.consume_sync_pin_attempt(
  p_bucket_key text,
  p_max_attempts integer,
  p_window_ms bigint
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_sec integer
)
language plpgsql
security definer
as $$
declare
  v_now timestamptz := now();
  v_next_reset timestamptz := v_now + (p_window_ms || ' milliseconds')::interval;
  v_row public.sync_pin_attempts%rowtype;
begin
  insert into public.sync_pin_attempts as spa (bucket_key, attempt_count, reset_at)
  values (p_bucket_key, 1, v_next_reset)
  on conflict (bucket_key) do update
    set
      attempt_count = case
        when spa.reset_at <= v_now then 1
        when spa.attempt_count > p_max_attempts then spa.attempt_count
        else spa.attempt_count + 1
      end,
      reset_at = case
        when spa.reset_at <= v_now then v_next_reset
        else spa.reset_at
      end
  returning * into v_row;

  if v_row.reset_at > v_now and v_row.attempt_count > p_max_attempts then
    return query select
      false,
      0,
      greatest(1, ceil(extract(epoch from (v_row.reset_at - v_now)))::integer);
  else
    return query select true, greatest(0, p_max_attempts - v_row.attempt_count), 0;
  end if;
end;
$$;
