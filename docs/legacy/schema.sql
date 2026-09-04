--
-- PostgreSQL database dump
--

\restrict yHqoTubEbUT2fTdCSCixbmZrbLhC8UOul0mo7Q4HSMjJJMSscr3NtaqIYpf8MWO

-- Dumped from database version 18.6 (Debian 18.6-1.pgdg13+2)
-- Dumped by pg_dump version 18.6 (Debian 18.6-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: authenticate_rotaract_user(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.authenticate_rotaract_user(p_identity text, p_password text) RETURNS TABLE(id uuid, rotary_id text, email text, role text, full_name text, club_name text, post text, totp_secret text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  clean_id TEXT := LOWER(TRIM(p_identity));
  clean_pass TEXT := TRIM(p_password);
BEGIN
  RETURN QUERY
  SELECT 
    up.id,
    up.rotary_id,
    up.email,
    up.role,
    up.full_name,
    up.club_name,
    up.post,
    up.totp_secret
  FROM public.user_profiles up
  WHERE (
    LOWER(TRIM(up.email)) = clean_id OR 
    LOWER(TRIM(up.rotary_id)) = clean_id
  )
  AND (
    up.password = extensions.crypt(clean_pass, up.password)
    OR up.password = clean_pass
  )
  LIMIT 1;
END;
$$;


--
-- Name: get_audience_emails(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_audience_emails(p_audience text) RETURNS TABLE(email text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  clean_aud TEXT := LOWER(TRIM(p_audience));
BEGIN
  IF clean_aud = 'test_group' THEN
    RETURN QUERY
    SELECT DISTINCT up.email 
    FROM public.user_profiles up 
    WHERE up.is_test_group = true AND up.email IS NOT NULL AND up.email <> '';
  ELSIF clean_aud = 'presidents' THEN
    RETURN QUERY
    SELECT DISTINCT up.email 
    FROM public.user_profiles up 
    WHERE LOWER(TRIM(up.role)) = 'president' AND up.email IS NOT NULL AND up.email <> '';
  ELSIF clean_aud = 'secretaries' THEN
    RETURN QUERY
    SELECT DISTINCT up.email 
    FROM public.user_profiles up 
    WHERE (LOWER(TRIM(up.role)) = 'secretary' OR LOWER(up.post) LIKE '%secretary%') 
      AND up.email IS NOT NULL AND up.email <> '';
  ELSIF clean_aud = 'dac' THEN
    RETURN QUERY
    SELECT DISTINCT up.email 
    FROM public.user_profiles up 
    WHERE LOWER(TRIM(up.role)) = 'dac_member' AND up.email IS NOT NULL AND up.email <> '';
  ELSE
    -- 'all'
    RETURN QUERY
    SELECT DISTINCT up.email 
    FROM public.user_profiles up 
    WHERE up.email IS NOT NULL AND up.email <> '';
  END IF;
END;
$$;


--
-- Name: initiate_server_password_reset(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initiate_server_password_reset(p_identity text) RETURNS TABLE(success boolean, email text, full_name text, rotary_id text, reset_code text, error text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  clean_id TEXT := LOWER(TRIM(p_identity));
  found_user RECORD;
  generated_code TEXT;
BEGIN
  SELECT up.id, up.email, up.full_name, up.rotary_id INTO found_user
  FROM public.user_profiles up
  WHERE LOWER(TRIM(up.email)) = clean_id OR LOWER(TRIM(up.rotary_id)) = clean_id
  LIMIT 1;

  IF found_user.id IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, 'No registered officer found with that Rotary ID or Email.'::TEXT;
    RETURN;
  END IF;

  -- Generate 6-digit passcode
  generated_code := LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');

  -- Store passcode with 15-minute expiration
  UPDATE public.user_profiles
  SET 
    reset_token = generated_code,
    reset_token_expires_at = now() + INTERVAL '15 minutes'
  WHERE id = found_user.id;

  RETURN QUERY SELECT true, found_user.email, found_user.full_name, found_user.rotary_id, generated_code, NULL::TEXT;
END;
$$;


--
-- Name: request_password_reset(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_password_reset(p_identity text) RETURNS TABLE(success boolean, email text, full_name text, rotary_id text, reset_code text, error text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ BEGIN RETURN QUERY SELECT * FROM public.initiate_server_password_reset(p_identity); END; $$;


--
-- Name: reset_user_password(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_user_password(p_identity text, p_code text, p_new_password text) RETURNS TABLE(success boolean, error text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  clean_id TEXT := LOWER(TRIM(p_identity));
  clean_code TEXT := TRIM(p_code);
  clean_pass TEXT := TRIM(p_new_password);
  found_user RECORD;
BEGIN
  IF LENGTH(clean_pass) < 6 THEN
    RETURN QUERY SELECT false, 'Password must be at least 6 characters long.'::TEXT;
    RETURN;
  END IF;

  SELECT up.id INTO found_user
  FROM public.user_profiles up
  WHERE (LOWER(TRIM(up.email)) = clean_id OR LOWER(TRIM(up.rotary_id)) = clean_id)
    AND up.reset_token = clean_code
    AND up.reset_token_expires_at > now()
  LIMIT 1;

  IF found_user.id IS NULL THEN
    RETURN QUERY SELECT false, 'Invalid or expired 6-digit passcode. Please request a new one.'::TEXT;
    RETURN;
  END IF;

  -- Hash new password securely with pgcrypto extensions.crypt
  UPDATE public.user_profiles
  SET 
    password = extensions.crypt(clean_pass, extensions.gen_salt('bf', 8)),
    reset_token = NULL,
    reset_token_expires_at = NULL
  WHERE id = found_user.id;

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;


--
-- Name: set_user_totp_secret(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_totp_secret(p_user_id uuid, p_secret text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE user_profiles SET totp_secret = p_secret WHERE id = p_user_id;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    category text,
    content text NOT NULL,
    author_name text DEFAULT 'District Secretariat'::text,
    sent_via_email boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    target_audience text DEFAULT 'all'::text
);


--
-- Name: clubs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clubs (
    id text NOT NULL,
    name text NOT NULL,
    short_name text,
    zone text,
    lat double precision,
    lng double precision,
    president text,
    is_director text DEFAULT ''::text,
    phone text,
    email text,
    rotary_id text,
    secretary text,
    secretary_email text,
    secretary_phone text,
    initiatives jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: monthly_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    month text NOT NULL,
    club_name text NOT NULL,
    club_email text NOT NULL,
    submitted_by text NOT NULL,
    status text DEFAULT 'reported'::text,
    flag_comment text,
    sections_json jsonb NOT NULL,
    submitted_at timestamp with time zone DEFAULT now(),
    flag_reason text,
    flagged_by text,
    flagged_at timestamp with time zone,
    section_flags jsonb DEFAULT '{}'::jsonb
);


--
-- Name: project_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid,
    club_name text NOT NULL,
    club_email text,
    submitted_by text,
    title text NOT NULL,
    category text NOT NULL,
    description text,
    budget text,
    beneficiaries text,
    proof_url text,
    status text DEFAULT 'reported'::text,
    flag_comment text,
    submitted_at timestamp with time zone DEFAULT now(),
    CONSTRAINT project_submissions_status_check CHECK ((status = ANY (ARRAY['reported'::text, 'flagged'::text])))
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rotary_id text,
    full_name text NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'president'::text NOT NULL,
    post text DEFAULT 'Club President'::text,
    club_name text DEFAULT 'District 3011'::text,
    phone text,
    password text NOT NULL,
    totp_secret text,
    created_at timestamp with time zone DEFAULT now(),
    reset_token text,
    reset_token_expires_at timestamp with time zone,
    is_test_group boolean DEFAULT false,
    CONSTRAINT user_profiles_role_check CHECK ((role = ANY (ARRAY['officer'::text, 'president'::text, 'secretary'::text, 'dac_member'::text])))
);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: clubs clubs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_pkey PRIMARY KEY (id);


--
-- Name: monthly_reports monthly_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_reports
    ADD CONSTRAINT monthly_reports_pkey PRIMARY KEY (id);


--
-- Name: project_submissions project_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_submissions
    ADD CONSTRAINT project_submissions_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: idx_announcements_audience; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_audience ON public.announcements USING btree (target_audience);


--
-- Name: idx_announcements_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_created_at ON public.announcements USING btree (created_at DESC);


--
-- Name: idx_clubs_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clubs_email ON public.clubs USING btree (email);


--
-- Name: idx_clubs_rotary_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clubs_rotary_id ON public.clubs USING btree (rotary_id);


--
-- Name: idx_clubs_zone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clubs_zone ON public.clubs USING btree (zone);


--
-- Name: idx_monthly_reports_club_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_monthly_reports_club_month ON public.monthly_reports USING btree (club_email, month);


--
-- Name: idx_monthly_reports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_monthly_reports_status ON public.monthly_reports USING btree (status);


--
-- Name: idx_monthly_reports_submitted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_monthly_reports_submitted_at ON public.monthly_reports USING btree (submitted_at DESC);


--
-- Name: idx_project_submissions_club_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_submissions_club_email ON public.project_submissions USING btree (club_email);


--
-- Name: idx_project_submissions_submitted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_submissions_submitted_at ON public.project_submissions USING btree (submitted_at DESC);


--
-- Name: idx_user_profiles_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_email ON public.user_profiles USING btree (lower(email));


--
-- Name: idx_user_profiles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_role ON public.user_profiles USING btree (role);


--
-- Name: idx_user_profiles_rotary_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_profiles_rotary_id ON public.user_profiles USING btree (rotary_id);


--
-- Name: monthly_reports Allow authenticated insert monthly_reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated insert monthly_reports" ON public.monthly_reports FOR INSERT WITH CHECK (true);


--
-- Name: monthly_reports Allow delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow delete" ON public.monthly_reports FOR DELETE USING (true);


--
-- Name: monthly_reports Allow insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert" ON public.monthly_reports FOR INSERT WITH CHECK (true);


--
-- Name: announcements Allow public all on announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public all on announcements" ON public.announcements USING (true);


--
-- Name: project_submissions Allow public all on project_submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public all on project_submissions" ON public.project_submissions USING (true);


--
-- Name: user_profiles Allow public read access to user_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to user_profiles" ON public.user_profiles FOR SELECT USING (true);


--
-- Name: monthly_reports Allow public read monthly_reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read monthly_reports" ON public.monthly_reports FOR SELECT USING (true);


--
-- Name: monthly_reports Allow select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow select" ON public.monthly_reports FOR SELECT USING (true);


--
-- Name: monthly_reports Allow update monthly_reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow update monthly_reports" ON public.monthly_reports FOR UPDATE USING (true);


--
-- Name: monthly_reports Allow update own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow update own" ON public.monthly_reports FOR UPDATE USING (true);


--
-- Name: user_profiles Deny direct anon access to user_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny direct anon access to user_profiles" ON public.user_profiles FOR SELECT USING (false);


--
-- Name: monthly_reports Public Insert Monthly Reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public Insert Monthly Reports" ON public.monthly_reports FOR INSERT WITH CHECK (true);


--
-- Name: user_profiles Public Insert user_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public Insert user_profiles" ON public.user_profiles FOR INSERT WITH CHECK (true);


--
-- Name: announcements Public Read Announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public Read Announcements" ON public.announcements FOR SELECT USING (true);


--
-- Name: monthly_reports Public Read Monthly Reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public Read Monthly Reports" ON public.monthly_reports FOR SELECT USING (true);


--
-- Name: user_profiles Public Read user_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public Read user_profiles" ON public.user_profiles FOR SELECT USING (true);


--
-- Name: monthly_reports Public Update Monthly Reports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public Update Monthly Reports" ON public.monthly_reports FOR UPDATE USING (true);


--
-- Name: user_profiles Public Update user_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public Update user_profiles" ON public.user_profiles FOR UPDATE USING (true);


--
-- Name: announcements Public announcements read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public announcements read" ON public.announcements FOR SELECT USING (true);


--
-- Name: monthly_reports Public monthly_reports insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public monthly_reports insert" ON public.monthly_reports FOR INSERT WITH CHECK (true);


--
-- Name: monthly_reports Public monthly_reports select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public monthly_reports select" ON public.monthly_reports FOR SELECT USING (true);


--
-- Name: monthly_reports Public monthly_reports update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public monthly_reports update" ON public.monthly_reports FOR UPDATE USING (true);


--
-- Name: announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: clubs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

--
-- Name: clubs clubs_read_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clubs_read_policy ON public.clubs FOR SELECT USING (true);


--
-- Name: clubs clubs_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clubs_update_policy ON public.clubs FOR UPDATE USING (true);


--
-- Name: monthly_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: project_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict yHqoTubEbUT2fTdCSCixbmZrbLhC8UOul0mo7Q4HSMjJJMSscr3NtaqIYpf8MWO

