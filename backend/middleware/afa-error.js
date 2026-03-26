'use strict';
/**
 * AFA Error Middleware
 * 
 * Provides structured, machine-readable error responses for all AFA endpoints.
 * Agents can branch on error_code and suggested_action without LLM interpretation.
 *
 * Usage in route handlers:
 *   throw new AfaError('SCOPE_INSUFFICIENT', 'scope', 403, 'escalate_to_human', { required_scope: 'player:restrict:pre-auth' });
 *   // or use helpers:
 *   throw AfaError.scopeInsufficient('player:restrict:pre-auth');
 */

const crypto = require('crypto');

class AfaError extends Error {
    /**
     * @param {string} errorCode      Machine-readable constant (e.g. SCOPE_INSUFFICIENT)
     * @param {string} errorCategory  Broad category: auth | scope | validation | business_rule | platform | rate_limit
     * @param {number} httpStatus     Standard HTTP status code
     * @param {string} suggestedAction What the agent should do (e.g. escalate_to_human, retry_with_backoff)
     * @param {object} details        Optional structured detail
     */
    constructor(errorCode, errorCategory, httpStatus, suggestedAction, details = null) {
        super(errorCode);
        this.name = 'AfaError';
        this.errorCode = errorCode;
        this.errorCategory = errorCategory;
        this.httpStatus = httpStatus;
        this.suggestedAction = suggestedAction;
        this.details = details;
        this.requestId = crypto.randomUUID();
    }

    toJSON() {
        const payload = {
            error_code: this.errorCode,
            error_category: this.errorCategory,
            suggested_action: this.suggestedAction,
            http_status: this.httpStatus,
            request_id: this.requestId,
        };
        if (this.details) {
            payload.details = this.details;
        }
        return payload;
    }

    // -------------------------------------------------------------------------
    // Factory helpers for common error types
    // -------------------------------------------------------------------------

    static authMissing() {
        return new AfaError(
            'AUTH_TOKEN_MISSING',
            'auth',
            401,
            'provide_agent_token',
            { hint: 'Include Authorization: Bearer <agent_jwt> header' }
        );
    }

    static authInvalid(reason = 'Token signature verification failed') {
        return new AfaError(
            'AUTH_TOKEN_INVALID',
            'auth',
            401,
            'request_new_token',
            { reason }
        );
    }

    static authExpired() {
        return new AfaError(
            'AUTH_TOKEN_EXPIRED',
            'auth',
            401,
            'request_new_token',
            { hint: 'Token has expired — request a new one via POST /v1/auth/agent-tokens' }
        );
    }

    static authRevoked() {
        return new AfaError(
            'AUTH_TOKEN_REVOKED',
            'auth',
            401,
            'request_new_token',
            { hint: 'Token has been revoked by an operator' }
        );
    }

    static scopeInsufficient(requiredScope) {
        return new AfaError(
            'SCOPE_INSUFFICIENT',
            'scope',
            403,
            'escalate_to_human',
            { required_scope: requiredScope }
        );
    }

    static policyLimitExceeded(limit, currentValue, policyBound) {
        return new AfaError(
            'POLICY_LIMIT_EXCEEDED',
            'business_rule',
            403,
            'escalate_to_human',
            { limit, current_value: currentValue, policy_bound: policyBound }
        );
    }

    static rateLimitExceeded(retryAfterSeconds) {
        return new AfaError(
            'RATE_LIMIT_EXCEEDED',
            'rate_limit',
            429,
            'retry_with_backoff',
            { retry_after: retryAfterSeconds }
        );
    }

    static validationFailed(fieldErrors) {
        return new AfaError(
            'VALIDATION_FAILED',
            'validation',
            400,
            'fix_request_payload',
            { field_errors: fieldErrors }
        );
    }

    static notFound(entityType, entityId) {
        return new AfaError(
            'ENTITY_NOT_FOUND',
            'business_rule',
            404,
            'query_alerts_api',
            { entity_type: entityType, entity_id: entityId }
        );
    }

    static playerExcluded(playerId) {
        return new AfaError(
            'PLAYER_EXCLUDED',
            'business_rule',
            409,
            'log_and_skip',
            { player_id: playerId }
        );
    }

    static afaDisabled() {
        return new AfaError(
            'AFA_NOT_ENABLED',
            'platform',
            403,
            'contact_operator_admin',
            { hint: 'AFA is not enabled for this tenant. Enable it in Settings > Agent Tokens.' }
        );
    }

    static internal(message) {
        return new AfaError(
            'INTERNAL_ERROR',
            'platform',
            500,
            'retry_with_backoff',
            { message }
        );
    }

    static methodNotAllowed() {
        return new AfaError(
            'METHOD_NOT_ALLOWED',
            'platform',
            405,
            'check_openapi_schema',
            { hint: 'This method is not allowed on audit log endpoints (immutability guarantee).' }
        );
    }
}

/**
 * Express error-handling middleware for AFA routes.
 * Converts AfaError instances to structured JSON; wraps unexpected errors.
 */
function afaErrorHandler(err, req, res, _next) {
    if (err instanceof AfaError) {
        // Attach request_id from correlation middleware if available
        if (req.correlationId) {
            err.requestId = req.correlationId;
        }
        return res.status(err.httpStatus).json(err.toJSON());
    }

    // Wrap unexpected errors in a structured response
    const wrapped = AfaError.internal(
        process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
    );
    if (req.correlationId) {
        wrapped.requestId = req.correlationId;
    }
    return res.status(500).json(wrapped.toJSON());
}

module.exports = { AfaError, afaErrorHandler };
