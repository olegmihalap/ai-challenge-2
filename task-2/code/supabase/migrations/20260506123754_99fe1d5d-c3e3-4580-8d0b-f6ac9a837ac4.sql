
-- Seed a host user, profile, role, and assign hosted events
DO $$
DECLARE
  _host_id uuid := '00000000-0000-0000-0000-000000000a01';
BEGIN
  -- Create auth user if not exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _host_id) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', _host_id, 'authenticated', 'authenticated',
      'host@demo.lovable.app', crypt('DemoHost!2026', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Skyline Collective"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), _host_id,
      jsonb_build_object('sub', _host_id::text, 'email', 'host@demo.lovable.app'),
      'email', _host_id::text, now(), now(), now());
  END IF;

  INSERT INTO public.profiles (id, display_name)
    VALUES (_host_id, 'Skyline Collective')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.host_profiles (id, org_name, description, verified)
    VALUES (_host_id, 'Skyline Collective', 'Curating intimate music nights since 2018.', true)
    ON CONFLICT (id) DO UPDATE SET verified = true;

  INSERT INTO public.user_roles (user_id, role) VALUES (_host_id, 'host')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (_host_id, 'user')
    ON CONFLICT DO NOTHING;

  -- Assign all existing seeded events to this host
  UPDATE public.events SET host_id = _host_id WHERE host_id IS NULL;

  -- Ensure at least one upcoming + one past event with proper dates relative to now
  UPDATE public.events
    SET starts_at = now() + interval '5 days',
        ends_at = now() + interval '5 days' + interval '3 hours',
        status = 'published'
    WHERE id = '11111111-1111-1111-1111-111111111101';

  UPDATE public.events
    SET starts_at = now() - interval '12 days',
        ends_at = now() - interval '12 days' + interval '4 hours',
        status = 'completed'
    WHERE id = '11111111-1111-1111-1111-111111111107';
END $$;
