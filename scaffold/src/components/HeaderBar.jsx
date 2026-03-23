import React, { useState } from 'react';
import { useSession } from '@neostrike/sdk';
import { useBalance } from '@neostrike/sdk/src/hooks/useBalance';

const Icon = ({ path, size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
    </svg>
);

export const HeaderBar = ({ onOpenWallet, onLogin, onLogout, isMobile, onHamburger }) => {
    const { player, isAuthenticated } = useSession();
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

            {isAuthenticated ? (
                <>
                    {/* Real balance pill */}
                    <div onClick={onOpenWallet} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-surface-raised)', borderRadius: 'var(--radius-full)', padding: '6px 14px', cursor: 'pointer' }}>
                        <span style={{ fontSize: 13 }}>🪙</span>
                        <span id="header-balance" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--color-text-primary)' }}>
                            €{(player?.balance || 0).toFixed(2)}
                        </span>
                    </div>

                    {/* Bonus pill */}
                    <div onClick={onOpenWallet} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-surface-raised)', borderRadius: 'var(--radius-full)', padding: '6px 12px', cursor: 'pointer' }}>
                        <span style={{ fontSize: 13 }}>🎁</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--color-accent)' }}>
                            €{(player?.bonus_balance || 0).toFixed(2)}
                        </span>
                    </div>

                    {/* Deposit CTA */}
                    <button onClick={onOpenWallet} style={{
                        background: 'var(--color-accent)', color: 'var(--color-base)',
                        border: 'none', borderRadius: 'var(--radius-full)',
                        padding: '8px 20px', fontFamily: 'DM Sans, sans-serif',
                        fontWeight: 600, fontSize: 14, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                        transition: 'background 150ms ease-out',
                    }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--color-accent-dim)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--color-accent)'}
                    >
                        ⚡ Deposit
                    </button>

                    {/* Notification bell */}
                    <button style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: 4, position: 'relative' }}>
                        <Icon path="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" size={20} />
                    </button>

                    {/* Live chat */}
                    <button style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: 4 }}>
                        <Icon path="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" size={20} />
                    </button>

                    {/* Avatar */}
                    <div onClick={onOpenWallet} style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'var(--color-surface-overlay)',
                        border: '1px solid var(--color-border-strong)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'Outfit', fontWeight: 700, fontSize: 12,
                        color: 'var(--color-text-primary)', cursor: 'pointer',
                    }}>
                        {initials}
                    </div>

                    <button onClick={onLogout} style={{ background: 'none', border: '1px solid var(--color-border-strong)', color: 'var(--color-text-secondary)', borderRadius: 'var(--radius-md)', padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans' }}>
                        Logout
                    </button>
                </>
            ) : (
                /* Login form */
                <form onSubmit={onLogin} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input name="username" placeholder="Username" defaultValue="test01" style={{ height: 36, background: 'var(--color-surface-overlay)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', padding: '0 12px', fontFamily: 'DM Sans', fontSize: 13, outline: 'none', width: 110 }} />
                    <input name="token" placeholder="Token" defaultValue="" style={{ height: 36, background: 'var(--color-surface-overlay)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)', padding: '0 12px', fontFamily: 'DM Sans', fontSize: 13, outline: 'none', width: 140 }} />
                    <button type="submit" style={{ background: 'var(--color-accent)', color: 'var(--color-base)', border: 'none', borderRadius: 'var(--radius-full)', padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Login</button>
                </form>
            )}
        </header>
    );
};
