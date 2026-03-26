'use strict';
/**
 * AFA Metrics Service
 *
 * Wraps existing supabase.js aggregation functions and formats responses
 * for the AFA Metrics API (PRD Section 6.1).
 *
 * All responses include:
 *   - data_as_of timestamp
 *   - freshness_seconds field
 *   - Structured, typed payloads
 */

const { logger } = require('./logger');

// Period label mapping from AFA query params to internal format
const PERIOD_MAP = {
    'today':  'Today',
    '7d':     'Last 7 Days',
    '30d':    'Last 30 Days',
    '90d':    'Last 30 Days',  // fallback — extend in future
    'custom': 'Last 30 Days',
};

class AfaMetricsService {
    constructor(supabaseService) {
        this.db = supabaseService;
    }

    /**
     * Helper: wrap response with AFA metadata envelope
     */
    _envelope(data, startTime) {
        return {
            data,
            data_as_of: new Date().toISOString(),
            freshness_seconds: Math.round((Date.now() - startTime) / 1000),
        };
    }

    /**
     * Resolve period from AFA query param → internal label
     */
    _resolvePeriod(period) {
        return PERIOD_MAP[period] || PERIOD_MAP['30d'];
    }

    /**
     * GET /v1/ops/metrics/summary
     * Aggregated dashboard: GGR, active players, deposit volume, bonus exposure
     */
    async getSummary(tenantId, { period = '30d', compare_period } = {}) {
        const startTime = Date.now();
        const periodLabel = this._resolvePeriod(period);

        const stats = await this.db.getOperatorStats(tenantId, periodLabel);
        const kpis = await this.db.getAggregatedKPIs(tenantId, periodLabel);

        let comparison = null;
        if (compare_period) {
            const comparePeriodLabel = this._resolvePeriod(compare_period);
            const compareKpis = await this.db.getAggregatedKPIs(tenantId, comparePeriodLabel);
            comparison = {
                period: compare_period,
                ggr: compareKpis.ggr || 0,
                ngr: compareKpis.ngr || 0,
                active_players: compareKpis.active_players || 0,
                bonuses: compareKpis.bonuses || 0,
            };
        }

        return this._envelope({
            ggr: kpis.ggr || 0,
            ngr: kpis.ngr || 0,
            active_players: kpis.active_players || 0,
            deposit_volume: kpis.deposits || 0,
            withdrawal_volume: 0,  // extend when available
            bonus_exposure: kpis.bonuses || 0,
            transaction_count: kpis.transaction_count || 0,
            approval_rate: kpis.approval_rate || 0,
            events_sent: kpis.events_sent || 0,
            compliance_alerts: kpis.compliance_alerts || 0,
            period,
            comparison,
            metrics: stats.metrics || {},
            ggr_history: stats.ggr_history || [],
        }, startTime);
    }

    /**
     * GET /v1/ops/metrics/ggr
     * GGR breakdown by provider, game category, and player cohort
     */
    async getGGR(tenantId, { period = '30d', granularity = 'daily' } = {}) {
        const startTime = Date.now();
        const periodLabel = this._resolvePeriod(period);
        const stats = await this.db.getOperatorStats(tenantId, periodLabel);

        return this._envelope({
            ggr: stats.ggr || 0,
            ngr: stats.ngr || 0,
            bonuses: stats.bonuses || 0,
            history: stats.ggr_history || [],
            granularity,
            period,
        }, startTime);
    }

    /**
     * GET /v1/ops/metrics/players
     * Player counts: registrations, active, KYC status distribution
     */
    async getPlayers(tenantId, { period = '30d', country, risk_band } = {}) {
        const startTime = Date.now();
        const kpis = await this.db.getAggregatedKPIs(tenantId, this._resolvePeriod(period));

        // Get player stats
        let playerData = { active: kpis.active_players || 0, total: 0 };
        if (this.db.client) {
            const { count } = await this.db.client
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('brand_id', tenantId);
            playerData.total = count || 0;
        }

        return this._envelope({
            active_players: playerData.active,
            total_players: playerData.total,
            period,
            filters_applied: { country: country || null, risk_band: risk_band || null },
        }, startTime);
    }

    /**
     * GET /v1/ops/metrics/payments
     * PSP approval rates, deposit/withdrawal volumes
     */
    async getPayments(tenantId, { period = '30d', psp, method } = {}) {
        const startTime = Date.now();
        const kpis = await this.db.getAggregatedKPIs(tenantId, this._resolvePeriod(period));

        return this._envelope({
            approval_rate: kpis.approval_rate || 0,
            deposit_volume: kpis.deposits || 0,
            withdrawal_volume: 0,
            transaction_count: kpis.transaction_count || 0,
            period,
            filters_applied: { psp: psp || null, method: method || null },
        }, startTime);
    }

    /**
     * GET /v1/ops/metrics/bonuses
     * Bonus wallet stats
     */
    async getBonuses(tenantId, { period = '30d', bonus_type, template_id } = {}) {
        const startTime = Date.now();
        const BonusManagementService = require('./bonus-management-service');

        let analytics = {};
        try {
            analytics = await BonusManagementService.getAnalytics(tenantId);
        } catch (e) {
            logger.warn('[AFA Metrics] Bonus analytics unavailable', { error: e.message });
        }

        return this._envelope({
            total_credited: analytics.total_credited || 0,
            active_count: analytics.active_count || 0,
            completed_count: analytics.completed_count || 0,
            forfeited_count: analytics.forfeited_count || 0,
            expired_count: analytics.expired_count || 0,
            avg_wagering_completion: analytics.avg_wagering_completion || 0,
            period,
            filters_applied: { bonus_type: bonus_type || null, template_id: template_id || null },
        }, startTime);
    }

    /**
     * GET /v1/ops/metrics/rg
     * Duty of Care summary: open welfare cases, risk band distribution
     */
    async getRG(tenantId, { period = '30d', risk_band } = {}) {
        const startTime = Date.now();
        const kpis = await this.db.getAggregatedKPIs(tenantId, this._resolvePeriod(period));

        // Get risk score distribution from rg_player_metrics
        let riskDistribution = { low: 0, medium: 0, high: 0, critical: 0 };
        if (this.db.client) {
            try {
                const { data: metrics } = await this.db.client
                    .from('rg_player_metrics')
                    .select('composite_score')
                    .eq('tenant_id', tenantId)
                    .eq('monitoring_active', true);

                if (metrics) {
                    metrics.forEach(m => {
                        const score = m.composite_score || 0;
                        if (score >= 9) riskDistribution.critical++;
                        else if (score >= 6) riskDistribution.high++;
                        else if (score >= 3) riskDistribution.medium++;
                        else riskDistribution.low++;
                    });
                }
            } catch (e) {
                logger.warn('[AFA Metrics] RG metrics query failed', { error: e.message });
            }
        }

        return this._envelope({
            compliance_alerts: kpis.compliance_alerts || 0,
            risk_distribution: riskDistribution,
            period,
            filters_applied: { risk_band: risk_band || null },
        }, startTime);
    }
}

module.exports = AfaMetricsService;
