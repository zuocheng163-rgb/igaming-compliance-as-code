import { useState, useEffect, useRef } from 'react';
import { useNeoStrike } from '../NeoStrikeProvider';

export const useGameLaunch = (gameId, options = {}) => {
    const { client, isConnected } = useNeoStrike();
    const [launchUrl, setLaunchUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const cache = useRef({});

    useEffect(() => {
        if (!gameId || !client || !isConnected) return;

        const mode = options.mode || 'real';
        const cacheKey = `${gameId}-${mode}`;

        if (cache.current[cacheKey]) {
            setLaunchUrl(cache.current[cacheKey]);
            return;
        }

        const fetchLaunch = async () => {
            setIsLoading(true);
            setError(null);
            try {
                if (gameId === 'neostrike-demo') {
                    // C-07 built-in HTML5 game document
                    const localUrl = `/demo-slot.html?mode=${mode}`;
                    setLaunchUrl(localUrl);
                    cache.current[cacheKey] = localUrl;
                } else {
                    const data = await client.getGameLaunchUrl(gameId, { mode, ...options });
                    if (data && data.url) {
                        setLaunchUrl(data.url);
                        cache.current[cacheKey] = data.url;
                    }
                }
            } catch (err) {
                if (err.response?.data?.code === 'DEMO_NOT_SUPPORTED' || err.response?.data?.message?.includes('DEMO_NOT_SUPPORTED')) {
                    setError('DEMO_NOT_SUPPORTED');
                } else {
                    setError(err.message || 'Failed to launch game');
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchLaunch();
    }, [gameId, options.mode, client, isConnected]);

    return { launchUrl, isLoading, error };
};
