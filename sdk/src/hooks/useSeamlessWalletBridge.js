import { useEffect, useCallback } from 'react';
import { useNeoStrike } from '../NeoStrikeProvider';

export const useSeamlessWalletBridge = (iframeRef, currentMode = 'real') => {
    const { balance, client, pollBalance } = useNeoStrike();
    
    // Send mode change
    useEffect(() => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
                type: 'MODE_CHANGE',
                demo: currentMode === 'demo'
            }, '*');
        }
    }, [currentMode, iframeRef]);

    // Send balance sync
    useEffect(() => {
        if (iframeRef.current && iframeRef.current.contentWindow && currentMode === 'real') {
            iframeRef.current.contentWindow.postMessage({
                type: 'BALANCE_SYNC',
                real: balance
            }, '*');
        }
    }, [balance, currentMode, iframeRef]);

    const performUpdate = useCallback(async (amount, winAmount) => {
        try {
            if (winAmount > 0) {
                await client.credit(winAmount);
            } else if (amount > 0) {
                await client.debit(amount);
            }
            await pollBalance();
        } catch (err) {
            console.error('[SeamlessBridge] Update failed', err);
        }
    }, [client, pollBalance]);

    // Handle incoming messages
    useEffect(() => {
        const handleMessage = (event) => {
            const data = event.data;
            if (!data || !data.type) return;

            if (data.type === 'BALANCE_UPDATE' && currentMode === 'real') {
                performUpdate(data.real, data.win);
            }
            
            if (data.type === 'FT_EVENT') {
                const ftEvent = new CustomEvent('ft-event-feed', { detail: data });
                document.dispatchEvent(ftEvent);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [currentMode, performUpdate]);
};
