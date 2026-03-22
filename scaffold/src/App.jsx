import React, { useState, useMemo } from 'react';
import { useSession, NeoStrikeProvider } from '@neostrike/sdk';
import { GameLobby } from './components/GameLobby';
import { WalletDrawer } from './components/WalletDrawer';
import { TopNav } from './components/TopNav';
import { FastTrackFeed } from './components/FastTrackFeed';
import { AlertModal } from './components/AlertModal';
import { SDKConsole } from './components/SDKConsole';
import { OfflineState, InstallPrompt } from '@neostrike/sdk';
import theme from '../theme.config';

function App() {
    const { player, login, isAuthenticated, logout } = useSession();
    const [isWalletOpen, setWalletOpen] = useState(false);
    const [token, setToken] = useState(localStorage.getItem('ns_session_token') || '');
    const [username, setUsername] = useState(localStorage.getItem('ns_username') || '');

    const handleLogin = async (e) => {
        e.preventDefault();
        const u = e.target.username.value;
        const t = e.target.token.value;
        try {
            await login(u, t);
            setToken(t);
            setUsername(u);
            localStorage.setItem('ns_session_token', t);
            localStorage.setItem('ns_username', u);
        } catch (err) {
            console.error('Login failed', err);
        }
    };

    const handleLogout = () => {
        logout();
        setToken('');
        setUsername('');
        localStorage.removeItem('ns_session_token');
        localStorage.removeItem('ns_username');
    };

    const config = useMemo(() => ({
        apiUrl: 'https://igaming-product.vercel.app',
        token: token,
        username: username,
        brandId: '1'
    }), [token, username]);

    return (
        <NeoStrikeProvider config={config}>
            <div className="app" style={{
                background: theme.colors.background,
                minHeight: '100vh',
                fontFamily: theme.fonts.body,
                color: theme.colors.text
            }}>
                <OfflineState />
                <InstallPrompt />
                
                <TopNav 
                    player={player} 
                    isAuthenticated={isAuthenticated} 
                    onOpenWallet={() => setWalletOpen(true)} 
                    onLogout={handleLogout} 
                    onLogin={handleLogin} 
                />

                <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
                    <GameLobby />
                </main>

                <WalletDrawer isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} player={player} />
                <AlertModal />
                <SDKConsole />
                <FastTrackFeed />
            </div>
        </NeoStrikeProvider>
    );
}

export default App;
