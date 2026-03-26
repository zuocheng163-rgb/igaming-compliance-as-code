'use strict';
/**
 * AFA Rate Limit Middleware
 *
 * Per-agent rate limiting keyed on agent_id (not IP).
 * Implements the rate limits from PRD Section 11.
 *
 * Rate limits are applied AFTER auth middleware (requires req.agent).
 * Returns HTTP 429 with Retry-After header and RATE_LIMIT_EXCEEDED error code.
 */

const rateLimit = require('express-rate-limit');
const { AfaError } = require('./afa-error');

/**
 * Create a rate limiter keyed on agent_id.
 *
 * @param {object} opts
 * @param {number} opts.windowMs      — Window duration in milliseconds
 * @param {number} opts.max           — Max requests per window
 * @param {string} [opts.name]        — Optional name for logging
 */
function createAgentRateLimit({ windowMs, max, name = 'afa' }) {
    return rateLimit({
        windowMs,
        max,
        // Key by agent_id from decoded JWT (set by afa-auth middleware)
        keyGenerator: (req) => {
            return req.agent?.agent_id || req.ip;
        },
        // Structured error response
        handler: (req, res, _next, options) => {
            const retryAfter = Math.ceil(options.windowMs / 1000);
            res.setHeader('Retry-After', retryAfter);

            const err = AfaError.rateLimitExceeded(retryAfter);
            err.requestId = req.correlationId || require('crypto').randomUUID();
            return res.status(429).json(err.toJSON());
        },
        // Standard headers
        standardHeaders: true,
        legacyHeaders: false,
        // Skip rate limiting if auth failed (no agent on request)
        skip: (req) => !req.agent,
    });
}

// Pre-configured limiters matching PRD Section 11
const metricsLimiter = createAgentRateLimit({
    windowMs: 60 * 1000,   // 1 minute
    max: 300,              // 300 req/min per agent_id
    name: 'metrics',
});

const alertsLimiter = createAgentRateLimit({
    windowMs: 60 * 1000,
    max: 300,
    name: 'alerts',
});

const analysisLimiter = createAgentRateLimit({
    windowMs: 60 * 1000,
    max: 60,               // 60 req/min per tenant (LLM-backed)
    name: 'analysis',
});

const actionsT2Limiter = createAgentRateLimit({
    windowMs: 60 * 1000,
    max: 30,               // 30 req/min per agent_id
    name: 'actions-t2',
});

const actionsT3Limiter = createAgentRateLimit({
    windowMs: 60 * 1000,
    max: 10,               // 10 req/min per agent_id
    name: 'actions-t3',
});

const auditLimiter = createAgentRateLimit({
    windowMs: 60 * 1000,
    max: 300,
    name: 'audit',
});

module.exports = {
    createAgentRateLimit,
    metricsLimiter,
    alertsLimiter,
    analysisLimiter,
    actionsT2Limiter,
    actionsT3Limiter,
    auditLimiter,
};
