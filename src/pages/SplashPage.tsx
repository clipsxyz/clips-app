import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import logoOrbit from '../assets/g + orbit.png';

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
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-black">
            <img
                src={logoOrbit}
                alt="Gazetteer"
                className="w-[220px] h-auto mb-6 splash-logo-animate"
            />
            <p
                className="text-lg font-semibold tracking-wide"
                style={{
                    background: 'linear-gradient(90deg, #3b82f6, #a855f7)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                }}
            >
                Gazetteer
            </p>
        </div>
    );
}

