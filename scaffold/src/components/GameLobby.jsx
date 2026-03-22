import React, { useState, useEffect } from 'react';
import { useGames, useSession, useFavourites, useRecentlyPlayed, useGameLaunch, LobbyCarousel } from '@neostrike/sdk';
import { logSDKEvent } from '@neostrike/sdk/src/utils';
import { GameLauncher } from './GameLauncher';
import theme from '../../theme.config';

// Shared per-game visual identity (Synced with Operator Portal)
const GAME_THEMES = {
    'evolution:lightning-roulette': { emoji: '🎡', gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #b8860b 100%)' },
    'evolution:crazy-time': { emoji: '🎪', gradient: 'linear-gradient(135deg, #6a0dad 0%, #c70039 60%, #ff5733 100%)' },
    'pragmatic:gates-of-olympus': { emoji: '🏛️', gradient: 'linear-gradient(135deg, #0f3460 0%, #533483 60%, #e94560 100%)' },
    'pragmatic:sweet-bonanza': { emoji: '🍭', gradient: 'linear-gradient(135deg, #c0392b 0%, #e67e22 60%, #f1c40f 100%)' },
    'pragmatic:wolf-gold': { emoji: '🐺', gradient: 'linear-gradient(135deg, #0d0d0d 0%, #1c1c3a 60%, #b8860b 100%)' },
    'netent:starburst': { emoji: '💎', gradient: 'linear-gradient(135deg, #4a00e0 0%, #8e2de2 60%, #00c6ff 100%)' },
    'netent:gonzos-quest': { emoji: '🌴', gradient: 'linear-gradient(135deg, #134e5e 0%, #11998e 60%, #b8860b 100%)' },
    'netent:divine-fortune': { emoji: '🐴', gradient: 'linear-gradient(135deg, #8B0000 0%, #4b134f 60%, #b8860b 100%)' },
};

const GameCard = ({ game, onLaunch, isFavourite, onToggleFavourite }) => {
    const theme_ = GAME_THEMES[game.id] || { emoji: '🎮', gradient: 'linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%)' };
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className="game-card"
            style={{
                background: 'linear-gradient(145deg, #1e1e2d 0%, #161625 100%)',
                borderRadius: '12px',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: '1px solid rgba(255,255,255,0.05)',
                position: 'relative'
            }}
            onMouseEnter={(e) => {
                setIsHovered(true);
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.borderColor = theme.colors.primary;
                e.currentTarget.style.boxShadow = `0 10px 20px ${theme.colors.primary}22`;
            }}
            onMouseLeave={(e) => {
                setIsHovered(false);
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            <div 
                style={{ height: '140px', background: theme_.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '50px', position: 'relative' }}
                onClick={() => onLaunch(game)}
            >
                <span>{theme_.emoji}</span>
                {!isHovered && (
                    <div style={{ position: 'absolute', top: '10px', right: '10px', padding: '4px 8px', borderRadius: '4px', background: 'rgba(0,0,0,0.6)', fontSize: '10px', color: '#fff', fontWeight: 'bold' }}>
                        {game.provider.split(':')[0].toUpperCase()}
                    </div>
                )}
                
                {isHovered && (
                    <div style={{
                        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: '8px', backdropFilter: 'blur(4px)', zIndex: 5
                    }}>
                        <div style={{ fontSize: '12px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                            {game.provider.split(':')[0]}
                        </div>
                        <div style={{ display: 'flex', gap: '20px', marginTop: '12px' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>RTP</div>
                                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#00ff88' }}>{game.rtp || '96.5%'}</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>MAX WIN</div>
                                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#ffb700' }}>{game.max_multiplier || '10,000x'}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Favourite Toggle */}
            <button
                onClick={(e) => { e.stopPropagation(); onToggleFavourite(game.id); }}
                style={{
                    position: 'absolute', top: '10px', left: '10px',
                    background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
                    width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', zIndex: 10, transition: 'all 0.2s', padding: 0
                }}
            >
                <span style={{ fontSize: '18px', color: isFavourite(game.id) ? '#ff4d4d' : 'white' }}>
                    {isFavourite(game.id) ? '❤️' : '🤍'}
                </span>
            </button>

            <div style={{ padding: '15px' }} onClick={() => onLaunch(game)}>
                <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {game.name}
                </div>
                <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {game.category?.replace('-', ' ') || 'Classic Slot'}
                </div>
            </div>
        </div>
    );
};

const CATEGORIES = ['All Games', 'Slots', 'Live Casino', 'Table Games'];
const MECHANICS = ['Megaways', 'Bonus Buy', 'Drops & Wins'];

const CategoryNav = ({ activeCategory, onSelectCategory, activeMechanic, onSelectMechanic }) => (
    <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '12px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {CATEGORIES.map(cat => {
                const navKey = cat === 'All Games' ? 'all' : cat.toLowerCase().replace(' ', '-');
                const isActive = activeCategory === navKey || (!activeCategory && navKey === 'all');
                
                return (
                    <button 
                        key={cat}
                        onClick={() => onSelectCategory(navKey)}
                        style={{
                            padding: '10px 24px', borderRadius: '24px', border: 'none', cursor: 'pointer',
                            whiteSpace: 'nowrap', fontWeight: 'bold', fontSize: '14px',
                            background: isActive ? theme.colors.primary : 'rgba(255,255,255,0.05)',
                            color: '#fff', transition: 'all 0.2s'
                        }}
                    >
                        {cat}
                    </button>
                );
            })}
        </div>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {MECHANICS.map(mech => (
                <button
                    key={mech}
                    onClick={() => onSelectMechanic(activeMechanic === mech ? null : mech)}
                    style={{
                        padding: '8px 20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                        whiteSpace: 'nowrap', fontSize: '13px', fontWeight: '500',
                        background: activeMechanic === mech ? 'rgba(255,255,255,0.15)' : 'transparent',
                        color: activeMechanic === mech ? '#fff' : '#aaa', transition: 'all 0.2s'
                    }}
                >
                    {mech}
                </button>
            ))}
        </div>
    </div>
);

export const GameLobby = () => {
    const { player, isAuthenticated } = useSession();
    const { games, loading, error, search, filter, loadMore, total, filters } = useGames();
    const { favourites, isFavourite, toggleFavourite } = useFavourites();
    const { games: recentlyPlayed } = useRecentlyPlayed();
    const [selectedGame, setSelectedGame] = useState(null);
    const [activeMechanic, setActiveMechanic] = useState(null);

    const mode = isAuthenticated ? 'real' : 'demo';
    const { launchUrl, isLoading: isLaunching, error: launchError } = useGameLaunch(selectedGame?.id, { mode });

    useEffect(() => {
        if (launchError && launchError === 'DEMO_NOT_SUPPORTED') {
            logSDKEvent('UI', 'Demo mode not supported by provider, falling back to mock game');
        } else if (launchUrl) {
            logSDKEvent('SDK', 'Game launch URL received', { url: launchUrl });
        }
    }, [launchUrl, launchError]);

    const handleCategorySelect = (cat) => {
        filter({ category: cat });
    };

    const handleMechanicSelect = (mech) => {
        setActiveMechanic(mech);
        if (mech) filter({ tags: mech });
        else filter({ tags: null });
    };

    const handleLaunch = (game) => {
        logSDKEvent('UI', `Attempting to launch game: ${game.name}...`);
        setSelectedGame(game);
    };

    return (
        <div className="game-lobby" style={{ padding: '0 40px 40px' }}>
            {/* Category and Mechanic Navigation */}
            <CategoryNav 
                activeCategory={filters.category}
                onSelectCategory={handleCategorySelect}
                activeMechanic={activeMechanic}
                onSelectMechanic={handleMechanicSelect}
            />

            {/* SDK Carousels */}
            {recentlyPlayed.length > 0 && (
                <LobbyCarousel title="Continue Playing" games={recentlyPlayed} onLaunch={handleLaunch} />
            )}
            
            {favourites.length > 0 && (
                <LobbyCarousel title="Your Favourites" games={favourites} onLaunch={handleLaunch} />
            )}

            {/* Results Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '40px 0 20px' }}>
                <h2 style={{ margin: 0, fontSize: '20px' }}>Game Catalog</h2>
                <span style={{ color: '#666', fontSize: '14px' }}>Showing {games.length} of {total} games</span>
            </div>

            {/* Error State */}
            {error && (
                <div style={{
                    padding: '20px', background: '#ff444422', border: '1px solid #ff4444',
                    borderRadius: '8px', color: '#ff4444', marginBottom: '20px'
                }}>
                    <strong>Load Error:</strong> {error}
                </div>
            )}

            {/* Games Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '24px'
            }}>
                {games.map(game => (
                    <GameCard 
                        key={game.id} 
                        game={game} 
                        onLaunch={handleLaunch}
                        isFavourite={isFavourite}
                        onToggleFavourite={toggleFavourite}
                    />
                ))}
            </div>

            {/* Loading / Infinite Scroll */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
                {loading ? (
                    <div className="spinner" style={{ color: theme.colors.primary }}>Loading...</div>
                ) : games.length < total && (
                    <button
                        onClick={loadMore}
                        style={{
                            padding: '12px 40px', borderRadius: '8px',
                            background: 'transparent', color: theme.colors.primary,
                            border: `2px solid ${theme.colors.primary}`,
                            cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.background = theme.colors.primary;
                            e.target.style.color = '#fff';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = 'transparent';
                            e.target.style.color = theme.colors.primary;
                        }}
                    >
                        Load More Games
                    </button>
                )}
            </div>

            {/* Launch Overlay */}
            {selectedGame && (
                <GameLauncher
                    game={selectedGame}
                    launchUrl={(launchError === 'DEMO_NOT_SUPPORTED') ? null : launchUrl} /* Fallback to mock game */
                    currentMode={mode}
                    onClose={() => setSelectedGame(null)}
                />
            )}
        </div>
    );
};

