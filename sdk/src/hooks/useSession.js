import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { getEnv, logSDKEvent } from '../utils';

// In-memory token storage (XSS Mitigation)
let authToken = null;
let globalTimePlayed = 0;
let sessionSubscribers = [];
let sessionInterval = null;

export const useSession = (config = {}) => {
    const [player, setPlayer] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [timePlayed, setTimePlayed] = useState(globalTimePlayed);

    useEffect(() => {
        sessionSubscribers.push(setTimePlayed);

        if (!sessionInterval) {
            sessionInterval = setInterval(() => {
                if (authToken) {
                    globalTimePlayed += 1;
                    sessionSubscribers.forEach(fn => fn(globalTimePlayed));

                    // Trigger alert at exactly 60 minutes
                    if (globalTimePlayed === 3600) {
                        window.dispatchEvent(new CustomEvent('neostrike-simulate-alert', {
                            detail: {
                                title: 'Play Break Reminder',
                                message: 'You have been playing for 60 minutes. Would you like to take a short break?',
                                severity: 'info'
                            }
                        }));
                    }
                }
            }, 1000);
        }

        return () => {
            sessionSubscribers = sessionSubscribers.filter(fn => fn !== setTimePlayed);
            if (sessionSubscribers.length === 0 && sessionInterval) {
                clearInterval(sessionInterval);
                sessionInterval = null;
            }
        };
    }, []);

    const login = useCallback(async (username, password) => {
        setLoading(true);
        try {
            const apiUrl = getEnv('VITE_NEOSTRIKE_API_URL');
            const apiKey = getEnv('VITE_NEOSTRIKE_API_KEY');

            const response = await axios.post(`${apiUrl}/api/authenticate`, {
                username,
                password
            }, {
                headers: {
                    'x-api-key': apiKey,
                    'x-brand-id': config.brandId || '1',
                    // Pass the token as Authorization Bearer header so the backend
                    // can authenticate regardless of DEMO_MODE setting
                    ...(password ? { 'Authorization': `Bearer ${password}` } : {})
                }
            });

            // Store the ORIGINAL token (the one in the DB), not the session SID returned
            // by the server. The backend's authenticateRequest validates by DB token column.
            authToken = password || response.data.token;
            setPlayer(response.data.user);
            setError(null);
            logSDKEvent('AUTH', `User ${username} logged in successfully`, { userId: response.data.user.id });
            return response.data;
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            setError(msg);
            logSDKEvent('ERROR', `Login failed: ${msg}`);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [config.brandId]);

    const register = useCallback(async (userData) => {
        setLoading(true);
        try {
            const response = await axios.post(`${process.env.VITE_NEOSTRIKE_API_URL}/api/register`, userData, {
                headers: {
                    'x-api-key': process.env.VITE_NEOSTRIKE_API_KEY,
                    'x-brand-id': config.brandId || '1'
                }
            });

            authToken = response.data.token;
            setPlayer(response.data.user);
            setError(null);
            logSDKEvent('AUTH', `User ${userData.username} registered successfully`);
            return response.data;
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            setError(msg);
            logSDKEvent('ERROR', `Registration failed: ${msg}`);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [config.brandId]);

    const logout = () => {
        const username = player?.username;
        authToken = null;
        globalTimePlayed = 0; // Reset session time on logout
        sessionSubscribers.forEach(fn => fn(0));
        setPlayer(null);
        logSDKEvent('AUTH', `User ${username} logged out`);
    };

    return {
        player,
        login,
        logout,
        register,
        isAuthenticated: !!player && !!authToken,
        loading,
        error,
        timePlayed,
        getToken: () => authToken
    };
};
