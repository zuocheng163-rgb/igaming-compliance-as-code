const InterventionService = require('./intervention');
const ftService = require('./ft-integration');
const { client: supabase } = require('./supabase');
const { generateCorrelationId, logger } = require('./logger');

// In-memory store for sandbox activity (Velocity Spike tracking)
const sandboxLogs = [];
const sandboxBalances = new Map(); // Store balances keyed by user_id

/**
 * SimulatorService
 * Isolated home for all demo-specific logic and mock data.
 * This keeps the core production services (supabase.js, wallet-service.js) clean.
 */
class SimulatorService {

    /**
     * Mock User Data for Demo Mode (FT Compliant)
     */
    static getDemoUser(userIdOrUsername) {
        const username = userIdOrUsername || 'demo_user';
        return {
            // Database IDs
            id: '550e8400-e29b-41d4-a716-446655440000', // Example fixed UUID
            brand_id: 1,
            user_id: username,

            // Core Identity
            username: username,
            first_name: 'Jane',
            last_name: 'Doe',
            email: 'demo@neostrike.io',
            title: 'Ms',
            sex: 'female',
            birth_date: '1992-05-15',

            // Financials
            balance: 1000,
            currency: 'EUR',

            // Localization & Contact
            language: 'en',
            country: 'MT',
            city: 'Sliema',
            address: 'Triq It-Torri 123',
            postal_code: 'SLM 1010',
            mobile: '79123456',
            mobile_prefix: '356',
            full_mobile_number: '35679123456',

            // Operational Metadata
            registration_date: '2026-01-01T12:00:00Z',
            verified_at: '2026-01-01T14:00:00Z',
            origin: 'Web/Direct',
            market: 'International',
            registration_code: 'FASTTRACK2026',
            affiliate_reference: 'AFF_001',
            is_blocked: false,
            is_excluded: false,
            is_enabled: true,
            roles: ['PLAYER']
        };
    }

    /**
     * Force sync the sandbox memory cache from the actual database.
     * Useful when demo features directly modify the database while sandbox is active.
     */
    static async syncBalanceFromDB(uid) {
        if (!uid) return;
        try {
            // In demo environments, user\_id and username are often identical.
            // But we use the robust getUserById to fetch the latest balance securely.
            const user = await supabase.from('users').select('balance, bonus_balance').eq('username', uid).single();
            if (user && user.data) {
                sandboxBalances.set(uid, {
                    amount: parseFloat(user.data.balance || 0),
                    bonus: parseFloat(user.data.bonus_balance || 0)
                });
                logger.info(`[Simulator] Synced sandbox balance for ${uid} from DB`);
            }
        } catch (err) {
            logger.error(`[Simulator] Failed to sync sandbox balance for ${uid}`, err);
        }
    }

    /**
     * Mock Consents (FT Compliant Array Format)
     */
    static getDemoConsents() {
        return [
            { type: 'email', opted_in: true },
            { type: 'sms', opted_in: true },
            { type: 'telephone', opted_in: false },
            { type: 'postMail', opted_in: false },
            { type: 'siteNotification', opted_in: true },
            { type: 'pushNotification', opted_in: true }
        ];
    }

    /**
     * Mock Blocks (FT Compliant Format)
     */
    static getDemoBlocks() {
        return {
            blocks: [
                {
                    active: false,
                    type: 'Blocked',
                    note: 'Account status'
                },
                {
                    active: false,
                    type: 'Excluded',
                    note: 'Self-exclusion status'
                }
            ]
        };
    }

    /**
     * Mock Bonuses (FT Compliant Format)
     */
    static getDemoBonuses() {
        return [
            { bonus_code: 'WELCOME100', name: 'Welcome Bonus 100%', amount: 100 },
            { bonus_code: 'RELOAD50', name: 'Weekend Reload', amount: 50 },
            { bonus_code: 'FREESPIN10', name: '10 Free Spins', amount: 10 }
        ];
    }

