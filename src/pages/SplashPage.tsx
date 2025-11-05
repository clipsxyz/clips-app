import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMapPin } from 'react-icons/fi';
import { useAuth } from '../context/Auth';

export default function SplashPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [splashDone, setSplashDone] = useState(false);
    const [showLogo, setShowLogo] = useState(false);
    const [showEvery, setShowEvery] = useState(false);
    const [showStory, setShowStory] = useState(false);
    const [showHasLocation, setShowHasLocation] = useState(false);

    useEffect(() => {
        // Animate logo first
        const logoTimer = setTimeout(() => setShowLogo(true), 200);
        // Animate text appearance
        const everyTimer = setTimeout(() => setShowEvery(true), 800);
        const storyTimer = setTimeout(() => setShowStory(true), 1500);
        const locationTimer = setTimeout(() => setShowHasLocation(true), 2200);

        // Show splash for at least 3.5 seconds, then navigate (give time for all animations)
        // Add a check for URL parameter to stay on splash for testing
        const urlParams = new URLSearchParams(window.location.search);
        const stayOnSplash = urlParams.get('stay') === 'true';

        if (!stayOnSplash) {
            const navigationTimer = setTimeout(() => {
                setSplashDone(true);
                // Navigate based on auth state
                if (user) {
                    // User is logged in, go to feed
                    navigate('/feed', { replace: true });
                } else {
                    // User is not logged in, go to login
                    navigate('/login', { replace: true });
                }
            }, 3500);

            return () => {
                clearTimeout(everyTimer);
                clearTimeout(storyTimer);
                clearTimeout(locationTimer);
                clearTimeout(navigationTimer);
            };
        }

        return () => {
            clearTimeout(logoTimer);
            clearTimeout(everyTimer);
            clearTimeout(storyTimer);
            clearTimeout(locationTimer);
        };
    }, [user, navigate]);

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center" style={{ perspective: '1000px' }}>
            {/* Logo/Brand */}
            <div className="flex flex-col items-center gap-8" style={{ transformStyle: 'preserve-3d' }}>
                {/* Location Icon Logo (similar to Scenes logo) */}
                <div
                    className="flex items-center justify-center transition-all duration-700 ease-out"
                    style={{
                        opacity: showLogo ? 1 : 0,
                        transform: showLogo ? 'scale(1) rotate(0deg)' : 'scale(0.5) rotate(-180deg)',
                        filter: showLogo ? 'blur(0px)' : 'blur(8px)'
                    }}
                >
                    {/* Outer square border */}
                    <div className="relative p-1 rounded-md border-2 border-white shadow-lg">
                        {/* Inner square border */}
                        <div className="p-1 rounded-md border-2 border-white">
                            {/* Location icon in center */}
                            <div className="w-12 h-12 flex items-center justify-center">
                                <FiMapPin className="text-white drop-shadow-lg" size={32} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Animated Text */}
                <div className="flex flex-col items-center gap-2 min-h-[120px]">
                    <div className="text-center">
                        <span
                            className={`text-4xl font-bold text-white tracking-tight transition-all duration-700 ease-out ${showEvery
                                ? 'opacity-100 scale-100 translate-y-0'
                                : 'opacity-0 scale-75 -translate-y-8'
                                }`}
                            style={{
                                transform: showEvery
                                    ? 'scale(1) translateY(0px)'
                                    : 'scale(0.3) translateY(-32px)',
                                filter: showEvery ? 'blur(0px)' : 'blur(4px)'
                            }}
                        >
                            EVERY
                        </span>
                    </div>
                    <div className="text-center">
                        <span
                            className={`text-4xl font-bold text-white tracking-tight transition-all duration-700 ease-out ${showStory
                                ? 'opacity-100 scale-100 translate-y-0'
                                : 'opacity-0 scale-75 -translate-y-8'
                                }`}
                            style={{
                                transform: showStory
                                    ? 'scale(1) translateY(0px)'
                                    : 'scale(0.3) translateY(-32px)',
                                filter: showStory ? 'blur(0px)' : 'blur(4px)'
                            }}
                        >
                            STORY
                        </span>
                    </div>
                    <div className="text-center">
                        <span
                            className={`text-2xl font-semibold text-gray-300 tracking-tight transition-all duration-700 ease-out ${showHasLocation
                                ? 'opacity-100 scale-100 translate-y-0'
                                : 'opacity-0 scale-75 -translate-y-8'
                                }`}
                            style={{
                                transform: showHasLocation
                                    ? 'scale(1) translateY(0px)'
                                    : 'scale(0.3) translateY(-32px)',
                                filter: showHasLocation ? 'blur(0px)' : 'blur(4px)'
                            }}
                        >
                            HAS A LOCATION
                        </span>
                    </div>
                </div>
            </div>

            {/* Loading Animation - Only show after text animations */}
            {showHasLocation && (
                <div
                    className="mt-16 flex gap-2 transition-opacity duration-500"
                    style={{
                        opacity: showHasLocation ? 1 : 0
                    }}
                >
                    <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce shadow-lg" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-3 h-3 bg-pink-600 rounded-full animate-bounce shadow-lg" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce shadow-lg" style={{ animationDelay: '300ms' }}></div>
                </div>
            )}

            {/* Version or Copyright */}
            <div
                className="absolute bottom-8 text-gray-400 text-sm transition-opacity duration-500"
                style={{
                    opacity: showHasLocation ? 1 : 0
                }}
            >
                Gazetteer 25
            </div>
        </div>
    );
}

