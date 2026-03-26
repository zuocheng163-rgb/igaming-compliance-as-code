'use strict';
/**
 * AFA Alerts Service
 *
 * Provides the Alerts API data layer (PRD Section 6.2):
 *   - Paginated alert list with cursor support
 *   - Alert detail with risk score and signal components
 *   - HATEOAS _links for analysis
 *   - Alert status updates (T2)
 */

const { logger } = require('./logger');

class AfaAlertsService {
    constructor(supabaseService) {
        this.db = supabaseService;
    }

    /**
     * GET /v1/ops/alerts
     * Paginated alert list with filters and cursor-based pagination.
     */
    async listAlerts(tenantId, {
        status, category, risk_band, player_id, since,
        limit = 20, cursor = null,
    } = {}) {
        if (!this.db.client) return { alerts: [], next_cursor: null };

        let query = this.db.client
            .from('platform_audit_logs')
            .select('*')
            .eq('brand_id', tenantId)
            .in('level', ['warn', 'error', 'critical'])
            .order('timestamp', { ascending: false })
            .limit(limit + 1);

        // Apply filters
        if (status === 'open') {
            query = query.or('status.eq.open,status.is.null');
        } else if (status) {
            query = query.eq('status', status);
        }

        if (player_id) query = query.eq('actor_id', player_id);
        if (since) query = query.gte('timestamp', since);

        if (cursor) {
            query = query.lt('timestamp', cursor);
        }

        // Category filter on action type
        if (category) {
            query = query.ilike('action', `%${category}%`);
        }

        const { data, error } = await query;
        if (error) {
            logger.error('[AFA Alerts] List query failed', { error: error.message });
            return { alerts: [], next_cursor: null };
        }

        const rawAlerts = data || [];
        let nextCursor = null;

        if (rawAlerts.length > limit) {
            rawAlerts.pop();
            nextCursor = rawAlerts[rawAlerts.length - 1]?.timestamp || null;
        }

        // Enrich alerts with risk scores
        const playerIds = [...new Set(rawAlerts.map(a => a.actor_id).filter(Boolean))];
        const riskScores = await this._fetchRiskScores(tenantId, playerIds);

        // Transform to AFA response format
        const alerts = rawAlerts.map(log => {
            const riskData = riskScores[log.actor_id] || {};
            return {
                id: log.id,
                player_id: log.actor_id || null,
                alert_type: log.action,
                composite_risk_score: riskData.composite_score || 0,
                triggered_signals: this._extractSignals(log, riskData),
                status: log.status || 'open',
                severity: log.level === 'critical' ? 'critical' : log.level === 'error' ? 'high' : 'medium',
                created_at: log.timestamp,
                message: log.message,
                metadata: log.metadata || {},
                _links: {
                    self: { href: `/v1/ops/alerts/${log.id}` },
                    player: log.actor_id ? { href: `/v1/ops/metrics/players?player_id=${log.actor_id}` } : null,
                },
            };
        });

        return {
            alerts,
            next_cursor: nextCursor,
            total_in_page: alerts.length,
        };
    }

    /**
     * GET /v1/ops/alerts/:id
     * Full alert detail including signal components and timeline.
     */
    async getAlertDetail(alertId, tenantId) {
        if (!this.db.client) return null;

        const { data: log, error } = await this.db.client
            .from('platform_audit_logs')
            .select('*')
            .eq('id', alertId)
            .eq('brand_id', tenantId)
            .maybeSingle();

        if (error || !log) return null;

        // Fetch risk score for player
        let riskData = {};
        if (log.actor_id) {
            const scores = await this._fetchRiskScores(tenantId, [log.actor_id]);
            riskData = scores[log.actor_id] || {};
        }

        // Fetch related audit events for this player (timeline)
        let timeline = [];
        if (log.actor_id) {
            const { data: events } = await this.db.client
                .from('platform_audit_logs')
                .select('id, action, level, message, timestamp')
                .eq('actor_id', log.actor_id)
                .eq('brand_id', tenantId)
                .order('timestamp', { ascending: false })
                .limit(20);
            timeline = events || [];
        }

        return {
            id: log.id,
            player_id: log.actor_id || null,
            alert_type: log.action,
            composite_risk_score: riskData.composite_score || 0,
            score_breakdown: riskData.score_breakdown || {},
            triggered_signals: this._extractSignals(log, riskData),
            status: log.status || 'open',
            severity: log.level === 'critical' ? 'critical' : log.level === 'error' ? 'high' : 'medium',
            created_at: log.timestamp,
            message: log.message,
            metadata: log.metadata || {},
            timeline,
            _links: {
                self: { href: `/v1/ops/alerts/${log.id}` },
                player: log.actor_id ? { href: `/v1/ops/metrics/players?player_id=${log.actor_id}` } : null,
            },
        };
    }

    /**
     * PATCH /v1/ops/alerts/:id/status
     * Mark alert as acknowledged or resolved (T2 scope required).
     */
    async updateAlertStatus(alertId, tenantId, { status, agent_note }, agentId) {
        if (!this.db.client) throw new Error('Database not available');

        const validStatuses = ['acknowledged', 'resolved', 'escalated'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
        }

        // Update the alert status
        const { data, error } = await this.db.client
            .from('platform_audit_logs')
            .update({
                status,
                metadata: this.db.client.rpc ? undefined : undefined, // preserve existing metadata
            })
            .eq('id', alertId)
            .eq('brand_id', tenantId)
            .select()
            .single();

        if (error) {
            logger.error('[AFA Alerts] Status update failed', { error: error.message, alertId });
            throw new Error('Failed to update alert status');
        }

        return {
            id: alertId,
            status,
            updated_by: agentId,
            agent_note: agent_note || null,
            updated_at: new Date().toISOString(),
        };
    }

    /**
     * Fetch risk scores for a batch of player IDs.
     */
    async _fetchRiskScores(tenantId, playerIds) {
        if (!this.db.client || playerIds.length === 0) return {};

        const { data, error } = await this.db.client
            .from('rg_player_metrics')
            .select('player_id, composite_score, score_breakdown, net_loss_tier, monitoring_active')
            .eq('tenant_id', tenantId)
            .in('player_id', playerIds);

        if (error || !data) return {};

        return data.reduce((acc, m) => {
            acc[m.player_id] = m;
            return acc;
        }, {});
    }

    /**
     * Extract triggered signals from log + risk data.
     */
    _extractSignals(log, riskData) {
        const signals = [];

        // From risk score breakdown
        if (riskData.score_breakdown) {
            const bd = riskData.score_breakdown;
            if (bd.net_loss_tier > 0) signals.push('net_loss_threshold');
            if (bd.return_pattern > 0) signals.push('rapid_return');
            if (bd.baseline_deviation > 0) signals.push('baseline_deviation');
            if (bd.chasing_losses > 0) signals.push('chasing_losses');
            if (bd.late_night > 0) signals.push('late_night_activity');
            if (bd.prolonged_session > 0) signals.push('prolonged_session');
        }

        // From log action type
        if (log.action?.includes('velocity')) signals.push('velocity_spike');
        if (log.action?.includes('affordability')) signals.push('affordability_threshold');

        return signals;
    }
}

module.exports = AfaAlertsService;
