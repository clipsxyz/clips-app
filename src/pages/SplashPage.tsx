import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMapPin } from 'react-icons/fi';
import { useAuth } from '../context/Auth';
import logo from '../assets/gazetteer-logo-pin-square.svg';

export default function SplashPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    // After a short delay, move off the splash screen
    useEffect(() => {
        const timer = setTimeout(() => {
            if (user) {
                navigate('/feed', { replace: true });
            } else {
                navigate('/landing', { replace: true });
            }
        }, 3000);

        return () => clearTimeout(timer);
    }, [user, navigate]);

    return (
        <div className="min-h-screen w-full flex flex-col items-center bg-black py-16">
            {/* Center section: white square + location pin vertically centered */}
            <div className="flex-1 flex flex-col items-center justify-center gap-6">
                <img
                    src={logo}
                    alt="Gazetteer"
                    className="w-40 h-40 object-contain splash-logo-animate"
                />

                {/* Simple places line between icon and Gazetteer logo */}
                <p className="text-sm text-white/70 tracking-wide">
                    Dublin · London · New York · Tokyo
                </p>

                {/* Gazetteer wordmark in street-sign style with bounce animation just under the places */}
                <div className="inline-flex items-stretch rounded-full border border-white/90 overflow-hidden text-sm font-semibold tracking-tight animate-bounce mt-2">
                    {/* Left segment: black background with white location icon */}
                    <div className="flex items-center justify-center px-3 py-1 bg-black text-white">
                        <FiMapPin className="w-4 h-4" />
                    </div>
                    {/* Right segment: white background with black text */}
                    <div className="px-4 py-1 bg-white text-black">
                        Gazetteer
                    </div>
                </div>
            </div>
        </div>
    );
}

