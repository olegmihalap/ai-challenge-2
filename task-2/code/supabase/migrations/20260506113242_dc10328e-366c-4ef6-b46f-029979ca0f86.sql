
-- Enums
CREATE TYPE public.app_role AS ENUM ('visitor','user','host','checker','admin');
CREATE TYPE public.event_status AS ENUM ('draft','published','cancelled','completed');
CREATE TYPE public.rsvp_status AS ENUM ('going','waitlist','cancelled');
CREATE TYPE public.gallery_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.report_status AS ENUM ('open','reviewing','resolved','dismissed');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Host profiles
CREATE TABLE public.host_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_name TEXT NOT NULL,
  website TEXT,
  description TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.host_profiles ENABLE ROW LEVEL SECURITY;

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  category TEXT,
  location TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  capacity INTEGER NOT NULL DEFAULT 100,
  cover_image_url TEXT,
  status public.event_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_events_host ON public.events(host_id);
CREATE INDEX idx_events_status ON public.events(status);

-- RSVPs
CREATE TABLE public.rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.rsvp_status NOT NULL DEFAULT 'going',
  qr_code TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;

-- Check-ins
CREATE TABLE public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_id UUID NOT NULL REFERENCES public.rsvps(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  checked_in_by UUID REFERENCES auth.users(id),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rsvp_id)
);
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

-- Gallery
CREATE TABLE public.gallery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  status public.gallery_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;

-- Reports
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  gallery_item_id UUID REFERENCES public.gallery_items(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status public.report_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Feedback
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile + default user role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)), NEW.raw_user_meta_data->>'avatar_url');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== RLS Policies =====
-- profiles
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- host_profiles
CREATE POLICY "Host profiles are public" ON public.host_profiles FOR SELECT USING (true);
CREATE POLICY "Hosts manage own host profile" ON public.host_profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- events
CREATE POLICY "Published events are public" ON public.events FOR SELECT USING (status = 'published' OR auth.uid() = host_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Hosts can insert events" ON public.events FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Hosts manage own events" ON public.events FOR UPDATE USING (auth.uid() = host_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Hosts delete own events" ON public.events FOR DELETE USING (auth.uid() = host_id OR public.has_role(auth.uid(),'admin'));

-- rsvps
CREATE POLICY "Users view own rsvps" ON public.rsvps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Hosts view event rsvps" ON public.rsvps FOR SELECT USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid()));
CREATE POLICY "Checkers/admins view rsvps" ON public.rsvps FOR SELECT USING (public.has_role(auth.uid(),'checker') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own rsvps" ON public.rsvps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own rsvps" ON public.rsvps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own rsvps" ON public.rsvps FOR DELETE USING (auth.uid() = user_id);

-- check_ins
CREATE POLICY "Hosts view event check_ins" ON public.check_ins FOR SELECT USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'checker'));
CREATE POLICY "Checkers create check_ins" ON public.check_ins FOR INSERT WITH CHECK (public.has_role(auth.uid(),'checker') OR public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid()));

-- gallery_items
CREATE POLICY "Approved gallery is public" ON public.gallery_items FOR SELECT USING (status = 'approved' OR auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users upload gallery" ON public.gallery_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Hosts/admins moderate gallery" ON public.gallery_items FOR UPDATE USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owner/host/admin delete gallery" ON public.gallery_items FOR DELETE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- reports
CREATE POLICY "Users view own reports" ON public.reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Admins view all reports" ON public.reports FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users create reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins manage reports" ON public.reports FOR UPDATE USING (public.has_role(auth.uid(),'admin'));

-- feedback
CREATE POLICY "Feedback viewable by event host and admin" ON public.feedback FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.host_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users submit feedback" ON public.feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own feedback" ON public.feedback FOR UPDATE USING (auth.uid() = user_id);
