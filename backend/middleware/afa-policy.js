'use strict';
/**
 * AFA Policy Enforcement Middleware
 *
 * Provides middleware factories to enforce:
 *   1. Scope requirements — agent JWT must carry the required scope string
 *   2. Trust tier requirements — minimum tier check (T1 < T2 < T3)
 *   3. T2 policy bounds — payload values must be within operator-configured limits
 *
 * Usage:
 *   router.get('/metrics/summary', requireScope('metrics:read'), handler);
 *   router.post('/actions/players/:id/restrict', requireScope('player:restrict:pre-auth'), requireTier('T2'), handler);
 */

const { AfaError } = require('./afa-error');
const { logger } = require('../services/logger');

const TIER_ORDER = { T1: 1, T2: 2, T3: 3 };

/**
 * Requires the agent's JWT to contain a specific scope string.
 * @param {string} scope — e.g. 'metrics:read', 'player:restrict:pre-auth'
 */
function requireScope(scope) {
    return (req, res, next) => {
        if (!req.agent) {
            return next(AfaError.authMissing());
        }

        if (!req.agent.policy_scope.includes(scope)) {
            // Log scope violation
            _logViolation(req, scope);
            const err = AfaError.scopeInsufficient(scope);
            err.requestId = req.correlationId;
            return res.status(err.httpStatus).json(err.toJSON());
        }

        next();
    };
}

/**
 * Requires the agent to have at least the specified trust tier.
 * @param {string} minTier — 'T1', 'T2', or 'T3'
 */
function requireTier(minTier) {
    return (req, res, next) => {
        if (!req.agent) {
            return next(AfaError.authMissing());
        }

        const agentTierLevel = TIER_ORDER[req.agent.trust_tier] || 0;
        const requiredTierLevel = TIER_ORDER[minTier] || 0;

        if (agentTierLevel < requiredTierLevel) {
            const err = new AfaError(
                'TRUST_TIER_INSUFFICIENT',
                'scope',
                403,
                'escalate_to_human',
                { agent_tier: req.agent.trust_tier, required_tier: minTier }
            );
            err.requestId = req.correlationId;
            return res.status(err.httpStatus).json(err.toJSON());
        }

        next();
    };
}

/**
 * Validates T2 action payload against operator-configured policy bounds.
 * Checks tenant_configs.afa_t2_policy_bounds for the given action type.
 *
 * @param {string} actionScope — e.g. 'player:restrict:pre-auth'
 * @param {Function} extractValue — (req) => value to check against bound, or null to skip
 */
function enforcePolicyBounds(actionScope, extractValue) {
    return async (req, res, next) => {
        try {
            if (!req.agent) {
                return next(AfaError.authMissing());
            }

            const supabaseService = require('../services/supabase');
            const config = await supabaseService.getTenantConfig(req.agent.tenant_id);
            const bounds = config?.afa_t2_policy_bounds || {};
            const actionBounds = bounds[actionScope];

            // No bounds configured for this action — allow by default
            if (!actionBounds || typeof actionBounds !== 'object') {
                return next();
            }

            // Extract value from request to validate
            if (typeof extractValue === 'function') {
                const value = extractValue(req);
                if (value !== null && value !== undefined) {
                    // Check each bound condition
                    for (const [boundKey, boundValue] of Object.entries(actionBounds)) {
                        if (boundKey.startsWith('max_') && value > boundValue) {
                            const err = AfaError.policyLimitExceeded(boundKey, value, boundValue);
                            err.requestId = req.correlationId;
                            return res.status(err.httpStatus).json(err.toJSON());
                        }
                        if (boundKey.startsWith('min_') && value < boundValue) {
                            const err = AfaError.policyLimitExceeded(boundKey, value, boundValue);
                            err.requestId = req.correlationId;
                            return res.status(err.httpStatus).json(err.toJSON());
                        }
                    }
                }
            }

            next();
        } catch (err) {
            logger.error('[AFA Policy] Error checking policy bounds', { error: err.message });
            next(); // Fail open on config errors — action will still be audited
        }
    };
}

/**
 * Log scope violation to agent_audit_log (fire-and-forget)
 */
async function _logViolation(req, requiredScope) {
    try {
        const supabaseService = require('../services/supabase');
        if (!supabaseService.client || !req.agent) return;
        await supabaseService.client.from('agent_audit_log').insert({
            tenant_id: req.agent.tenant_id,
            agent_id: req.agent.agent_id,
            event_type: 'SCOPE_VIOLATION',
            action_type: req.path,
            policy_scope: req.agent.policy_scope,
            execution_result: {
                required_scope: requiredScope,
                granted_scope: req.agent.policy_scope,
                endpoint: req.originalUrl,
            },
            http_status: 403,
        });
    } catch (e) {
        logger.error('[AFA Policy] Failed to log violation', { error: e.message });
    }
}

module.exports = { requireScope, requireTier, enforcePolicyBounds };
