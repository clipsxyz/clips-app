import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMapPin } from 'react-icons/fi';
import { useAuth } from '../context/Auth';
import splashLogo from '../assets/gazetteer-splash-logo.png';

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
        <div className="relative min-h-screen min-h-[100dvh] w-full flex flex-col items-center justify-center bg-black px-6">
            <img
                src={splashLogo}
                alt="Gazetteer"
                className="w-[min(280px,72vw)] max-w-[320px] h-auto object-contain splash-logo-animate"
            />
            <div className="mt-5 inline-flex items-center gap-2 text-base font-semibold tracking-[0.24em] uppercase text-white">
                <FiMapPin className="w-4 h-4" />
                <span>Gazetteer</span>
            </div>
        </div>
    );
}

