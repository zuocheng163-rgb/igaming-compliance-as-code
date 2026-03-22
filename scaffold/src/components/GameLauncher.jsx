import React, { useState, useRef } from 'react';
import { useSeamlessWalletBridge, useSession } from '@neostrike/sdk';
import { logSDKEvent } from '@neostrike/sdk/src/utils';
import theme from '../../theme.config';

const MockGame = ({ game, onClose }) => {
    const [balance, setBalance] = useState(1000);
    const [lastWin, setLastWin] = useState(0);
    const [isSpinning, setIsSpinning] = useState(false);

    const handleSpin = () => {
        if (balance < 10) return;
        setIsSpinning(true);
        setLastWin(0);

        logSDKEvent('WALLET', `Simulation: Bet placed -10.00 EUR`, { gameId: game.id });
        setBalance(prev => prev - 10);

        setTimeout(() => {
            const win = Math.random() > 0.7 ? Math.floor(Math.random() * 50) + 10 : 0;
            if (win > 0) {
                setLastWin(win);
                setBalance(prev => prev + win);
                logSDKEvent('WALLET', `Simulation: Win credited +${win.toFixed(2)} EUR`);
            }
            setIsSpinning(false);
            logSDKEvent('SDK', 'Spin cycle complete');
        }, 800);
    };

    const triggerAlert = () => {
        logSDKEvent('INTERVENTION', 'Simulating Responsible Gaming Alert (Time Limit)');
        // In a real scenario, the backend would push this
        window.dispatchEvent(new CustomEvent('neostrike-simulate-alert', {
            detail: {
                title: 'Play Break Reminder',
                message: 'You have been playing for 60 minutes. Would you like to take a short break?',
                severity: 'info'
            }
        }));
    };

    return (
        <div style={{
            flex: 1, background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: '#fff', position: 'relative'
        }}>
            <div style={{
                padding: '40px', borderRadius: '24px', background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', width: '400px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
            }}>
                <div style={{ fontSize: '14px', color: '#888', marginBottom: '20px' }}>NEOSTRIKE SIMULATION ENGINE</div>
                <h2 style={{ fontSize: '32px', margin: '0 0 10px 0' }}>{game.name}</h2>
                <div style={{ fontSize: '48px', fontWeight: 'bold', margin: '30px 0', color: theme.colors.primary }}>
                    {balance.toFixed(2)} <span style={{ fontSize: '18px' }}>EUR</span>
                </div>

                {lastWin > 0 && (
                    <div style={{
                        color: '#00ff88', fontWeight: 'bold', fontSize: '24px',
                        marginBottom: '20px', animation: 'bounce 0.5s infinite'
                    }}>
                        BIG WIN: +{lastWin.toFixed(2)}!
                    </div>
                )}

                <button
                    onClick={handleSpin}
                    disabled={isSpinning || balance < 10}
                    style={{
                        padding: '20px 60px', borderRadius: '40px', background: theme.colors.primary,
                        color: '#fff', border: 'none', fontSize: '24px', fontWeight: 'bold',
                        cursor: 'pointer', boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
                        transition: 'transform 0.1s'
                    }}
                    onMouseDown={(e) => e.target.style.transform = 'scale(0.95)'}
                    onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
                >
                    {isSpinning ? 'SPINNING...' : 'SPIN (10 EUR)'}
                </button>

                <div style={{ marginTop: '40px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button
                        onClick={triggerAlert}
                        style={{
                            padding: '10px 20px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)',
                            color: '#ccc', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '12px'
                        }}
                    >
                        Simulate RG Alert
                    </button>
                </div>
            </div>

            <div style={{ position: 'absolute', bottom: '20px', color: '#555', fontSize: '11px' }}>
                This is a simulated game environment for SDK feature demonstration only.
            </div>
        </div>
    );
};

export const GameLauncher = ({ game, launchUrl, onClose, currentMode = 'real' }) => {
    const iframeRef = useRef(null);
    useSeamlessWalletBridge(iframeRef, currentMode);
    const { timePlayed } = useSession();

    if (!game) return null;

    const formatTime = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        return `${m}m ${s}s`;
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: '#0a0a0f', zIndex: 10000, display: 'flex', flexDirection: 'column'
        }}>
            {/* Immersive Top Bar */}
            <div style={{
                padding: '12px 24px', background: 'linear-gradient(90deg, #1a1a2e 0%, #16213e 100%)', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
                        padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
                        transition: 'background 0.2s'
                    }} onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.2)'} onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.1)'}>
                        ← CLOSE GAME
                    </button>
                    <div>
                        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '18px' }}>{game.name}</span>
                        <span style={{ color: '#888', fontSize: '12px', marginLeft: '12px', textTransform: 'uppercase' }}>{game.provider.split(':')[0]}</span>
                    </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    {/* RG Active Session Clock */}
                    <div style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px', 
                        background: 'rgba(0,0,0,0.5)', padding: '6px 16px', borderRadius: '20px',
                        border: timePlayed > 3000 ? '1px solid #ff4444' : '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <span style={{ fontSize: '14px' }}>⏱️</span>
                        <span style={{ color: timePlayed > 3000 ? '#ff4444' : '#fff', fontSize: '13px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                            {formatTime(timePlayed)}
                        </span>
                    </div>

                    <div style={{
                        color: launchUrl ? '#00ff88' : '#ffaa00',
                        fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px',
                        padding: '6px 14px', background: 'rgba(0,0,0,0.4)', borderRadius: '20px',
                        border: `1px solid ${launchUrl ? '#00ff8833' : '#ffaa0033'}`
                    }}>
                        {launchUrl ? 'LIVE SESSION ACTIVE' : 'SIMULATION MODE'}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Embedded Game Iframe / MockGame */}
                <div style={{ flex: 1, background: '#000', position: 'relative' }}>
                    {launchUrl ? (
                        <iframe ref={iframeRef} src={launchUrl} title={game.name} style={{ display: 'block', width: '100%', height: '100%', border: 'none' }} allowFullScreen />
                    ) : (
                        <MockGame game={game} onClose={onClose} />
                    )}
                </div>

                {/* Right Sidebar */}
                <div style={{ 
                    width: '340px', background: '#13131e', borderLeft: '1px solid rgba(255,255,255,0.05)', 
                    display: 'flex', flexDirection: 'column' 
                }}>
                    {/* Loyalty Rank Status */}
                    <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontSize: '12px', color: '#888', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '16px' }}>LOYALTY RANK</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                            <div style={{ 
                                width: '56px', height: '56px', borderRadius: '50%', 
                                background: 'linear-gradient(135deg, #FFD700, #FDB931)', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                fontSize: '28px', boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)' 
                            }}>
                                💎
                            </div>
                            <div>
                                <div style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '20px', textShadow: '0 0 10px rgba(255, 215, 0, 0.3)' }}>Gold Tier</div>
                                <div style={{ color: '#aaa', fontSize: '13px', marginTop: '2px' }}>2,450 XP</div>
                            </div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.5)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: '75%', height: '100%', background: 'linear-gradient(90deg, #FFD700, #FDB931)', boxShadow: '0 0 10px #FFD700' }}></div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '10px', textAlign: 'right' }}>550 XP to Platinum</div>
                    </div>

                    {/* Recommended Games Cross-Sell */}
                    <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                        <div style={{ fontSize: '12px', color: '#888', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '20px' }}>RECOMMENDED FOR YOU</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {[
                                { name: 'Gates of Olympus', emoji: '🏛️', prov: 'Pragmatic' },
                                { name: 'Lightning Roulette', emoji: '🎡', prov: 'Evolution' },
                                { name: 'Starburst', emoji: '💎', prov: 'NetEnt' }
                            ].map((g, i) => (
                                <div 
                                    key={i} 
                                    style={{ 
                                        display: 'flex', gap: '14px', padding: '12px', 
                                        background: 'rgba(255,255,255,0.03)', borderRadius: '12px', 
                                        cursor: 'pointer', transition: 'all 0.2s', border: '1px solid rgba(255,255,255,0.02)'
                                    }} 
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'translateX(-4px)'; }} 
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'translateX(0)'; }}
                                >
                                    <div style={{ 
                                        width: '64px', height: '64px', borderRadius: '10px', 
                                        background: `hsl(${i * 60 + 260}, 60%, 25%)`, 
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' 
                                    }}>
                                        {g.emoji}
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>{g.name}</div>
                                        <div style={{ color: '#888', fontSize: '12px', textTransform: 'uppercase' }}>{g.prov}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

