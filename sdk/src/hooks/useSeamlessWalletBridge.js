import { useEffect } from 'react';
import { useBalance } from './useBalance';

export const useSeamlessWalletBridge = (iframeRef, currentMode = 'real') => {
    const { balance, updateBalance } = useBalance();
    
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

    // Handle incoming messages
    useEffect(() => {
        const handleMessage = (event) => {
            const data = event.data;
            if (!data || !data.type) return;

            if (data.type === 'BALANCE_UPDATE' && currentMode === 'real') {
                updateBalance(data.real, undefined);
            }
            
            if (data.type === 'FT_EVENT') {
                const ftEvent = new CustomEvent('ft-event-feed', { detail: data });
                document.dispatchEvent(ftEvent);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [currentMode, updateBalance]);
};
