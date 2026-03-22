-- Migration to support user-facing SDK features: Favourites and Activity Tracking
-- This script creates the necessary tables for persistent player experience.

-- 1. User Favourites Table
CREATE TABLE IF NOT EXISTS public.user_favourites (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    game_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, game_id)
);

-- 2. User Activity Table (Recently Played, etc.)
CREATE TABLE IF NOT EXISTS public.user_activity (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    activity_type text NOT NULL, -- e.g., 'game_launch', 'login'
    game_id text,
    metadata jsonb DEFAULT '{}',
    timestamp timestamp with time zone DEFAULT now()
);

-- Enable RLS (Security Best Practice)
ALTER TABLE public.user_favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies should be added based on your specific security requirements.
-- For PoC, we assume the backend service key bypasses RLS or appropriate policies are set.
