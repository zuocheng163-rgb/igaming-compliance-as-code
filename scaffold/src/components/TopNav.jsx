import React, { useState } from 'react';
import theme from '../../theme.config';

export const TopNav = ({ player, isAuthenticated, onOpenWallet, onLogout, onLogin }) => {
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <header style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            padding: '12px 40px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(22, 27, 34, 0.8)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            height: '72px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                <h1 style={{ margin: 0, fontSize: '24px', color: theme.colors.primary, fontWeight: 800 }}>
                    {theme.casinoName}
                </h1>
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '24px' }}>
                    <button style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '20px', fontWeight: 'bold' }}>Casino</button>
                    <button style={{ background: 'transparent', color: '#888', border: 'none', padding: '6px 16px', borderRadius: '20px', fontWeight: 'bold' }} disabled>Sport</button>
                </div>
            </div>

            <div style={{ flex: 1, maxWidth: '300px' }}>
                <input 
                    placeholder="Search games..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '10px 16px', borderRadius: '24px', border: 'none', background: 'rgba(0,0,0,0.4)', color: '#fff', outline: 'none' }}
                />
            </div>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                {isAuthenticated ? (
                    <>
                        <button 
                            onClick={onOpenWallet}
                            style={{ padding: '8px 20px', background: theme.colors.primary, color: '#fff', border: 'none', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            + Deposit
                        </button>
                        <div 
                            onClick={onOpenWallet}
                            style={{ width: '40px', height: '40px', borderRadius: '50%', background: theme.colors.secondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontWeight: 'bold' }}
                        >
                            {(player?.username || 'U')[0].toUpperCase()}
                        </div>
                    </>
                ) : (
                    <form onSubmit={onLogin} style={{ display: 'flex', gap: '10px' }}>
                        <input name="username" placeholder="Username" defaultValue="test01" style={{ padding: '8px', borderRadius: '4px', border: 'none', background: 'rgba(0,0,0,0.2)', color: '#fff', width: '120px' }} />
                        <input name="token" placeholder="Token" defaultValue="token-test01" style={{ padding: '8px', borderRadius: '4px', border: 'none', background: 'rgba(0,0,0,0.2)', color: '#fff', width: '120px' }} />
                        <button type="submit" style={{ padding: '8px 20px', background: theme.colors.primary, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Login</button>
                    </form>
                )}
            </div>
        </header>
    );
};
