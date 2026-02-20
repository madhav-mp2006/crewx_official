
-- CrewX Database Schema Setup
-- Run this in the Supabase SQL Editor

-- 1. Workers table (Master User Accounts)
CREATE TABLE IF NOT EXISTS public.workers (
    id UUID PRIMARY KEY, 
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT, -- Optional for admin-created accounts
    role TEXT DEFAULT 'WORKER' CHECK (role IN ('ADMIN', 'WORKER')),
    balance DECIMAL(12, 2) DEFAULT 0.00,
    qr_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Employee Details table (Extended Worker Profiles)
-- This table is connected to workers via user_id
CREATE TABLE IF NOT EXISTS public.employee_details (
    user_id UUID PRIMARY KEY REFERENCES public.workers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    age INTEGER NOT NULL,
    experience_works INTEGER DEFAULT 0,
    place TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Jobs table (Event listings)
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    date DATE NOT NULL,
    time TEXT NOT NULL,
    location TEXT NOT NULL,
    pay DECIMAL(12, 2) NOT NULL,
    max_workers INTEGER NOT NULL,
    enrolled_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'COMPLETED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enrollments table (Connected to workers)
CREATE TABLE IF NOT EXISTS public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, job_id)
);

-- 5. Withdrawals table
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default Admin Account in admin_auth (External to workers table for security)
CREATE TABLE IF NOT EXISTS public.admin_auth (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
);

INSERT INTO public.admin_auth (email, password)
VALUES ('admin@crewx.com', 'admin123')
ON CONFLICT (email) DO NOTHING;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.workers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_details;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.enrollments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawals;

-- RLS Policies
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON public.workers FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.employee_details FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.jobs FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.enrollments FOR ALL USING (true);
CREATE POLICY "Allow all access" ON public.withdrawals FOR ALL USING (true);
