
revoke execute on function public.rsvp_register(uuid) from anon, public;
revoke execute on function public.rsvp_cancel(uuid) from anon, public;
revoke execute on function public.waitlist_position(uuid, uuid) from anon, public;
grant execute on function public.rsvp_register(uuid) to authenticated;
grant execute on function public.rsvp_cancel(uuid) to authenticated;
grant execute on function public.waitlist_position(uuid, uuid) to authenticated;
