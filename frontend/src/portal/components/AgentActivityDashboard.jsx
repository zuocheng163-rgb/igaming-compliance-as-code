import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Shield, AlertTriangle, CheckCircle, TrendingUp, Users, Cpu, Ban } from 'lucide-react';

const AgentActivityDashboard = ({ token }) => {
    const [stats, setStats] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await fetch('/api/v1/auth/agent-tokens?view=stats', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data.stats);
                setTimeline(data.timeline || []);
            }
        } catch (err) {
            console.error('[AFA Dashboard] Fetch failed', err);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    if (loading && !stats) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading Analytics...</div>;

    const totalRequests = stats?.total || 0;
    const errorRate = totalRequests > 0 ? ((stats.failed / totalRequests) * 100).toFixed(1) : 0;
    const violationRate = totalRequests > 0 ? ((stats.violations / totalRequests) * 100).toFixed(1) : 0;

    return (
        <div style={{ marginTop: '20px' }}>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#00ccff', marginBottom: '8px' }}>
                        <Activity size={18} />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Daily Volume</span>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'white' }}>{totalRequests}</div>
                    <div style={{ fontSize: '0.7rem', color: '#00ccff', marginTop: '4px' }}>+12% from yesterday</div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#00ff88', marginBottom: '8px' }}>
                        <CheckCircle size={18} />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Success Rate</span>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'white' }}>{100 - errorRate}%</div>
                    <div style={{ fontSize: '0.7rem', color: '#00ff88', marginTop: '4px' }}>Steady avg</div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ff4d4d', marginBottom: '8px' }}>
                        <AlertTriangle size={18} />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Violations</span>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'white' }}>{stats?.violations || 0}</div>
                    <div style={{ fontSize: '0.7rem', color: '#ff4d4d', marginTop: '4px' }}>{violationRate}% of traffic</div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a855f7', marginBottom: '8px' }}>
                        <Shield size={18} />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>T2/T3 Ratio</span>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'white' }}>{stats ? (stats.t2 + stats.t3) : 0}</div>
                    <div style={{ fontSize: '0.7rem', color: '#a855f7', marginTop: '4px' }}>Operational actions</div>
                </div>
            </div>

            {/* Main Dashboard Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                {/* Usage Timeline Chart */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: 'white' }}>
                            <TrendingUp size={18} style={{ color: '#00ccff' }} /> Usage Timeline (30d)
                        </h4>
                    </div>
                    
                    <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', gap: '4px', paddingBottom: '20px', position: 'relative' }}>
                        {/* Grid Lines */}
                        <div style={{ position: 'absolute', width: '100%', height: '1px', background: 'rgba(255,255,255,0.05)', top: '0%' }} />
                        <div style={{ position: 'absolute', width: '100%', height: '1px', background: 'rgba(255,255,255,0.05)', top: '50%' }} />
                        
                        {timeline.length > 0 ? timeline.map((d, i) => {
                            const maxVal = Math.max(...timeline.map(x => x.count), 1);
                            const height = (d.count / maxVal) * 100;
                            return (
                                <div key={d.date} style={{ flex: 1, minWidth: '4px', position: 'relative' }}>
                                    <div 
                                        className="chart-bar"
                                        style={{ 
                                            height: `${height}%`, 
                                            background: 'linear-gradient(to top, rgba(0,204,255,0.1), #00ccff)',
                                            borderRadius: '2px 2px 0 0',
                                            transition: 'height 0.5s ease-out'
                                        }}
                                        title={`${d.date}: ${d.count} requests`}
                                    />
                                </div>
                            );
                        }) : (
                            <div style={{ width: '100%', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Insufficient data for timeline</div>
                        )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        <span>30 days ago</span>
                        <span>Today</span>
                    </div>
                </div>

                {/* Tier Distribution */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                    <h4 style={{ margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'white' }}>
                        <Shield size={18} style={{ color: '#a855f7' }} /> Tier Distribution
                    </h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {[
                            { label: 'T1 - Observe', count: stats?.t1 || 0, color: '#00ccff' },
                            { label: 'T2 - Pre-auth', count: stats?.t2 || 0, color: '#ffa500' },
                            { label: 'T3 - Escalated', count: stats?.t3 || 0, color: '#ff4d4d' },
                        ].map(tier => {
                            const percentage = totalRequests > 0 ? (tier.count / totalRequests) * 100 : 0;
                            return (
                                <div key={tier.label}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>{tier.label}</span>
                                        <span style={{ color: 'white', fontWeight: 600 }}>{tier.count}</span>
                                    </div>
                                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>
                                        <div style={{ width: `${percentage}%`, height: '100%', background: tier.color, borderRadius: '3px', transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ marginTop: '24px', padding: '16px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px' }}>SYSTEM HEALTH</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                            <Cpu size={14} style={{ color: '#00ff88' }} />
                            <span style={{ color: 'white' }}>Event Fan-out: <strong>Active</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', marginTop: '8px' }}>
                            <Users size={14} style={{ color: '#00ff88' }} />
                            <span style={{ color: 'white' }}>Simultaneous Agents: <strong>4</strong></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgentActivityDashboard;
