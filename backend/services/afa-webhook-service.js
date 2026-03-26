'use strict';
/**
 * AFA Webhook Service
 *
 * Manages webhook subscription CRUD for the AFA layer.
 * Phase 1: subscription management only.
 * Phase 2: adds event delivery with signature and retry logic.
 */

const { logger } = require('./logger');
const crypto = require('crypto');
const axios = require('axios'); // For webhook POST delivery
const EventEmitter = require('events');
const events = new EventEmitter();

// Max retries for webhook delivery
const MAX_DELIVERY_RETRIES = 3;
const RETRY_BACKOFF_MS = 2000;

// Supported event types from PRD Section 10.1
const SUPPORTED_EVENT_TYPES = [
    'rg_alert_created',
    'rg_alert_escalated',
    'transaction_anomaly_detected',
    'welfare_outreach_triggered',
    'compliance_deadline_approaching',
    'player_risk_score_changed',
    'gamstop_match_detected',
    'bonus_integrity_flag_raised',
];

class AfaWebhookService {
    constructor(supabaseService) {
        this.db = supabaseService;
    }

    /**
     * Create a webhook subscription.
     *
     * @param {object} params
     * @param {string} params.tenantId
     * @param {string} params.agentId
     * @param {string} [params.callbackUrl]  — required for webhook; null for SSE
     * @param {string[]} params.eventTypes
     * @param {object} [params.filter]
     * @param {boolean} [params.isSse=false]
     */
    async createSubscription({ tenantId, agentId, callbackUrl, eventTypes, filter = {}, isSse = false }) {
        if (!this.db.client) throw new Error('Database not available');

        // Validate event types
        const invalidTypes = eventTypes.filter(t => !SUPPORTED_EVENT_TYPES.includes(t));
        if (invalidTypes.length > 0) {
            throw new Error(`Invalid event types: ${invalidTypes.join(', ')}. Supported: ${SUPPORTED_EVENT_TYPES.join(', ')}`);
        }

        // Validate callback URL for webhook subscriptions
        if (!isSse && !callbackUrl) {
            throw new Error('callback_url is required for webhook subscriptions');
        }

        // Check subscription limit (50 per tenant from PRD Section 11)
        const { count } = await this.db.client
            .from('webhook_subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', String(tenantId))
            .eq('active', true);

        if ((count || 0) >= 50) {
            throw new Error('Maximum webhook subscriptions reached (50 per tenant)');
        }

        const { data, error } = await this.db.client
            .from('webhook_subscriptions')
            .insert({
                tenant_id: String(tenantId),
                agent_id: agentId,
                callback_url: callbackUrl || null,
                event_types: eventTypes,
                filter,
                is_sse: isSse,
                active: true,
            })
            .select()
            .single();

        if (error) {
            logger.error('[AFA Webhook] Subscription creation failed', { error: error.message });
            throw new Error('Failed to create subscription');
        }

        logger.info('[AFA Webhook] Subscription created', {
            id: data.id, agentId, tenantId, eventTypes,
        });

        return {
            id: data.id,
            agent_id: agentId,
            callback_url: callbackUrl || null,
            event_types: eventTypes,
            filter,
            is_sse: isSse,
            active: true,
            created_at: data.created_at,
        };
    }

    /**
     * Delete (deactivate) a webhook subscription.
     */
    async deleteSubscription(subscriptionId, agentId) {
        if (!this.db.client) throw new Error('Database not available');

        const { data: sub, error: fetchError } = await this.db.client
            .from('webhook_subscriptions')
            .select('agent_id')
            .eq('id', subscriptionId)
            .maybeSingle();

        if (fetchError || !sub) {
            throw new Error('Subscription not found');
        }

        // Ensure the agent owns this subscription
        if (sub.agent_id !== agentId) {
            throw new Error('Not authorized to delete this subscription');
        }

        const { error } = await this.db.client
            .from('webhook_subscriptions')
            .update({ active: false })
            .eq('id', subscriptionId);

        if (error) throw new Error('Failed to delete subscription');

        logger.info('[AFA Webhook] Subscription deleted', { subscriptionId, agentId });
        return { success: true };
    }

