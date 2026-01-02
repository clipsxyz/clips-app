import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth';

export default function SplashPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [splashDone, setSplashDone] = useState(false);
    const [showLogo, setShowLogo] = useState(false);
    const [textOffset, setTextOffset] = useState(0);

    useEffect(() => {
        // Animate logo first
        const logoTimer = setTimeout(() => setShowLogo(true), 200);

        // Animate circular text rotation
        let animationFrame: number;
        let startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const duration = 20000; // 20 seconds for full rotation
            const offset = (elapsed % duration) / duration * 100;
            setTextOffset(offset);
            animationFrame = requestAnimationFrame(animate);
        };
        animate();

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
                cancelAnimationFrame(animationFrame);
                clearTimeout(logoTimer);
                clearTimeout(navigationTimer);
            };
        }

        return () => {
            cancelAnimationFrame(animationFrame);
            clearTimeout(logoTimer);
        };
    }, [user, navigate]);

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center" style={{ perspective: '1000px' }}>
            {/* Logo/Brand */}
            <div className="flex flex-col items-center gap-8" style={{ transformStyle: 'preserve-3d' }}>
                {/* Container with Logo and Circular Text - Both Centered */}
                <div 
                    className="relative flex items-center justify-center"
                    style={{
                        width: '320px',
                        height: '320px'
                    }}
                >
                    {/* Circular Text Animation Around Logo */}
                    <svg
                        width="320"
                        height="320"
                        viewBox="0 0 320 320"
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0
                        }}
                    >
                        <defs>
                            <path
                                id="circle-path"
                                d="M 160,160 m -140,0 a 140,140 0 1,1 280,0 a 140,140 0 1,1 -280,0"
                                fill="none"
                            />
                        </defs>
                        <text
                            className="font-bold fill-white"
                            style={{
                                fontSize: '14px',
                                letterSpacing: '2px',
                                opacity: showLogo ? 1 : 0,
                                transition: 'opacity 1s ease-in'
                            }}
                        >
                            <textPath
                                href="#circle-path"
                                startOffset={`${textOffset}%`}
                            >
                                TURNING LOCATIONS INTO STORIES • TURNING LOCATIONS INTO STORIES • TURNING LOCATIONS INTO STORIES • 
                            </textPath>
                        </text>
                    </svg>
                    
                    {/* Logo - Centered in the middle of the circle */}
                    <div
                        className="flex items-center justify-center transition-all duration-700 ease-out relative z-10"
                        style={{
                            opacity: showLogo ? 1 : 0,
                            transform: showLogo ? 'scale(1) rotate(0deg)' : 'scale(0.5) rotate(-180deg)',
                            filter: showLogo ? 'blur(0px)' : 'blur(8px)'
                        }}
                    >
                        <img 
                            src="/gazetteer logo 1/gazetteer logo 1.jpg" 
                            alt="Gazetteer Logo" 
                            className="w-24 h-24 object-contain rounded-full"
                            style={{ 
                                backgroundColor: 'transparent'
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Loading Animation - Only show after logo appears */}
            {showLogo && (
                <div
                    className="mt-16 flex gap-2 transition-opacity duration-500"
                    style={{
                        opacity: showLogo ? 1 : 0
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
                    opacity: showLogo ? 1 : 0
                }}
            >
                Gazetteer 2026
            </div>
        </div>
    );
}

