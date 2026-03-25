const express = require('express');
const router = express.Router();
const { logger, auditLog } = require('../services/logger');
const ftService = require('../services/ft-integration');
const rabbitmq = require('../services/rabbitmq');
const WalletService = require('../services/wallet-service');
const supabaseService = require('../services/supabase');

// Mock payment methods configuration
const PAYMENT_METHODS = {
    deposit: [
        { id: 'card', name: 'Credit/Debit Card', type: 'card', icon: 'CreditCard' },
        { id: 'bank_transfer', name: 'Bank Transfer', type: 'bank', icon: 'BuildingLibrary' },
        { id: 'e_wallet', name: 'E-Wallet (PayPal, Skrill)', type: 'wallet', icon: 'Wallet' },
        { id: 'crypto', name: 'Cryptocurrency', type: 'crypto', icon: 'CurrencyDollar' }
    ],
    withdrawal: [
        { id: 'bank_transfer', name: 'Bank Transfer', type: 'bank', icon: 'BuildingLibrary' },
        { id: 'e_wallet', name: 'E-Wallet', type: 'wallet', icon: 'Wallet' }
    ]
};

/**
 * GET /api/v1/payments/methods
 * Fetch available payment methods for deposit or withdrawal
 */
router.get('/methods', async (req, res) => {
    try {
        const { type } = req.query; // 'deposit' or 'withdrawal'
        const methods = PAYMENT_METHODS[type] || PAYMENT_METHODS.deposit;
        
        res.json({ methods });
    } catch (error) {
        logger.error('[Payments API] Error fetching methods', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/v1/payments/submit
 * Submit a deposit or withdrawal request
 */
router.post('/submit', async (req, res) => {
    try {
        const { type, amount, method, user_id } = req.body;
        const brandId = req.headers['x-brand-id'] || 1;
        const correlationId = req.headers['x-correlation-id'] || `req-${Date.now()}`;

        if (!user_id || !amount || !type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        let result;

        if (type === 'deposit') {
            result = await WalletService.deposit(
                user_id, 
                numericAmount, 
                method || 'card', 
                brandId, 
                correlationId
            );
        } else if (type === 'withdrawal') {
            // Withdrawal logic - since WalletService doesn't have a specific withdraw yet,
            // we will simulate a withdrawal by checking KYC and then debiting
            const user = await supabaseService.getUserById(user_id);
            if (!user) throw new Error('USER_NOT_FOUND');
            
            // Re-use checkKycGating logic manually for withdrawal testing
            if (user.wallet_blocked) throw new Error('PLAYER_BLOCKED');
            if (user.kyc_status !== 'VERIFIED') throw new Error('KYC_REQUIRED');

            if ((user.balance || 0) < numericAmount) {
                throw new Error('INSUFFICIENT_FUNDS');
            }

            // Manually debit for mock withdrawal if no wallet service method exists
            const transactionId = `wd-${Date.now()}`;
            const newBalance = user.balance - numericAmount;
            await supabaseService.updateUser(user.id, { balance: newBalance });
            
            await supabaseService.createTransaction({
                transaction_id: transactionId,
                brand_id: brandId,
                user_id: user.id,
                type: 'WITHDRAWAL',
                status: 'success',
                amount: -numericAmount,
                currency: user.currency,
                metadata: { correlationId, method }
            });

            // 1. Audit log: persist to platform_audit_logs
            await auditLog({
                correlationId,
                brandId,
                actor_id: user.user_id || user_id,
                action: 'wallet:withdrawal',
                entity_type: 'transaction',
                entity_id: transactionId,
                message: `Withdrawal of ${numericAmount} ${user.currency} processed`,
                metadata: { method, balance_before: user.balance, balance_after: newBalance }
            });

            // 2. FT / RabbitMQ: send the withdrawal transaction event
            await ftService.pushEvent(user.user_id || user_id, 'withdrawal', {
                amount: numericAmount,
                transaction_id: transactionId,
                currency: user.currency,
                status: 'Approved',
                type: 'Debit',
                vendor_id: method || 'bank_transfer'
            }, { correlationId, brandId });

            // 2.2 FT: follow-up balance update event for FastTrack sync
            await ftService.pushEvent(user.user_id || user_id, 'balance', {
                balances: [
                    { amount: newBalance, currency: user.currency, key: 'real_money', exchange_rate: 1 },
                    { amount: user.bonus_balance || 0, currency: user.currency, key: 'bonus_money', exchange_rate: 1 }
                ]
            }, { correlationId, brandId }).catch(e => logger.error('[Payments API] FT Balance Push Failed', e));

            // 3. RabbitMQ: follow-up balance update event
            await rabbitmq.publishEvent(`user.${user_id}.balance`, {
                type: 'balance_update',
                balance: newBalance,
                bonus_balance: user.bonus_balance || 0,
                currency: user.currency,
                userId: user_id
            });

            result = {
                transaction_id: transactionId,
                balance: newBalance,
                currency: user.currency,
                message: 'Withdrawal processed successfully'
            };
        } else {
            return res.status(400).json({ error: 'Invalid payment type' });
        }

        res.json(result);
    } catch (error) {
        logger.error(`[Payments API] Submit Failed`, { error: error.message });
        
        const statusCode = error.message.includes('NOT_FOUND') ? 404 
                         : error.message.includes('BLOCKED') || error.message.includes('REQUIRED') ? 403 
                         : error.message.includes('INSUFFICIENT_FUNDS') ? 400 
                         : 500;
                         
        res.status(statusCode).json({ error: error.message });
    }
});

module.exports = router;