    /**
     * List active subscriptions for a tenant/agent.
     */
    async listSubscriptions(tenantId, agentId = null) {
        if (!this.db.client) return [];

        let query = this.db.client
            .from('webhook_subscriptions')
            .select('*')
            .eq('tenant_id', String(tenantId))
            .eq('active', true)
            .order('created_at', { ascending: false });

        if (agentId) {
            query = query.eq('agent_id', agentId);
        }

        const { data, error } = await query;
        if (error) {
            logger.error('[AFA Webhook] List subscriptions failed', { error: error.message });
            return [];
        }
        return data || [];
    }

    /**
     * Get supported event types.
     */
    static getSupportedEventTypes() {
        return SUPPORTED_EVENT_TYPES;
    }

    /**
     * Phase 2: Process an incoming system event and fan-out to subscriptions.
     *
     * @param {string} eventType
     * @param {object} payload
     * @param {string} brandId
     */
    async processEvent(eventType, payload, brandId) {
        if (!SUPPORTED_EVENT_TYPES.includes(eventType)) {
            return; // Not an AFA-supported event
        }

        // 1. Fetch active subscriptions for this brand and event type
        const { data: subs, error } = await this.db.client
            .from('webhook_subscriptions')
            .select('*')
            .eq('tenant_id', String(brandId))
            .eq('active', true)
            .contains('event_types', [eventType]);

        if (error || !subs || subs.length === 0) return;

        logger.info(`[AFA Webhook] Fanning out event "${eventType}" to ${subs.length} subscribers`, { brandId });

        // 2. Wrap payload in standard AFA envelope
        const envelope = {
            event_id: crypto.randomUUID(),
            event_type: eventType,
            occurred_at: new Date().toISOString(),
            brand_id: Number(brandId),
            data: payload,
        };

        // 3. Deliver to each subscriber
        for (const sub of subs) {
            // Apply filtering (basic key-value matching for now)
            if (sub.filter && Object.keys(sub.filter).length > 0) {
                const isMatch = Object.entries(sub.filter).every(([k, v]) => payload[k] === v);
                if (!isMatch) continue;
            }

            if (sub.is_sse) {
                // Emit to local SSE listener (will only catch if client is on same instance)
                events.emit(`sse:${brandId}:${sub.agent_id}`, envelope);
                events.emit(`sse:${sub.id}`, envelope);
            } else if (sub.callback_url) {
                // Fire-and-forget background delivery
                this.deliverWebhook(sub, envelope).catch(err => {
                    logger.error('[AFA Webhook] Background delivery failed', { subId: sub.id, error: err.message });
                });
            }
        }
    }

    /**
     * Internal: Deliver webhook with HMAC signature and retry logic.
     */
    async deliverWebhook(sub, envelope, attempt = 1) {
        const body = JSON.stringify(envelope);

        // Derive secret (in real app, use sub.secret_key or tenant-level AFA_WEBHOOK_SECRET)
        const secret = process.env.AFA_WEBHOOK_SECRET || 'afa_dev_secret_2026';
        const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

        try {
            await axios.post(sub.callback_url, body, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'NeoStrike-AFA-Webhook/1.0',
                    'X-AFA-Signature': `sha256=${signature}`,
                    'X-AFA-Event-ID': envelope.event_id,
                },
                timeout: 5000,
            });

            logger.debug('[AFA Webhook] Delivered successfully', { subId: sub.id, eventId: envelope.event_id });
        } catch (err) {
            const status = err.response?.status || 'network_error';
            logger.warn(`[AFA Webhook] Delivery attempt ${attempt} failed`, { subId: sub.id, status, error: err.message });

            if (attempt < MAX_DELIVERY_RETRIES) {
                setTimeout(() => this.deliverWebhook(sub, envelope, attempt + 1), RETRY_BACKOFF_MS * attempt);
            } else {
                logger.error('[AFA Webhook] Max retries reached for subscription', { subId: sub.id, eventId: envelope.event_id });
            }
        }
    }

    /**
     * SSE Event Listener for routes.
     */
    onSseEvent(subId, callback) {
        events.on(`sse:${subId}`, callback);
        return () => events.off(`sse:${subId}`, callback);
    }
}

module.exports = { AfaWebhookService, SUPPORTED_EVENT_TYPES };
