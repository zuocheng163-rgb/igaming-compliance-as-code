import React, { useState, useMemo } from 'react';
import { useSession, NeoStrikeProvider } from '@neostrike/sdk';
import { GameLobby } from './components/GameLobby';
import { WalletDrawer } from './components/WalletDrawer';
import { Sidebar } from './components/Sidebar';
import { HeaderBar } from './components/HeaderBar';
import { FastTrackFeed } from './components/FastTrackFeed';
import { AlertModal } from './components/AlertModal';
import { SDKConsole } from './components/SDKConsole';
import { OfflineState, InstallPrompt } from '@neostrike/sdk';

function AppInner() {
    const { player, login, isAuthenticated, logout } = useSession();
    const [isWalletOpen, setWalletOpen] = useState(false);
    const [token, setToken] = useState(localStorage.getItem('ns_session_token') || '');
    const [username, setUsername] = useState(localStorage.getItem('ns_username') || '');
    const [activePage, setActivePage] = useState('home');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    React.useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

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

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-base)' }}>
            <OfflineState />
            <InstallPrompt />

            {/* Fixed Left Sidebar (F12-B) */}
            <Sidebar
                activePage={activePage}
                onNavigate={setActivePage}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Main Content Area */}
            <div className="f12-main" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {/* Header Bar (F12-B) */}
                <HeaderBar
                    onOpenWallet={() => setWalletOpen(true)}
                    onLogin={handleLogin}
                    onLogout={handleLogout}
                    isMobile={isMobile}
                    onHamburger={() => setSidebarOpen(true)}
                />

                {/* Page Content */}
                <main style={{ flex: 1, padding: 'var(--space-xl)' }}>
                    <GameLobby />
                </main>
            </div>

            <WalletDrawer isOpen={isWalletOpen} onClose={() => setWalletOpen(false)} player={player} />
            <AlertModal />
            <SDKConsole />
            <FastTrackFeed />
        </div>
    );
}

function App() {
    const [token] = useState(localStorage.getItem('ns_session_token') || '');
    const [username] = useState(localStorage.getItem('ns_username') || '');

    const config = useMemo(() => ({
        apiUrl: 'https://igaming-product.vercel.app',
        token,
        username,
        brandId: '1'
    }), [token, username]);

    return (
        <NeoStrikeProvider config={config}>
            <AppInner />
        </NeoStrikeProvider>
    );
}

export default App;
