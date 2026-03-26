'use strict';
/**
 * OpenAPI 3.1 Schema Generator
 *
 * Generates a complete OpenAPI 3.1 JSON document for all AFA endpoints.
 * Includes request/response schemas, security, scope annotations, and examples.
 */

function generateOpenApiSpec() {
    return {
        openapi: '3.1.0',
        info: {
            title: 'NeoStrike Agent-Friendly API (AFA)',
            version: '1.0.0',
            description: 'Structured, machine-readable HTTP API for autonomous AI agents to operate the NeoStrike Operator Portal. Supports three trust tiers: T1 (Observe), T2 (Pre-authorised), T3 (Human-gated).',
            contact: { email: 'support@neostrike.io' },
        },
        servers: [
            { url: '/api', description: 'NeoStrike API Server' },
        ],
        security: [{ AgentBearerAuth: [] }],
        components: {
            securitySchemes: {
                AgentBearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Agent JWT issued via POST /v1/auth/agent-tokens',
                },
            },
            schemas: {
                AfaError: {
                    type: 'object',
                    required: ['error_code', 'error_category', 'suggested_action', 'http_status', 'request_id'],
                    properties: {
                        error_code:       { type: 'string', example: 'SCOPE_INSUFFICIENT' },
                        error_category:   { type: 'string', enum: ['auth', 'scope', 'validation', 'business_rule', 'platform', 'rate_limit'] },
                        suggested_action: { type: 'string', example: 'escalate_to_human' },
                        http_status:      { type: 'integer', example: 403 },
                        request_id:       { type: 'string', format: 'uuid' },
                        details:          { type: 'object', additionalProperties: true },
                    },
                },
                MetricsEnvelope: {
                    type: 'object',
                    properties: {
                        data:              { type: 'object' },
                        data_as_of:        { type: 'string', format: 'date-time' },
                        freshness_seconds: { type: 'integer' },
                    },
                },
                Alert: {
                    type: 'object',
                    properties: {
                        id:                    { type: 'string', format: 'uuid' },
                        player_id:             { type: 'string' },
                        alert_type:            { type: 'string' },
                        composite_risk_score:  { type: 'integer' },
                        triggered_signals:     { type: 'array', items: { type: 'string' } },
                        status:                { type: 'string', enum: ['open', 'acknowledged', 'resolved', 'escalated'] },
                        severity:              { type: 'string', enum: ['medium', 'high', 'critical'] },
                        created_at:            { type: 'string', format: 'date-time' },
                        message:               { type: 'string' },
                        _links:                { type: 'object' },
                    },
                },
                AgentToken: {
                    type: 'object',
                    properties: {
                        token:        { type: 'string', description: 'Signed JWT — only returned on creation' },
                        jti:          { type: 'string', format: 'uuid' },
                        agent_id:     { type: 'string' },
                        tenant_id:    { type: 'string' },
                        trust_tier:   { type: 'string', enum: ['T1', 'T2', 'T3'] },
                        policy_scope: { type: 'array', items: { type: 'string' } },
                        issued_at:    { type: 'string', format: 'date-time' },
                        expires_at:   { type: 'string', format: 'date-time' },
                    },
                },
                WebhookSubscription: {
                    type: 'object',
                    properties: {
                        id:           { type: 'string', format: 'uuid' },
                        agent_id:     { type: 'string' },
                        callback_url: { type: 'string', format: 'uri' },
                        event_types:  { type: 'array', items: { type: 'string' } },
                        filter:       { type: 'object' },
                        is_sse:       { type: 'boolean' },
                        active:       { type: 'boolean' },
                        created_at:   { type: 'string', format: 'date-time' },
                    },
                },
            },
            parameters: {
                PeriodParam: {
                    name: 'period',
                    in: 'query',
                    schema: { type: 'string', enum: ['today', '7d', '30d', '90d', 'custom'], default: '30d' },
                    description: 'Reporting period',
                },
                CursorParam: {
                    name: 'cursor',
                    in: 'query',
                    schema: { type: 'string' },
                    description: 'Cursor from previous page for pagination',
                },
                LimitParam: {
                    name: 'limit',
                    in: 'query',
                    schema: { type: 'integer', default: 20, maximum: 100 },
                    description: 'Items per page',
                },
            },
        },
        paths: {
            // --- Metrics API ---
            '/v1/ops/metrics/summary': {
                get: {
                    tags: ['Metrics'],
                    summary: 'Aggregated dashboard metrics',
                    operationId: 'getMetricsSummary',
                    'x-required-scope': 'metrics:read',
                    'x-trust-tier': 'T1',
                    parameters: [
                        { $ref: '#/components/parameters/PeriodParam' },
                        { name: 'compare_period', in: 'query', schema: { type: 'string' } },
                    ],
                    responses: {
                        200: { description: 'Metrics summary', content: { 'application/json': { schema: { $ref: '#/components/schemas/MetricsEnvelope' } } } },
                        401: { description: 'Auth error', content: { 'application/json': { schema: { $ref: '#/components/schemas/AfaError' } } } },
                        403: { description: 'Scope error', content: { 'application/json': { schema: { $ref: '#/components/schemas/AfaError' } } } },
                    },
                },
            },
            '/v1/ops/metrics/ggr': {
                get: { tags: ['Metrics'], summary: 'GGR breakdown', operationId: 'getMetricsGGR', 'x-required-scope': 'metrics:read', 'x-trust-tier': 'T1',
                    parameters: [{ $ref: '#/components/parameters/PeriodParam' }],
                    responses: { 200: { description: 'GGR data' }, 401: { description: 'Auth error' } } },
            },
            '/v1/ops/metrics/players': {
                get: { tags: ['Metrics'], summary: 'Player counts', operationId: 'getMetricsPlayers', 'x-required-scope': 'metrics:read', 'x-trust-tier': 'T1',
                    parameters: [{ $ref: '#/components/parameters/PeriodParam' }],
                    responses: { 200: { description: 'Player data' } } },
            },
            '/v1/ops/metrics/payments': {
                get: { tags: ['Metrics'], summary: 'Payment metrics', operationId: 'getMetricsPayments', 'x-required-scope': 'metrics:read', 'x-trust-tier': 'T1',
                    parameters: [{ $ref: '#/components/parameters/PeriodParam' }],
                    responses: { 200: { description: 'Payment data' } } },
            },
            '/v1/ops/metrics/bonuses': {
                get: { tags: ['Metrics'], summary: 'Bonus stats', operationId: 'getMetricsBonuses', 'x-required-scope': 'metrics:read', 'x-trust-tier': 'T1',
                    parameters: [{ $ref: '#/components/parameters/PeriodParam' }],
                    responses: { 200: { description: 'Bonus data' } } },
            },
            '/v1/ops/metrics/rg': {
                get: { tags: ['Metrics'], summary: 'Duty of Care summary', operationId: 'getMetricsRG', 'x-required-scope': 'metrics:read', 'x-trust-tier': 'T1',
                    parameters: [{ $ref: '#/components/parameters/PeriodParam' }],
                    responses: { 200: { description: 'RG data' } } },
            },
            // --- Alerts API ---
            '/v1/ops/alerts': {
                get: {
                    tags: ['Alerts'],
                    summary: 'Paginated alert list',
                    operationId: 'listAlerts',
                    'x-required-scope': 'alerts:read',
                    'x-trust-tier': 'T1',
                    parameters: [
                        { name: 'status', in: 'query', schema: { type: 'string' } },
                        { name: 'category', in: 'query', schema: { type: 'string' } },
                        { name: 'risk_band', in: 'query', schema: { type: 'string' } },
                        { name: 'player_id', in: 'query', schema: { type: 'string' } },
                        { name: 'since', in: 'query', schema: { type: 'string', format: 'date-time' } },
                        { $ref: '#/components/parameters/LimitParam' },
                        { $ref: '#/components/parameters/CursorParam' },
                    ],
                    responses: {
                        200: { description: 'Alert list with pagination' },
                    },
                },
            },
            '/v1/ops/alerts/{id}': {
                get: { tags: ['Alerts'], summary: 'Alert detail', operationId: 'getAlertDetail', 'x-required-scope': 'alerts:read', 'x-trust-tier': 'T1',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { description: 'Alert detail' }, 404: { description: 'Not found' } } },
            },
            '/v1/ops/alerts/subscriptions': {
                post: { tags: ['Alerts'], summary: 'Register webhook/SSE subscription', operationId: 'createAlertSubscription', 'x-required-scope': 'alerts:subscribe', 'x-trust-tier': 'T1',
                    requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/WebhookSubscription' } } } },
                    responses: { 201: { description: 'Subscription created' } } },
            },
            '/v1/ops/alerts/subscriptions/{id}': {
                delete: { tags: ['Alerts'], summary: 'Delete subscription', operationId: 'deleteAlertSubscription', 'x-required-scope': 'alerts:subscribe', 'x-trust-tier': 'T1',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { description: 'Deleted' } } },
            },
            '/v1/ops/alerts/{id}/status': {
                patch: { tags: ['Alerts'], summary: 'Update alert status', operationId: 'updateAlertStatus', 'x-required-scope': 'alerts:write:pre-auth', 'x-trust-tier': 'T2',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['acknowledged', 'resolved', 'escalated'] }, agent_note: { type: 'string' } } } } } },
                    responses: { 200: { description: 'Status updated' } } },
            },
            // --- Audit API ---
            '/v1/ops/audit/agent-actions': {
                get: { tags: ['Audit'], summary: 'Agent action history', operationId: 'listAgentActions', 'x-required-scope': 'audit:read', 'x-trust-tier': 'T1',
                    parameters: [
                        { name: 'agent_id', in: 'query', schema: { type: 'string' } },
                        { name: 'action_type', in: 'query', schema: { type: 'string' } },
                        { name: 'since', in: 'query', schema: { type: 'string', format: 'date-time' } },
                        { $ref: '#/components/parameters/LimitParam' },
                        { $ref: '#/components/parameters/CursorParam' },
                    ],
                    responses: { 200: { description: 'Action list' } } },
            },
            '/v1/ops/audit/agent-actions/{id}': {
                get: { tags: ['Audit'], summary: 'Agent action detail', operationId: 'getAgentActionDetail', 'x-required-scope': 'audit:read', 'x-trust-tier': 'T1',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    responses: { 200: { description: 'Action detail' } } },
            },
            '/v1/ops/audit/pending-approvals': {
                get: { tags: ['Audit'], summary: 'T3 pending approvals', operationId: 'listPendingApprovals', 'x-required-scope': 'audit:read', 'x-trust-tier': 'T1',
                    responses: { 200: { description: 'Pending approvals list' } } },
            },
            '/v1/ops/audit/policy-log': {
                get: { tags: ['Audit'], summary: 'Token lifecycle events', operationId: 'getPolicyLog', 'x-required-scope': 'audit:read', 'x-trust-tier': 'T1',
                    responses: { 200: { description: 'Policy log' } } },
            },
            // --- Auth (Token Management) ---
            '/v1/auth/agent-tokens': {
                post: {
                    tags: ['Auth'],
                    summary: 'Issue agent token',
                    operationId: 'issueAgentToken',
                    security: [], // Uses human admin auth, not agent JWT
                    description: 'Issue a new agent JWT. Requires human admin authentication (session token + x-api-key).',
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    required: ['agent_id', 'policy_scope', 'ttl_hours'],
                                    properties: {
                                        agent_id:     { type: 'string', description: 'Label for this agent' },
                                        policy_scope: { type: 'array', items: { type: 'string' }, description: 'Scope strings from Appendix A' },
                                        ttl_hours:    { type: 'integer', description: 'Token TTL in hours (max per tenant config)' },
                                        ip_allowlist: { type: 'array', items: { type: 'string' }, description: 'Optional IP restriction' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        201: { description: 'Token issued', content: { 'application/json': { schema: { $ref: '#/components/schemas/AgentToken' } } } },
                        400: { description: 'Validation error' },
                        403: { description: 'Admin access required' },
                    },
                },
                get: {
                    tags: ['Auth'],
                    summary: 'List agent tokens',
                    operationId: 'listAgentTokens',
                    security: [],
                    responses: { 200: { description: 'Token list' } },
                },
            },
            '/v1/auth/agent-tokens/{jti}': {
                delete: {
                    tags: ['Auth'],
                    summary: 'Revoke agent token',
                    operationId: 'revokeAgentToken',
                    security: [],
                    parameters: [{ name: 'jti', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                    requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { reason: { type: 'string' } } } } } },
                    responses: { 200: { description: 'Token revoked' } },
                },
            },
            '/v1/auth/approvals/{id}/resolve': {
                post: {
                    tags: ['Auth'],
                    summary: 'Resolve T3 escalation (Admin only)',
                    operationId: 'resolveApproval',
                    security: [],
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { resolution: { type: 'string', enum: ['approved', 'rejected'] }, reason: { type: 'string' } } } } } },
                    responses: { 200: { description: 'Resolution processed' } },
                },
            },
            // --- Actions API (T2/T3) ---
            '/v1/ops/actions/players/{id}/restrict': {
                post: {
                    tags: ['Actions'],
                    summary: 'T2: Restrict player access',
                    operationId: 'restrictPlayer',
                    'x-required-scope': 'player:restrict:pre-auth',
                    'x-trust-tier': 'T2',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { type: { type: 'string' }, duration: { type: 'integer' }, reason: { type: 'string' } } } } } },
                    responses: { 200: { description: 'Restriction applied' } },
                },
            },
            '/v1/ops/actions/players/{id}/forfeit-bonus': {
                post: {
                    tags: ['Actions'],
                    summary: 'T2: Forfeit player bonus',
                    operationId: 'forfeitBonus',
                    'x-required-scope': 'bonus:forfeit:pre-auth',
                    'x-trust-tier': 'T2',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { bonus_id: { type: 'string' }, reason: { type: 'string' } } } } } },
                    responses: { 200: { description: 'Bonus forfeited' } },
                },
            },
            '/v1/ops/actions/players/{id}/welfare-tag': {
                post: {
                    tags: ['Actions'],
                    summary: 'T2: Apply welfare/RG tag',
                    operationId: 'applyWelfareTag',
                    'x-required-scope': 'player:welfare:pre-auth',
                    'x-trust-tier': 'T2',
                    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { tag: { type: 'string' }, note: { type: 'string' } } } } } },
                    responses: { 200: { description: 'Tag applied' } },
                },
            },
            '/v1/ops/actions/escalations': {
                post: {
                    tags: ['Actions'],
                    summary: 'T3: Request human approval for restricted action',
                    operationId: 'createEscalation',
                    'x-required-scope': 'escalation:create',
                    'x-trust-tier': 'T1',
                    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { action_type: { type: 'string' }, target_entity: { type: 'string' }, payload: { type: 'object' }, agent_note: { type: 'string' } } } } } },
                    responses: { 201: { description: 'Escalation created' } },
                },
            },
            // --- Events API ---
            '/v1/ops/events/stream': {
                get: {
                    tags: ['Events'],
                    summary: 'Real-time SSE event stream',
                    operationId: 'getEventStream',
                    'x-required-scope': 'events:stream',
                    'x-trust-tier': 'T1',
                    responses: { 200: { description: 'SSE stream established' } },
                },
            },
        },
        tags: [
            { name: 'Metrics', description: 'T1 — Operator dashboard metrics' },
            { name: 'Alerts', description: 'T1 read, T2 write — Alert management and subscriptions' },
            { name: 'Actions', description: 'T2 pre-authorised or T3 proposed operational actions' },
            { name: 'Events', description: 'Real-time event streaming via SSE' },
            { name: 'Audit', description: 'T1 — Agent action audit trail' },
            { name: 'Auth', description: 'Agent token and approval management (human admin auth required)' },
        ],
    };
}

module.exports = { generateOpenApiSpec };
