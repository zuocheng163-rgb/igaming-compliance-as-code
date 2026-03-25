import React, { useState, useEffect, useCallback } from 'react';
import { useGames, useSession, useFavourites, useRecentlyPlayed, useGameLaunch, LobbyCarousel } from '@neostrike/sdk';
import { logSDKEvent } from '@neostrike/sdk/src/utils';
import { GameLauncher } from './GameLauncher';
import { HeroBanner } from './HeroBanner';
import { LiveWinsTicker } from './LiveWinsTicker';

// ── F12-A Compliant Game Card ────────────────────────────────────
const GAME_THEMES = {
    'evolution:lightning-roulette': { emoji: '🎡', gradient: 'linear-gradient(135deg, #1a1a2e, #16213e, #b8860b)' },
    'evolution:crazy-time':         { emoji: '🎪', gradient: 'linear-gradient(135deg, #6a0dad, #c70039, #ff5733)' },
    'pragmatic:gates-of-olympus':   { emoji: '🏛️', gradient: 'linear-gradient(135deg, #0f3460, #533483, #e94560)' },
    'pragmatic:sweet-bonanza':      { emoji: '🍭', gradient: 'linear-gradient(135deg, #c0392b, #e67e22, #f1c40f)' },
    'pragmatic:wolf-gold':          { emoji: '🐺', gradient: 'linear-gradient(135deg, #0d0d0d, #1c1c3a, #b8860b)' },
    'netent:starburst':             { emoji: '💎', gradient: 'linear-gradient(135deg, #4a00e0, #8e2de2, #00c6ff)' },
    'netent:gonzos-quest':          { emoji: '🌴', gradient: 'linear-gradient(135deg, #134e5e, #11998e, #b8860b)' },
    'netent:divine-fortune':        { emoji: '🐴', gradient: 'linear-gradient(135deg, #8B0000, #4b134f, #b8860b)' },
    'neostrike-demo':               { emoji: '🚀', gradient: 'linear-gradient(135deg, #003d99, #0055cc, #00E676)' },
};

const BADGE_LABELS = { 'neostrike-demo': 'NEW', 'evolution:crazy-time': 'HOT', 'pragmatic:gates-of-olympus': 'HOT' };
const BADGE_COLORS = { NEW: '#40C4FF', HOT: '#FF5252', ALL: '#00E676' };

