'use strict';
/**
 * AFA Audit Service
 *
 * Agent-specific audit logging for the F13-AFA layer.
 * Writes to `agent_audit_log` table (append-only, 7-year retention).
 *
 * Provides:
 *   - logAgentAction() — record any agent operation
 *   - getAgentActions() — paginated query with cursor support
 *   - getActionDetail() — single record lookup
 *   - getPendingApprovals() — T3 queue (Phase 3)
 *   - getPolicyLog() — token lifecycle events
 */

const { logger } = require('./logger');

class AfaAuditService {
    constructor(supabaseService) {
        this.db = supabaseService;
    }

    /**
     * Log an agent action to the audit trail.
     *
     * @param {object} params
     * @param {string} params.tenantId
     * @param {string} params.agentId
     * @param {string} params.eventType   e.g. T1_READ, T2_ACTION, T3_PROPOSED, SCOPE_VIOLATION
     * @param {string} [params.actionType] endpoint or action name
     * @param {string} [params.targetEntity] player_id, alert_id, etc.
     * @param {string} [params.policyReason]
     * @param {string} [params.agentNote]
     * @param {object} [params.executionResult]
     * @param {string[]} [params.policyScope]
     * @param {number} [params.httpStatus]
     * @param {number} [params.processingMs]
     * @param {string} [params.requestId]
     */
    async logAgentAction({
        tenantId, agentId, eventType,
        actionType = null, targetEntity = null,
        policyReason = null, agentNote = null,
        executionResult = null, policyScope = [],
        httpStatus = null, processingMs = null,
        requestId = null,
    }) {
        try {
            if (!this.db.client) return;

            const { error } = await this.db.client.from('agent_audit_log').insert({
                tenant_id: String(tenantId),
                agent_id: agentId,
                event_type: eventType,
                action_type: actionType,
                target_entity: targetEntity,
                policy_reason: policyReason,
                agent_note: agentNote,
                execution_result: executionResult || {},
                policy_scope: policyScope,
                http_status: httpStatus,
                processing_ms: processingMs,
                request_id: requestId || require('crypto').randomUUID(),
            });

            if (error) {
                logger.error('[AFA Audit] Failed to write audit log', { error: error.message, eventType });
            }
        } catch (e) {
            logger.error('[AFA Audit] Unexpected error logging action', { error: e.message });
        }
    }

    /**
     * Query agent actions with cursor-based pagination.
     *
     * @param {string} tenantId
     * @param {object} filters  { agent_id, action_type, event_type, since, until }
     * @param {string} [cursor] UUID of last item from previous page
     * @param {number} [limit=50]
     */
    async getAgentActions(tenantId, filters = {}, cursor = null, limit = 50) {
        if (!this.db.client) return { actions: [], next_cursor: null };

        let query = this.db.client
            .from('agent_audit_log')
            .select('*')
            .eq('tenant_id', String(tenantId))
            .order('occurred_at', { ascending: false })
            .limit(limit + 1); // fetch one extra to determine next_cursor

        if (filters.agent_id) query = query.eq('agent_id', filters.agent_id);
        if (filters.action_type) query = query.eq('action_type', filters.action_type);
        if (filters.event_type) query = query.eq('event_type', filters.event_type);
        if (filters.since) query = query.gte('occurred_at', filters.since);
        if (filters.until) query = query.lte('occurred_at', filters.until);

        if (cursor) {
            // Cursor is the `occurred_at` of the last item from previous page
            query = query.lt('occurred_at', cursor);
        }

        const { data, error } = await query;
        if (error) {
            logger.error('[AFA Audit] Query failed', { error: error.message });
            return { actions: [], next_cursor: null };
        }

        const actions = data || [];
        let nextCursor = null;

        if (actions.length > limit) {
            // There's a next page
            actions.pop(); // remove the extra item
            nextCursor = actions[actions.length - 1]?.occurred_at || null;
        }

        return { actions, next_cursor: nextCursor, total_in_page: actions.length };
    }

