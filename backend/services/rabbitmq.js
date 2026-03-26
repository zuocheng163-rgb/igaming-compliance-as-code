const amqp = require('amqplib');
const { logger } = require('./logger');

class RabbitMQService {
    constructor() {
        this.amqpUrl = process.env.CLOUDAMQP_URL;
        this.defaultQueue = process.env.RABBITMQ_QUEUE || 'fasttrack-events';
    }

    /**
     * Publishes an event to RabbitMQ using the AMQP protocol.
     * This ensures the message is "further processed by Rabbit" (headers, properties, etc.)
     * and avoids the wrapping mess caused by the HTTP Management API.
     */
    async publishEvent(routingKey, payload, type = null, options = {}) {
        if (!this.amqpUrl) {
            logger.warn('[RabbitMQ] CLOUDAMQP_URL not set. Asynchronous event publishing is disabled.');
            return false;
        }

        const targetRoutingKey = routingKey || this.defaultQueue;
        let connection = null;

        try {
            // Establish a new connection for serverless (Vercel)
            // In a long-running environment, we would use a persistent connection.
            connection = await amqp.connect(this.amqpUrl);
            const channel = await connection.createChannel();

            // Ensure the queue exists
            await channel.assertQueue(targetRoutingKey, {
                durable: true
            });

            const content = Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));

            const properties = {
                contentType: 'application/json',
                deliveryMode: 2, // Persistent
                type: type || (payload && payload.type) || '',
                headers: options.headers || {}
            };

            const published = channel.sendToQueue(targetRoutingKey, content, properties);
            
            if (published) {
                logger.debug(`[RabbitMQ] Published to ${targetRoutingKey}`, { type: properties.type });
                
                // F13-AFA: Hook into system events for AFA Webhooks
                // We use a late require to avoid circular dependency: 
                // supabaseService -> rabbitmq -> afaWebhookService -> supabaseService
                try {
                    const { AfaWebhookService } = require('./afa-webhook-service');
                    const supabaseService = require('./supabase');
                    const afaWebhookService = new AfaWebhookService(supabaseService);
                    
                    // The routingKey is often 'user.ID.type' or 'payments.confirmed'
                    // We extract the type for AFA matching if it's not explicitly provided
                    const eventType = type || (properties.type) || targetRoutingKey;
                    
                    // We need a brandId. If not in payload, we might assume 1 for PoC or try to extract it
                    const brandId = (payload && (payload.brand_id || payload.brandId)) || 1;
                    
                    afaWebhookService.processEvent(eventType, payload, brandId).catch(err => {
                        logger.error('[AFA Hook] Event processing failed', { eventType, error: err.message });
                    });
                } catch (hookErr) {
                    // Silently fail hook to not disrupt core RabbitMQ publishing
                    logger.debug('[AFA Hook] Not available or failed', { error: hookErr.message });
                }
            }

            // Close gracefully
            await channel.close();
            await connection.close();

            return true;
        } catch (error) {
            logger.error('[RabbitMQ] amqplib Publish Failed', {
                message: error.message,
                stack: error.stack
            });

            // Clean up connection if it was opened
            if (connection) {
                try { await connection.close(); } catch (e) { }
            }

            return false;
        }
    }
}

module.exports = new RabbitMQService();