const GameCard = ({ game, onLaunch, isFavourite, onToggleFavourite }) => {
    const t = GAME_THEMES[game.id] || { emoji: '🎮', gradient: 'linear-gradient(135deg, var(--color-surface), var(--color-surface-raised))' };
    const [hovered, setHovered] = useState(false);
    const badge = BADGE_LABELS[game.id];
    const provider = game.provider?.split(':')[0] || 'Unknown';

    return (
        <div
            style={{
                aspectRatio: '3/4',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                cursor: 'pointer',
                position: 'relative',
                background: t.gradient,
                transform: hovered ? 'scale(1.04)' : 'scale(1)',
                transition: 'transform 200ms ease-out',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => onLaunch(game)}
        >
            {/* Thumbnail / emoji */}
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>
                {t.emoji}
            </div>

            {/* Green tint on hover */}
            {hovered && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,230,118,0.08)', transition: 'opacity 200ms' }} />}

            {/* Badge (top-left) */}
            {badge && (
                <div style={{ position: 'absolute', top: 8, left: 8, background: BADGE_COLORS[badge] || 'var(--color-accent)', color: badge === 'NEW' ? '#000' : '#fff', borderRadius: 'var(--radius-sm)', padding: '1px 8px', fontFamily: 'Outfit', fontWeight: 700, fontSize: 11, letterSpacing: '0.5px' }}>{badge}</div>
            )}

            {/* Favourite toggle */}
            <button onClick={e => { e.stopPropagation(); onToggleFavourite(game.id); }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 5, fontSize: 14 }}>
                {isFavourite(game.id) ? '❤️' : '🤍'}
            </button>

            {/* Provider gradient overlay at bottom */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(transparent, rgba(0,0,0,0.75))', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 8, left: 10, fontFamily: 'DM Sans', fontSize: 11, color: 'var(--color-text-secondary)' }}>{provider}</div>

            {/* Hover Play Now button slides up */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', padding: '0 16px 16px', transform: hovered ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 180ms ease-out', pointerEvents: hovered ? 'auto' : 'none' }}>
                <div style={{ background: 'var(--color-accent)', color: 'var(--color-base)', borderRadius: 'var(--radius-full)', padding: '6px 20px', fontFamily: 'DM Sans', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>Play Now</div>
            </div>
        </div>
    );
};

// ── F12-D Filter Bar ────────────────────────────────────────────
const CATEGORIES = ['All Games', 'Slots', 'Live Casino', 'Table Games', 'New Arrivals', 'Bonus Buy'];
const PROVIDERS = ['All Providers', 'Pragmatic Play', 'NetEnt', 'Evolution', "Play'n GO", 'NeoStrike'];
const SORT_OPTIONS = ['Rating', 'New', 'A–Z', 'RTP'];

const FilterBar = ({ onSearch, activeCategory, onCategoryChange, activeProvider, onProviderChange, sortBy, onSortChange, bonusBuy, onBonusBuyToggle }) => {
    const [searchVal, setSearchVal] = useState('');
    const debounceRef = React.useRef(null);

    const handleSearch = (v) => {
        setSearchVal(v);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => onSearch(v), 300);
    };

    const selectStyle = {
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border-strong)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--color-text-primary)',
        padding: '0 var(--space-md)',
        height: 36,
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 13,
        cursor: 'pointer',
        outline: 'none',
    };

    return (
        <div style={{ marginBottom: 'var(--space-xl)' }}>
            {/* Category chips */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 12, scrollbarWidth: 'none' }}>
                {CATEGORIES.map(cat => {
                    const key = cat === 'All Games' ? 'all' : cat.toLowerCase().replace(/[\s']/g, '-');
                    const active = activeCategory === key || (!activeCategory && key === 'all');
                    return (
                        <button key={cat} onClick={() => onCategoryChange(key)} style={{
                            whiteSpace: 'nowrap', padding: '8px 20px', borderRadius: 'var(--radius-full)',
                            border: 'none', cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 500, fontSize: 13,
                            background: active ? 'var(--color-accent)' : 'var(--color-surface-raised)',
                            color: active ? 'var(--color-base)' : 'var(--color-text-secondary)',
                            transition: 'background 150ms ease-out, color 150ms ease-out',
                        }}>{cat}</button>
                    );
                })}
            </div>

            {/* Search + dropdowns row */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
                    <input
                        value={searchVal}
                        onChange={e => handleSearch(e.target.value)}
                        placeholder="Search games…"
                        style={{ ...selectStyle, width: '100%', paddingLeft: 36, background: 'var(--color-surface-overlay)' }}
                    />
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)', fontSize: 14 }}>🔍</span>
                    {searchVal && (
                        <button onClick={() => handleSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 14 }}>✕</button>
                    )}
                </div>

                {/* Provider dropdown */}
                <select value={activeProvider} onChange={e => onProviderChange(e.target.value)} style={selectStyle}>
                    {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>

                {/* Sort by */}
                <select value={sortBy} onChange={e => onSortChange(e.target.value)} style={selectStyle}>
                    {SORT_OPTIONS.map(s => <option key={s} value={s}>Sort: {s}</option>)}
                </select>

                {/* Bonus Buy toggle */}
                <button onClick={onBonusBuyToggle} style={{
                    height: 36, padding: '0 16px', borderRadius: 'var(--radius-md)',
                    border: `1px solid ${bonusBuy ? 'var(--color-accent)' : 'var(--color-border-strong)'}`,
                    background: bonusBuy ? 'var(--color-accent-glow)' : 'var(--color-surface-raised)',
                    color: bonusBuy ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    fontFamily: 'DM Sans', fontSize: 13, cursor: 'pointer',
                    transition: 'all 150ms ease-out',
                }}>
                    ⚡ Bonus Buy
                </button>
            </div>
        </div>
    );
};

