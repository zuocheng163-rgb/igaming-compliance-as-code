import React, { useState, useEffect } from 'react';
import theme from '../../theme.config';

export const FastTrackFeed = () => {
    const [events, setEvents] = useState([]);

    useEffect(() => {
        const handleFtEvent = (e) => {
            const data = e.detail;
            if (data && data.type === 'FT_EVENT') {
                const newEvent = {
                    id: Date.now() + Math.random(),
                    message: data.detail,
                    event: data.event,
                    amount: data.amount
                };
                
                setEvents((prev) => [...prev, newEvent]);

                // Auto dismiss after 5 seconds
                setTimeout(() => {
                    setEvents((prev) => prev.filter(ev => ev.id !== newEvent.id));
                }, 5000);
            }
        };

        document.addEventListener('ft-event-feed', handleFtEvent);
        return () => document.removeEventListener('ft-event-feed', handleFtEvent);
    }, []);

    if (events.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            left: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 1000,
            maxWidth: '300px'
        }}>
            {events.map((ev) => (
                <div 
                    key={ev.id}
                    style={{
                        background: 'rgba(22, 27, 34, 0.95)',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderLeft: `4px solid ${ev.event === 'WIN' ? theme.colors.secondary : theme.colors.primary}`,
                        padding: '12px 16px',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '13px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        animation: 'slideIn 0.3s ease-out'
                    }}
                >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '11px', color: '#888' }}>
                        FAST TRACK {ev.event}
                    </div>
                    <div>{ev.message}</div>
                </div>
            ))}
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(-100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};
