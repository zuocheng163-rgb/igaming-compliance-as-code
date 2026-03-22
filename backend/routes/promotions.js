const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase');
const WalletService = require('../services/wallet-service');
const { logger } = require('../services/logger');
const { correlationMiddleware, authenticateRequest } = require('../middleware/auth');

router.use(correlationMiddleware);

/**
 * GET /api/promotions/active
 * Returns all active promotions for the brand.
 */
router.get('/active', async (req, res) => {
    try {
        const promotions = await supabaseService.getActivePromotions(1); // Default brand 1
        res.json({ promotions });
    } catch (error) {
        logger.error('[Promotions API] Failed to fetch active promotions', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch active promotions' });
    }
});

/**
 * POST /api/promotions/claim
 * Claims a bonus for the player.
 */
router.post('/claim', authenticateRequest, async (req, res) => {
    const { bonus_code, amount } = req.body;
    const userId = req.user?.id;

    if (!userId) {
        logger.warn('[Promotions API] Claim attempt without userId', { body: req.body });
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const result = await WalletService.creditBonus(
            userId,
            amount || 100,
            bonus_code || 'WELCOME100',
            req.brandId || req.user?.brand_id || 1
        );
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('[Promotions API] Failed to claim bonus', { error: error.message, userId, bonus_code });
        res.status(500).json({ error: error.message || 'Failed to claim bonus' });
    }
});

module.exports = router;