const GameSlider = ({ title, games, onLaunch, isFavourite, onToggleFavourite }) => (
    <div style={{ marginBottom: 'var(--space-2xl)' }}>
        <h2 style={{ margin: '0 0 var(--space-lg) 0', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 22, color: 'var(--color-text-primary)' }}>{title}</h2>
        <div style={{ display: 'flex', gap: 'var(--space-md)', overflowX: 'auto', paddingBottom: 16, scrollbarWidth: 'none' }}>
            {games.map(game => (
                <div key={game.id} style={{ width: 140, flexShrink: 0 }}>
                    <GameCard game={game} onLaunch={onLaunch} isFavourite={isFavourite} onToggleFavourite={onToggleFavourite} />
                </div>
            ))}
        </div>
    </div>
);

export const GameLobby = ({ activePage, onNavigate }) => {
    const { isAuthenticated } = useSession();
    const { games, loading, error, search, filter, loadMore, total } = useGames();
    const { favourites, isFavourite, toggleFavourite } = useFavourites();
    const { games: recentlyPlayed } = useRecentlyPlayed();
    const [selectedGame, setSelectedGame] = useState(null);

    // F12-D filter state
    const [activeCategory, setActiveCategory] = useState('all');
    const [activeProvider, setActiveProvider] = useState('All Providers');
    const [sortBy, setSortBy] = useState('Rating');
    const [bonusBuy, setBonusBuy] = useState(false);

    const mode = isAuthenticated ? 'real' : 'demo';
    const { launchUrl, error: launchError } = useGameLaunch(selectedGame?.id, { mode });

    useEffect(() => {
        if (activePage === 'live') handleCategoryChange('live-casino');
        else if (activePage === 'social') handleCategoryChange('slots');
        else if (activePage === 'table') handleCategoryChange('table-games');
        else if (activePage === 'home') handleCategoryChange('all');
    }, [activePage]);

    useEffect(() => {
        if (launchError && launchError === 'DEMO_NOT_SUPPORTED') {
            logSDKEvent('UI', 'Demo mode not supported by provider, falling back to mock game');
        } else if (launchUrl) {
            logSDKEvent('SDK', 'Game launch URL received', { url: launchUrl });
        }
    }, [launchUrl, launchError]);

    const handleSearch = useCallback((query) => search(query), [search]);

    const handleCategoryChange = (cat) => {
        setActiveCategory(cat);
        filter({ category: cat === 'all' ? null : cat });
    };

    const handleLaunch = (game) => {
        logSDKEvent('UI', `Attempting to launch game: ${game.name}...`);
        setSelectedGame(game);
    };

    return (
        <div style={{ padding: '0 var(--space-xl) var(--space-2xl)' }}>
            {activePage === 'providers' ? (
                <div style={{ marginTop: 'var(--space-xl)' }}>
                    <h2 style={{ margin: '0 0 var(--space-lg) 0', fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 22, color: 'var(--color-text-primary)' }}>Game Providers</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-md)' }}>
                        {PROVIDERS.filter(p => p !== 'All Providers').map(p => (
                            <button key={p} onClick={() => { setActiveProvider(p); onNavigate('home'); }} style={{ padding: '24px', background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-text-primary)', fontFamily: 'Outfit', fontSize: 18, fontWeight: 600, cursor: 'pointer', transition: 'background 150ms' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-overlay)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'var(--color-surface-raised)'}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            ) : activePage === 'recent' ? (
                <div style={{ marginTop: 'var(--space-xl)' }}>
                    <GameSlider title="Recent Playing Games" games={recentlyPlayed} onLaunch={handleLaunch} isFavourite={isFavourite} onToggleFavourite={toggleFavourite} />
                </div>
            ) : activePage === 'favourites' ? (
                <div style={{ marginTop: 'var(--space-xl)' }}>
                    <GameSlider title="Your Favourites" games={favourites} onLaunch={handleLaunch} isFavourite={isFavourite} onToggleFavourite={toggleFavourite} />
                </div>
            ) : (
                <>
                    {/* F12-E Hero Banner */}
                    {activePage === 'home' && (
                        <HeroBanner 
                            onNavigate={onNavigate} 
                            onCategoryChange={handleCategoryChange} 
                        />
                    )}

                    {/* F12-C Live Wins Ticker */}
                    {activePage === 'home' && <LiveWinsTicker />}

                    {/* F12-D Filter Bar */}
                    <FilterBar
                        onSearch={handleSearch}
                        activeCategory={activeCategory}
                        onCategoryChange={handleCategoryChange}
                        activeProvider={activeProvider}
                        onProviderChange={setActiveProvider}
                        sortBy={sortBy}
                        onSortChange={setSortBy}
                        bonusBuy={bonusBuy}
                        onBonusBuyToggle={() => setBonusBuy(b => !b)}
                    />

                    {/* SDK Carousels - Changed to GameSlider for clickability and F12 tokens */}
                    {activePage === 'home' && recentlyPlayed.length > 0 && (
                        <GameSlider title="Continue Playing" games={recentlyPlayed} onLaunch={handleLaunch} isFavourite={isFavourite} onToggleFavourite={toggleFavourite} />
                    )}

                    {activePage === 'home' && favourites.length > 0 && (
                        <GameSlider title="Your Favourites" games={favourites} onLaunch={handleLaunch} isFavourite={isFavourite} onToggleFavourite={toggleFavourite} />
                    )}

                    {/* Results Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 'var(--space-2xl) 0 var(--space-lg)' }}>
                        <h2 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', fontWeight: 600, fontSize: 22, color: 'var(--color-text-primary)' }}>{activeCategory === 'all' ? 'All Games' : activeCategory.toUpperCase().replace('-', ' ')}</h2>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 13, fontFamily: 'DM Sans' }}>Showing {games.length} of {total}</span>
                    </div>

                    {/* Error State */}
                    {error && (
                        <div style={{ padding: 'var(--space-lg)', background: 'rgba(255,82,82,0.08)', border: '1px solid rgba(255,82,82,0.4)', borderRadius: 'var(--radius-md)', color: 'var(--color-error)', marginBottom: 'var(--space-xl)' }}>
                            <strong>Load Error:</strong> {error}
                        </div>
                    )}

                    {/* F12-A Games Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                        gap: 'var(--space-md)',
                    }}>
                        {loading ? (
                            Array(12).fill(0).map((_, i) => (
                                <div key={i} className="skeleton" style={{ aspectRatio: '3/4', borderRadius: 'var(--radius-lg)' }} />
                            ))
                        ) : (
                            games.map(game => (
                                <GameCard
                                    key={game.id}
                                    game={game}
                                    onLaunch={handleLaunch}
                                    isFavourite={isFavourite}
                                    onToggleFavourite={toggleFavourite}
                                />
                            ))
                        )}
                    </div>

                    {/* Load More */}
                    {!loading && games.length < total && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-2xl)' }}>
                            <button onClick={loadMore} style={{
                                padding: '12px 40px', borderRadius: 'var(--radius-full)',
                                background: 'transparent', color: 'var(--color-accent)',
                                border: '2px solid var(--color-accent)',
                                cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600, fontSize: 14,
                                transition: 'background 150ms ease-out',
                            }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-accent-glow)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                            >
                                Load More Games
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Game Launch Overlay */}
            {selectedGame && (
                <GameLauncher
                    game={selectedGame}
                    launchUrl={(launchError === 'DEMO_NOT_SUPPORTED') ? null : launchUrl}
                    currentMode={mode}
                    onClose={() => setSelectedGame(null)}
                />
            )}
        </div>
    );
};