    /**
     * Intercepts and handles demo-specific logic for middleware
     */
    static async handleSandboxRequest(req, res) {
        const { method, path: reqPath } = req;
        const path = reqPath.startsWith('/') ? reqPath : '/' + reqPath;
        logger.info(`[Simulator] Incoming: ${method} ${path}`);
        const correlationId = generateCorrelationId();
        const brandId = 1; // Default for demo

        // Helper to get/init balance (fetch from DB if not in memory)
        const getBalance = async (uid) => {
            // ALWAYS try to fetch from database first to ensure we aren't using stale in-memory data
            try {
                let query = supabase.from('users').select('id, balance, bonus_balance');
                if (uid && uid.includes('-')) {
                    query = query.eq('id', uid);
                } else {
                    query = query.eq('username', uid);
                }
                const { data: userData, error } = await query.single();

                if (!error && userData) {
                    const latest = {
                        amount: parseFloat(userData.balance || 0),
                        bonus: parseFloat(userData.bonus_balance || 0),
                        dbId: userData.id
                    };
                    sandboxBalances.set(uid, latest);
                    return latest;
                }
            } catch (err) {
                logger.error('[Simulator] Failed to fetch balance from DB, falling back to cache', err);
            }

            if (!sandboxBalances.has(uid)) {
                sandboxBalances.set(uid, { amount: 1000, bonus: 100 });
            }
            return sandboxBalances.get(uid);
        };

        // 1. Mock User Details: (GET) /api/userdetails/:userid
        const userDetailsMatch = path.match(/\/(?:api\/)?userdetails\/([^\/?#]+)/i);
        if (method === 'GET' && userDetailsMatch) {
            const userId = userDetailsMatch[1];
            logger.info(`[Simulator] Match: UserDetails for ${userId}`);
            res.json(this.getDemoUser(userId));
            return true;
        }

        // 2. Mock Registration: (POST) /api/register
        if (method === 'POST' && (path.endsWith('/register') || path.includes('/register'))) {
            const username = req.body.username || 'demo_user';
            const user = this.getDemoUser(username);
            logger.info(`[Simulator] Match: Registration for ${username}`);
            res.json({
                user_id: user.username,
                token: `token-${username}`,
                user: user
            });
            return true;
        }

        // 3. Mock Profile Update
        if (method === 'POST' && (path.endsWith('/user/update') || path.includes('/user/update'))) {
            logger.info(`[Simulator] Match: User Update`);
            res.json({
                success: true,
                user: {
                    ...req.body,
                    user_id: req.user?.username || 'demo_user',
                    id: req.user?.id || 'demo-uuid'
                }
            });
            return true;
        }

        // 4. Mock Consents: (GET/PUT) /api/userconsents/:userid
        const consentsMatch = path.match(/\/(?:api\/)?userconsents\/([^\/?#]+)/i);
        if (consentsMatch) {
            const userId = consentsMatch[1];
            if (method === 'GET') {
                logger.info(`[Simulator] Match: GET UserConsents for ${userId}`);
                res.json({ consents: this.getDemoConsents() });
            } else if (method === 'PUT') {
                logger.info(`[Simulator] Match: PUT UserConsents for ${userId}`);
                res.json({ success: true });
            }
            return true;
        }

        // 5. Mock Blocks: (GET/PUT) /api/userblocks/:userid
        const blocksMatch = path.match(/\/(?:api\/)?userblocks\/([^\/?#]+)/i);
        if (blocksMatch) {
            const userId = blocksMatch[1];
            if (method === 'GET') {
                logger.info(`[Simulator] Match: GET UserBlocks for ${userId}`);
                res.json(this.getDemoBlocks());
            } else if (method === 'PUT') {
                logger.info(`[Simulator] Match: PUT UserBlocks for ${userId}`);
                res.json({ success: true });
            }
            return true;
        }

        // 6. Mock Bonus List: (GET) /api/bonus/list AND /api/promotions/active
        if (method === 'GET' && (path.includes('/bonus/list') || path.includes('/promotions/active'))) {
            logger.info(`[Simulator] Match: GET Promotions/Bonus List`);

            // Aggressively prevent caching
            res.removeHeader('ETag');
            res.setHeader('Surrogate-Control', 'no-store');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            // Include timestamp to force uniqueness
            const bonuses = this.getDemoBonuses();
            const promoResponse = {
                promotions: bonuses.map(b => ({
                    id: b.bonus_code,
                    name: b.name,
                    description: `Special offer: ${b.amount} EUR matching bonus.`
                })),
                bonuses: bonuses,
                Data: bonuses,
                timestamp: Date.now()
            };
            res.json(promoResponse);
            return true;
        }

        // 7. Mock Debit (Slot Play): (POST) /api/debit
        if (method === 'POST' && (path.endsWith('/debit') || path.includes('/debit'))) {
            const { user_id, amount } = req.body;
            logger.info(`[Simulator] Match: POST Debit for ${user_id}`);

            const bal = await getBalance(user_id);
            const balanceBefore = bal.amount;
            bal.amount -= amount;

            // Track for Velocity Spike
            sandboxLogs.push({ user_id, action: 'debit', timestamp: Date.now() });
            const lastMinute = Date.now() - 60000;
            const recentBets = sandboxLogs.filter(l => l.user_id === user_id && l.action === 'debit' && l.timestamp > lastMinute);

            if (recentBets.length >= 5) {
                logger.warn(`[Simulator] Velocity Spike Detected for ${user_id}`);
                InterventionService.handleRiskDetected(user_id, {
                    riskLevel: 'MEDIUM',
                    reasons: ['isVelocitySpike']
                });
            }

            // Push to FT (Awaited for stability)
            await supabaseService.createTransaction({
                transaction_id: `bet-${Date.now()}`,
                brand_id: brandId,
                user_id: bal.dbId, // Use the actual UUID from the database
                type: 'Bet',
                balance_before: balanceBefore,
                balance_after: bal.amount,
                bonus_balance_before: bal.bonus,
                bonus_balance_after: bal.bonus,
                game_id: 'slot-game-1',
                currency: 'EUR'
            }).catch(e => logger.error('[Simulator] FT Casino Push Failed', e));

            await ftService.pushEvent(user_id, 'balance', {
                amount: bal.amount,
                bonus_amount: bal.bonus,
                currency: 'EUR'
            }, { correlationId, brandId }).catch(e => logger.error('[Simulator] FT Balance Push Failed', e));

            // Sync back to DB if we have a record
            if (bal.dbId) {
                await supabase.from('users').update({ 
                    balance: bal.amount,
                    bonus_balance: bal.bonus 
                }).eq('id', bal.dbId);
            }

            res.json({
                transaction_id: `sandbox-tx-${Date.now()}`,
                balance: bal.amount,
                bonus_balance: bal.bonus,
                currency: 'EUR'
            });
            return true;
        }

        // 8. Mock Bonus Credit: (POST) /api/bonus/credit OR /api/promotions/claim
        if (method === 'POST' && (path.includes('/bonus/credit') || path.includes('/promotions/claim'))) {
            logger.info(`[Simulator] Bonus claim match: ${path}`);
            const { user_id, bonus_code, amount } = req.body;
            const uid = user_id || req.user?.username || 'test01';
            const bcode = bonus_code || 'WELCOME100';
            const bonusAmount = parseFloat(amount || 100);
            logger.info(`[Simulator] Match: POST Bonus Credit for ${uid}, bonus: ${bcode}, amount: ${bonusAmount}`);

            const bal = await getBalance(uid);
            await new Promise(r => setTimeout(r, 50)); // Small delay for replication lag if any
            bal.bonus += bonusAmount;

            // Push FT Bonus Event
            await ftService.pushEvent(user_id, 'bonus', {
                bonus_id: '9821',
                user_bonus_id: `${user_id}-${bonus_code}-${Date.now()}`,
                type: 'WelcomeBonus',
                status: 'Created',
                amount: bonusAmount,
                bonus_code: bonus_code || 'WELCOME100',
                currency: 'EUR',
                product: 'Casino'
            }, { correlationId, brandId }).catch(e => logger.error('[Simulator] FT Bonus Push Failed', e));

            // Persist to Transactions table
            await supabaseService.createTransaction({
                transaction_id: `bon-${Date.now()}`,
                brand_id: brandId,
                user_id: bal.dbId,
                type: 'Bonus',
                amount: bonusAmount,
                status: 'Success',
                currency: 'EUR',
                metadata: { bonus_code: bcode }
            }).catch(e => logger.error('[Simulator] Bonus Transaction Save Failed', e));

            // Push Balance Update
            await ftService.pushEvent(user_id, 'balance', {
                amount: bal.amount,
                bonus_amount: bal.bonus,
                currency: 'EUR'
            }, { correlationId, brandId }).catch(e => logger.error('[Simulator] FT Balance Push Failed', e));

            // Sync back to DB if we have a record
            if (bal.dbId) {
                await supabase.from('users').update({ 
                    balance: bal.amount,
                    bonus_balance: bal.bonus 
                }).eq('id', bal.dbId);
            }

            res.json({
                success: true,
                bonus_balance: bal.bonus,
                balance: bal.amount,
                currency: 'EUR'
            });
            return true;
        }

        // 9. Mock Credit (Slot Win): (POST) /api/credit
        if (method === 'POST' && path.endsWith('/credit')) {
            const { user_id, amount } = req.body;
            logger.info(`[Simulator] Match: POST Credit`);

            const bal = await getBalance(user_id);
            const balanceBefore = bal.amount;
            bal.amount += amount;

            // Push to FT (Awaited for stability)
            await supabaseService.createTransaction({
                transaction_id: `bon-${Date.now()}`,
                brand_id: brandId,
                user_id: bal.dbId, // Use the actual UUID from the database
                type: 'Win',
                balance_before: balanceBefore,
                balance_after: bal.amount,
                bonus_balance_before: bal.bonus,
                bonus_balance_after: bal.bonus,
                game_id: 'slot-game-1',
                currency: 'EUR'
            }, { correlationId, brandId }).catch(e => logger.error('[Simulator] FT Win Push Failed', e));

            await ftService.pushEvent(user_id, 'balance', {
                amount: bal.amount,
                bonus_amount: bal.bonus,
                currency: 'EUR'
            }, { correlationId, brandId }).catch(e => logger.error('[Simulator] FT Balance Push Failed', e));

            // Sync back to DB if we have a record
            if (bal.dbId) {
                await supabase.from('users').update({ 
                    balance: bal.amount,
                    bonus_balance: bal.bonus 
                }).eq('id', bal.dbId);
            }

            res.json({
                transaction_id: `sandbox-win-${Date.now()}`,
                balance: bal.amount,
                bonus_balance: bal.bonus,
                currency: 'EUR'
            });
            return true;
        }

        // 9. Mock Deposit: (POST) /api/deposit
        if (method === 'POST' && (path.endsWith('/deposit') || path.includes('/deposit')) && !path.includes('/v1/demo/')) {
            const { user_id, amount } = req.body;
            const depositAmount = parseFloat(amount || 100);
            logger.info(`[Simulator] Match: POST Deposit for ${user_id}, amount: ${depositAmount}`);


            const bal = await getBalance(user_id);
            const balanceBefore = bal.amount;
            bal.amount += depositAmount;

            // Push to FT (Awaited for stability)
            await ftService.pushEvent(user_id, 'payment', {
                transaction_id: `sb-deposit-${Date.now()}`,
                amount: depositAmount,
                status: 'Approved',
                currency: 'EUR'
            }, { correlationId, brandId }).catch(e => logger.error('[Simulator] FT Payment Push Failed', e));

            // Persist to Transactions table
            await supabaseService.createTransaction({
                transaction_id: `dep-${Date.now()}`,
                brand_id: brandId,
                user_id: bal.dbId,
                type: 'Deposit',
                amount: depositAmount,
                status: 'Success',
                currency: 'EUR'
            }).catch(e => logger.error('[Simulator] Deposit Transaction Save Failed', e));

            await ftService.pushEvent(user_id, 'balance', {
                amount: bal.amount,
                bonus_amount: bal.bonus,
                currency: 'EUR'
            }, { correlationId, brandId }).catch(e => logger.error('[Simulator] FT Balance Push Failed', e));

            // Sync back to DB if we have a record
            if (bal.dbId) {
                await supabase.from('users').update({ 
                    balance: bal.amount,
                    bonus_balance: bal.bonus 
                }).eq('id', bal.dbId);
            }

            res.json({
                success: true,
                transaction_id: `sandbox-deposit-${Date.now()}`,
                balance: bal.amount,
                bonus_balance: bal.bonus,
                currency: 'EUR'
            });
            return true;
        }

        // 10. Mock Balance: (GET) /api/balance
        if (method === 'GET' && (path.endsWith('/balance') || path.includes('/balance'))) {
            const userId = req.query?.user_id || req.user?.username || 'demo_user';
            const bal = await getBalance(userId);

            // Prevent caching to ensure fresh balance data
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');

            res.json({
                amount: bal.amount,
                bonus_amount: bal.bonus,
                currency: 'EUR',
                balance: bal.amount,
                bonus_balance: bal.bonus
            });
            return true;
        }

        return false;
    }
}

module.exports = SimulatorService;
