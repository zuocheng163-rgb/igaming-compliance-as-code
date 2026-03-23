import React, { useState, useEffect, useRef } from 'react';

const BANNERS = [
    {
        id: 1,
        title: 'NeoStrike Grand Prix',
        subtitle: '€50,000 Tournament — Live Now',
        cta: 'Join Tournament',
        badge: 'LIVE',
        gradient: 'linear-gradient(135deg, #0a2a1a 0%, #0d4a2a 50%, #00E676 200%)',
        emoji: '🏆',
    },
    {
        id: 2,
        title: 'Welcome Bonus',
        subtitle: '100% up to €500 + 200 Free Spins',
        cta: 'Get Bonus',
        badge: 'HOT',
        gradient: 'linear-gradient(135deg, #1a0a2a 0%, #4a0a4a 50%, #8e2de2 200%)',
        emoji: '🎁',
    },
    {
        id: 3,
        title: 'Daily Free Spin',
        subtitle: 'Your spin is ready — claim it now',
        cta: 'Spin Now',
        badge: 'NEW',
        gradient: 'linear-gradient(135deg, #0a1a2a 0%, #0a304a 50%, #40C4FF 200%)',
        emoji: '🎡',
    },
];

const BADGE_COLORS = { LIVE: 'var(--color-error)', HOT: 'var(--color-error)', NEW: 'var(--color-info)' };

export const HeroBanner = () => {
    const [current, setCurrent] = useState(0);
    const [paused, setPaused] = useState(false);
    const intervalRef = useRef(null);

    const goTo = (idx) => setCurrent(idx);
    const next = () => setCurrent(c => (c + 1) % BANNERS.length);

    useEffect(() => {
        if (!paused) {
            intervalRef.current = setInterval(next, 5000);
        }
        return () => clearInterval(intervalRef.current);
    }, [paused, current]);

    return (
        <div
            style={{ position: 'relative', height: 220, borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: 'var(--space-2xl)', cursor: 'pointer' }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            {/* Slides */}
            <div style={{ display: 'flex', width: `${BANNERS.length * 100}%`, height: '100%', transform: `translateX(${-current * (100 / BANNERS.length)}%)`, transition: 'transform 400ms ease-in-out' }}>
                {BANNERS.map(b => (
                    <div key={b.id} style={{ width: `${100 / BANNERS.length}%`, height: '100%', background: b.gradient, display: 'flex', alignItems: 'center', padding: 'var(--space-2xl)', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                        {/* Large emoji watermark */}
                        <div style={{ position: 'absolute', right: 40, top: '50%', transform: 'translateY(-50%)', fontSize: 100, opacity: 0.15, filter: 'blur(2px)' }}>{b.emoji}</div>

                        <div style={{ maxWidth: 480, position: 'relative', zIndex: 1 }}>
                            <span style={{ display: 'inline-block', background: BADGE_COLORS[b.badge], color: '#fff', borderRadius: 'var(--radius-sm)', padding: '2px 10px', fontSize: 11, fontFamily: 'Outfit', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 'var(--space-sm)' }}>{b.badge}</span>
                            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 28, color: 'var(--color-text-primary)', margin: '0 0 8px', lineHeight: 1.2 }}>{b.title}</h2>
                            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: 'var(--color-text-secondary)', margin: '0 0 var(--space-lg)' }}>{b.subtitle}</p>
                            <button style={{ background: 'var(--color-accent)', color: 'var(--color-base)', border: 'none', borderRadius: 'var(--radius-full)', padding: '10px 24px', fontFamily: 'DM Sans', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'background 150ms ease-out' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-accent-dim)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'var(--color-accent)'}
                            >
                                {b.cta} →
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Progress dots */}
            <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, alignItems: 'center' }}>
                {BANNERS.map((_, i) => (
                    <div key={i} onClick={() => goTo(i)} style={{
                        width: current === i ? 24 : 8,
                        height: 8, borderRadius: 'var(--radius-full)',
                        background: current === i ? 'var(--color-accent)' : 'var(--color-text-muted)',
                        transition: 'width 300ms ease-out, background 300ms',
                        cursor: 'pointer',
                    }} />
                ))}
            </div>
        </div>
    );
};
