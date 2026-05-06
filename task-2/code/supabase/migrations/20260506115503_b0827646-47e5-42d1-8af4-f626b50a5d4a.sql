
create or replace function public.become_host(
  _org_name text,
  _description text default null,
  _website text default null,
  _display_name text default null,
  _avatar_url text default null,
  _bio text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  _user uuid := auth.uid();
begin
  if _user is null then raise exception 'Not authenticated'; end if;
  if coalesce(trim(_org_name),'') = '' then raise exception 'Organization name is required'; end if;

  insert into public.host_profiles (id, org_name, description, website)
    values (_user, _org_name, _description, _website)
    on conflict (id) do update
      set org_name = excluded.org_name,
          description = excluded.description,
          website = excluded.website;

  insert into public.user_roles (user_id, role)
    values (_user, 'host')
    on conflict (user_id, role) do nothing;

  if _display_name is not null or _avatar_url is not null or _bio is not null then
    update public.profiles set
      display_name = coalesce(_display_name, display_name),
      avatar_url = coalesce(_avatar_url, avatar_url),
      bio = coalesce(_bio, bio),
      updated_at = now()
    where id = _user;
  end if;
end $$;

revoke execute on function public.become_host(text,text,text,text,text,text) from anon, public;
grant execute on function public.become_host(text,text,text,text,text,text) to authenticated;
