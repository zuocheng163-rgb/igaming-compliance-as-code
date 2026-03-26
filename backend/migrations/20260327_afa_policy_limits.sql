-- Migration: F13-AFA Phase 2 — Policy Limits & Bounds
-- Created: 2026-03-27

-- 1. Create table for AFA-specific T2 policy limits
CREATE TABLE IF NOT EXISTS afa_policy_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id VARCHAR(255) NOT NULL REFERENCES tenant_configs(brand_id) ON DELETE CASCADE,
    scope_name VARCHAR(64) NOT NULL, -- e.g., 'bonus:forfeit:pre-auth'
    limit_key VARCHAR(64) NOT NULL,  -- e.g., 'max_daily_value', 'max_daily_count'
    limit_value NUMERIC NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255), -- Admin username/ID
    UNIQUE(brand_id, scope_name, limit_key)
);

-- Enable RLS
ALTER TABLE afa_policy_limits ENABLE ROW LEVEL SECURITY;

-- 2. Audit Trail for Policy Violations (Distinct from general audit log for fast lookup)
CREATE TABLE IF NOT EXISTS afa_policy_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id VARCHAR(255) NOT NULL REFERENCES tenant_configs(brand_id),
    agent_id VARCHAR(255) NOT NULL,
    scope_name VARCHAR(64) NOT NULL,
    limit_key VARCHAR(64) NOT NULL,
    attempted_value NUMERIC,
    limit_threshold NUMERIC,
    request_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Default Policy Limits for Brand 1 (NeoStrike Demo)
INSERT INTO afa_policy_limits (brand_id, scope_name, limit_key, limit_value, updated_by)
VALUES 
    ('1', 'bonus:forfeit:pre-auth', 'max_daily_value', 5000, 'SYSTEM'),
    ('1', 'bonus:forfeit:pre-auth', 'max_single_value', 1000, 'SYSTEM'),
    ('1', 'bonus:modify:pre-auth', 'max_expiry_extension_days', 30, 'SYSTEM'),
    ('1', 'player:restrict:pre-auth', 'max_daily_count', 50, 'SYSTEM'),
    ('1', 'player:welfare:pre-auth', 'max_daily_count', 200, 'SYSTEM')
ON CONFLICT (brand_id, scope_name, limit_key) DO NOTHING;

-- Grant access (assuming standard backend role)
GRANT ALL ON TABLE afa_policy_limits TO postgres;
GRANT ALL ON TABLE afa_policy_violations TO postgres;
