import { useState, useEffect, useCallback } from 'react';
import { useNeoStrike } from '../NeoStrikeProvider';

export const useActivePromotions = () => {
    const { client } = useNeoStrike();
    const [promotions, setPromotions] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchPromotions = useCallback(async () => {
        setLoading(true);
        try {
            const data = await client.getActivePromotions();
            setPromotions(data.promotions || []);
        } catch (err) {
            console.error('[NeoStrike SDK] Failed to fetch promotions', err);
        } finally {
            setLoading(false);
        }
    }, [client]);

    useEffect(() => {
        fetchPromotions();
    }, [fetchPromotions]);

    const claimBonus = async (bonusCode, amount) => {
        setLoading(true);
        try {
            const result = await client.claimBonus(bonusCode, amount);
            fetchPromotions(); // Refresh after claim
            return result;
        } catch (err) {
            console.error('[NeoStrike SDK] Failed to claim bonus', err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { promotions, loading, refresh: fetchPromotions, claimBonus };
};
