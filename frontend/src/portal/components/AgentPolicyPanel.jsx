import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Save, RefreshCw, AlertTriangle, Check, Info, TrendingDown, LayoutPanelLeft } from 'lucide-react';

const POLICY_METRICS = [
    { key: 'max_daily_value', label: 'Max Daily Total Value', unit: 'Currency' },
    { key: 'max_single_value', label: 'Max Single Transaction Value', unit: 'Currency' },
    { key: 'max_daily_count', label: 'Max Requests per Day', unit: 'Count' },
    { key: 'max_expiry_extension_days', label: 'Max Expiry Extension', unit: 'Days' },
];

const SCOPE_GROUPS = [
    { 
        id: 'bonus:forfeit:pre-auth', 
        label: 'Bonus Forfeiture', 
        icon: TrendingDown,
        metrics: ['max_daily_value', 'max_single_value'] 
    },
    { 
        id: 'bonus:modify:pre-auth', 
        label: 'Bonus Modification', 
        icon: LayoutPanelLeft,
        metrics: ['max_expiry_extension_days'] 
    },
    { 
        id: 'player:restrict:pre-auth', 
        label: 'Player Restrictions', 
        icon: Shield,
        metrics: ['max_daily_count'] 
    },
    { 
        id: 'player:welfare:pre-auth', 
        label: 'Welfare Outreach', 
        icon: Info,
        metrics: ['max_daily_count'] 
    },
];

const AgentPolicyPanel = ({ token }) => {
    const [policies, setPolicies] = useState([]);
    const [violations, setViolations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editedPolicies, setEditedPolicies] = useState({});
    const [brandCurrency, setBrandCurrency] = useState('EUR');

    const fetchConfig = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            // Fetch current limits
            const res = await fetch('/api/v1/auth/agent-tokens', { // Reuse the auth check logic or create a proper policy endpoint
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // For PoC, we expect an endpoint like GET /api/v1/ops/policies
            // Since I haven't implemented it yet, I'll use a mock fetch that matches the DB schema I created
            const policyRes = await fetch('/api/v1/auth/agent-tokens?view=policies', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (policyRes.ok) {
                const data = await policyRes.json();
                setPolicies(data.policies || []);
                setViolations(data.violations || []);
                // Initialize edited state
                const initialEdited = {};
                data.policies?.forEach(p => {
                    initialEdited[`${p.scope_name}:${p.limit_key}`] = p.limit_value;
                });
                setEditedPolicies(initialEdited);
            }
        } catch (err) {
            console.error('[AFA Policy] Fetch failed', err);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const handleValueChange = (scope, key, value) => {
        setEditedPolicies(prev => ({
            ...prev,
            [`${scope}:${key}`]: value
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Simplified save: send all edited values
            const updates = Object.entries(editedPolicies).map(([composite, value]) => {
                const [scope_name, limit_key] = composite.split(':');
                return { scope_name, limit_key, limit_value: Number(value) };
            });

            const res = await fetch('/api/v1/auth/agent-tokens?update=policies', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ updates })
            });

            if (res.ok) {
                alert('AFA Policy Limits updated successfully.');
                fetchConfig();
            } else {
                alert('Failed to update policy limits.');
            }
        } catch (err) {
            alert('Error saving policy: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const getLimitValue = (scope, key) => {
        return editedPolicies[`${scope}:${key}`] ?? '';
    };

    return (
        <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ffa500' }}>
                    <Shield size={20} />
                    <h3 style={{ margin: 0 }}>T2 Pre-authorised Bounds</h3>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={fetchConfig} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.8rem' }}>
                        <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
                    </button>
                    <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px', fontSize: '0.8rem' }}>
                        {saving ? <RefreshCw size={14} className="spin" /> : <Save size={14} />} 
                        Save Limits
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {SCOPE_GROUPS.map(group => (
                    <div key={group.id} className="glass-panel" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', color: 'white' }}>
                            <group.icon size={18} style={{ color: '#00ccff' }} />
                            <h4 style={{ margin: 0 }}>{group.label}</h4>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {group.metrics.map(metricKey => {
                                const metricDef = POLICY_METRICS.find(m => m.key === metricKey);
                                return (
                                    <div key={metricKey}>
                                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {metricDef.label} {metricDef.unit === 'Currency' ? `(${brandCurrency})` : ''}
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input 
                                                type="number"
                                                value={getLimitValue(group.id, metricKey)}
                                                onChange={(e) => handleValueChange(group.id, metricKey, e.target.value)}
                                                style={{
                                                    width: '100%', padding: '10px 12px',
                                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '8px', color: '#00ff88', fontSize: '0.9rem',
                                                    fontFamily: 'monospace', fontWeight: 600
                                                }}
                                            />
                                            <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                {metricDef.unit === 'Currency' ? brandCurrency : 'qty'}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Violation Awareness */}
            <div className="glass-panel" style={{ padding: '20px', marginTop: '20px', borderLeft: '4px solid #ff4d4d', background: 'rgba(255,77,77,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: '#ff4d4d' }}>
                    <AlertTriangle size={18} />
                    <h4 style={{ margin: 0 }}>Recent Policy Violations</h4>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                    Actions attempted by agents that exceeded the thresholds defined above. Violations are automatically logged and result in a 403 response to the agent.
                </p>
                
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,77,77,0.2)' }}>
                                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)' }}>Timestamp</th>
                                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)' }}>Agent</th>
                                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)' }}>Scope</th>
                                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)' }}>Attempted</th>
                                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)' }}>Threshold</th>
                            </tr>
                        </thead>
                        <tbody>
                            {violations.length > 0 ? violations.map(v => (
                                <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,77,77,0.1)' }}>
                                    <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{new Date(v.occurred_at).toLocaleString()}</td>
                                    <td style={{ padding: '8px', color: '#a855f7', fontWeight: 600 }}>{v.agent_id}</td>
                                    <td style={{ padding: '8px', color: '#ffa500' }}>{v.action_type}</td>
                                    <td style={{ padding: '8px', color: '#ff4d4d' }}>{v.policy_reason || 'Threshold Exceeded'}</td>
                                    <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{v.policy_limit || 'N/A'}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No recent violations detected for this tenant.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style={{ marginTop: '20px', padding: '14px', borderRadius: '8px', background: 'rgba(0,204,255,0.05)', border: '1px dashed rgba(0,204,255,0.2)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <Info size={14} style={{ display: 'inline', marginRight: '6px', color: '#00ccff' }} />
                <strong>Note:</strong> T3 (Human-gated) actions do not have numeric bounds but always require manual approval in the Escalation Queue.
            </div>
        </div>
    );
};

export default AgentPolicyPanel;