    /**
     * Get full detail of a single agent action.
     */
    async getActionDetail(actionId) {
        if (!this.db.client) return null;

        const { data, error } = await this.db.client
            .from('agent_audit_log')
            .select('*')
            .eq('id', actionId)
            .maybeSingle();

        if (error) {
            logger.error('[AFA Audit] Detail query failed', { error: error.message });
            return null;
        }
        return data;
    }

    /**
     * Get pending T3 approvals for a tenant.
     */
    async getPendingApprovals(tenantId) {
        if (!this.db.client) return [];

        const { data, error } = await this.db.client
            .from('pending_approvals')
            .select('*')
            .eq('tenant_id', String(tenantId))
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('[AFA Audit] Pending approvals query failed', { error: error.message });
            return [];
        }
        return data || [];
    }

    /**
     * Get token lifecycle events (policy log).
     */
    async getPolicyLog(tenantId, limit = 100) {
        if (!this.db.client) return [];

        const { data, error } = await this.db.client
            .from('agent_audit_log')
            .select('*')
            .eq('tenant_id', String(tenantId))
            .in('event_type', ['TOKEN_ISSUED', 'TOKEN_REVOKED', 'SCOPE_VIOLATION'])
            .order('occurred_at', { ascending: false })
            .limit(limit);

        if (error) {
            logger.error('[AFA Audit] Policy log query failed', { error: error.message });
            return [];
        }
        return data || [];
    }

    /**
     * Get aggregated statistics for agent operations.
     */
    async getAgentStats(tenantId, days = 30) {
        if (!this.db.client) return null;

        const since = new Date();
        since.setDate(since.getDate() - days);

        // This is a simplified aggregation for PoC. 
        // In a real system, we'd use a more efficient SQL group-by or a rollup table.
        const { data, error } = await this.db.client
            .rpc('get_afa_stats', { p_tenant_id: String(tenantId), p_days: days });

        if (error) {
            // Fallback for when RPC doesn't exist yet
            logger.warn('[AFA Audit] get_afa_stats RPC not found, using fallback query');
            const { data: rawData, error: rawError } = await this.db.client
                .from('agent_audit_log')
                .select('event_type, http_status')
                .eq('tenant_id', String(tenantId))
                .gt('occurred_at', since.toISOString());

            if (rawError) throw rawError;

            const stats = {
                total: rawData.length,
                success: rawData.filter(d => d.http_status >= 200 && d.http_status < 300).length,
                failed: rawData.filter(d => d.http_status >= 400).length,
                violations: rawData.filter(d => d.event_type === 'SCOPE_VIOLATION' || d.event_type === 'POLICY_VIOLATION').length,
                t1: rawData.filter(d => d.event_type === 'T1_READ').length,
                t2: rawData.filter(d => d.event_type === 'T2_ACTION').length,
                t3: rawData.filter(d => d.event_type === 'T3_PROPOSED').length,
            };
            return stats;
        }

        return data;
    }

    /**
     * Get daily activity timeline for the dashboard.
     */
    async getAgentActivityTimeline(tenantId, days = 30) {
        if (!this.db.client) return [];

        const since = new Date();
        since.setDate(since.getDate() - days);

        // Fallback aggregation logic
        const { data: rawData, error: rawError } = await this.db.client
            .from('agent_audit_log')
            .select('occurred_at')
            .eq('tenant_id', String(tenantId))
            .gt('occurred_at', since.toISOString())
            .order('occurred_at', { ascending: true });

        if (rawError) throw rawError;

        // Group by day
        const timeline = {};
        rawData.forEach(d => {
            const day = d.occurred_at.split('T')[0];
            timeline[day] = (timeline[day] || 0) + 1;
        });

        return Object.entries(timeline).map(([date, count]) => ({ date, count }));
    }
}

module.exports = AfaAuditService;
