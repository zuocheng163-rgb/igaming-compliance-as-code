import React, { useState } from 'react';
import { useSession } from '@neostrike/sdk';
import { useBalance } from '@neostrike/sdk/src/hooks/useBalance';

const Icon = ({ path, size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
    </svg>
);

export const HeaderBar = ({ onOpenWallet, onLogin, onLogout, isMobile, onHamburger, player, isAuthenticated }) => {
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchValue, setSearchValue] = useState('');

    const initials = player?.username ? player.username.slice(0, 2).toUpperCase() : '?';

    return (
        <header style={{
            height: 64,
            background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center',
            padding: '0 var(--space-xl)',
            gap: 'var(--space-md)',
            position: 'sticky', top: 0, zIndex: 50,
            flexShrink: 0,
        }}>
            {/* Mobile hamburger */}
            {isMobile && (
                <button onClick={onHamburger} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: 4 }}>
                    <Icon path="M3 12h18M3 6h18M3 18h18" size={22} />
                </button>
            )}

            {/* Search */}
            {searchOpen ? (
                <div style={{ flex: 1, position: 'relative' }}>
                    <input
                        autoFocus
                        value={searchValue}
                        onChange={e => setSearchValue(e.target.value)}
                        onBlur={() => { if (!searchValue) setSearchOpen(false); }}
                        placeholder="Search games…"
                        style={{
                            width: '100%', height: 44,
                            background: 'var(--color-surface-overlay)',
                            border: '1px solid var(--color-accent)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--color-text-primary)',
                            fontFamily: 'DM Sans, sans-serif', fontSize: 14,
                            padding: '0 40px 0 42px', outline: 'none',
                        }}
                    />
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)', pointerEvents: 'none' }}>
                        <Icon path="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" size={16} />
                    </span>
                    {searchValue && (
                        <button onClick={() => { setSearchValue(''); setSearchOpen(false); }} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                            <Icon path="M18 6L6 18M6 6l12 12" size={14} />
                        </button>
                    )}
                </div>
            ) : (
                <button onClick={() => setSearchOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                    <Icon path="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" size={20} />
                </button>
            )}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

        </header>
    );
};
