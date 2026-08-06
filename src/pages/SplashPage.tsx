import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DiscoverAmbientCanvas from '../components/DiscoverAmbientCanvas';
import { useAuth } from '../context/Auth';
import { getSplashGreetingLine } from '../utils/timeGreeting';

const INTRO_FADE_MS = 700;
const GREETING_HOLD_MS = 2800;
const EXIT_FADE_MS = 500;

/**
 * Cold-start welcome (web): passport ambient + centered brand + time greeting.
 */
export default function SplashPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const userRef = useRef(user);
    userRef.current = user;

    const [greeting, setGreeting] = useState(() =>
        getSplashGreetingLine(user?.name ?? null),
    );
    const [phase, setPhase] = useState<'intro' | 'hold' | 'exit'>('intro');

    useEffect(() => {
        setGreeting(getSplashGreetingLine(user?.name ?? null));
    }, [user?.name]);

    useEffect(() => {
        const t0 = window.requestAnimationFrame(() => setPhase('hold'));
        const tExit = window.setTimeout(
            () => setPhase('exit'),
            INTRO_FADE_MS + GREETING_HOLD_MS,
        );
        const tNav = window.setTimeout(() => {
            if (userRef.current) {
                navigate('/feed', { replace: true });
            } else {
                navigate('/landing', { replace: true });
            }
        }, INTRO_FADE_MS + GREETING_HOLD_MS + EXIT_FADE_MS);

        return () => {
            window.cancelAnimationFrame(t0);
            window.clearTimeout(tExit);
            window.clearTimeout(tNav);
        };
    }, [navigate]);

    const visible = phase === 'hold';
    const exiting = phase === 'exit';

    return (
        <div
            className="relative min-h-screen min-h-[100dvh] w-full overflow-hidden bg-[#060d16]"
            style={{
                opacity: exiting ? 0 : 1,
                transition: `opacity ${EXIT_FADE_MS}ms ease-out`,
            }}
        >
            <DiscoverAmbientCanvas variant="passport" />

            <div
                className="absolute inset-0 z-[2] flex items-center justify-center pointer-events-none"
                aria-hidden={!(visible || exiting)}
            >
                <h1
                    className={`text-[44px] font-bold tracking-tight text-white text-center splash-brand-breathe ${
                        visible || exiting ? 'splash-brand-in' : 'opacity-0'
                    }`}
                    style={{ textShadow: '0 2px 12px rgba(6, 13, 22, 0.55)' }}
                >
                    Gazetteer
                </h1>
            </div>

            <div
                className="absolute inset-x-6 bottom-[16%] z-[2] flex flex-col items-center text-center"
                style={{ pointerEvents: 'none' }}
            >
                {(visible || exiting) && (
                    <>
                        <p className="splash-greeting-bounce text-[28px] font-light leading-9 tracking-tight text-[#F5F5F5]">
                            {greeting}
                        </p>
                        <p className="splash-tagline-fade mt-2.5 text-sm font-light tracking-wide text-[#F5F5F5]/72">
                            let's go social traveling
                        </p>
                    </>
                )}
            </div>

            <style>{`
                @keyframes splashBrandIn {
                    0% { opacity: 0; transform: translateY(18px) scale(0.82); }
                    70% { opacity: 1; transform: translateY(0) scale(1.06); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes splashBrandBreathe {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.82; transform: scale(1.045); }
                }
                .splash-brand-in {
                    animation: splashBrandIn 0.56s cubic-bezier(0.22, 1, 0.36, 1) forwards;
                }
                .splash-brand-breathe.splash-brand-in {
                    animation:
                        splashBrandIn 0.56s cubic-bezier(0.22, 1, 0.36, 1) forwards,
                        splashBrandBreathe 2.2s ease-in-out 0.56s infinite;
                }
            `}</style>
        </div>
    );
}
