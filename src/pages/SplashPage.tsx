import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/Auth';
import {
    getDayPart,
    getSplashGreetingLine,
} from '../utils/timeGreeting';
import splashMorning from '../assets/splash/morning.png';
import splashAfternoon from '../assets/splash/afternoon.png';
import splashEvening from '../assets/splash/evening.png';

const INTRO_FADE_MS = 700;
const GREETING_HOLD_MS = 2500;
const EXIT_FADE_MS = 500;

const SPLASH_BACKDROP_WEB = {
    morning: splashMorning,
    afternoon: splashAfternoon,
    evening: splashEvening,
} as const;

/**
 * IKEA-style cold-start welcome (web).
 * Lifestyle backdrop + time greeting only — no metallic logo beat.
 */
export default function SplashPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const dayPart = useMemo(() => getDayPart(), []);
    const backdropUri = SPLASH_BACKDROP_WEB[dayPart];

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
        // Next frame: fade backdrop + greeting in
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
            className="relative min-h-screen min-h-[100dvh] w-full overflow-hidden bg-[#0b0711]"
            style={{
                opacity: exiting ? 0 : 1,
                transition: `opacity ${EXIT_FADE_MS}ms ease-out`,
            }}
        >
            <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                    backgroundImage: `url(${backdropUri})`,
                    opacity: visible || exiting ? 1 : 0,
                    transition: `opacity ${INTRO_FADE_MS}ms ease-out`,
                }}
                aria-hidden
            />
            <div
                className="absolute inset-0 bg-[#0b0711]/45"
                style={{
                    opacity: visible || exiting ? 1 : 0,
                    transition: `opacity ${INTRO_FADE_MS}ms ease-out`,
                }}
                aria-hidden
            />

            <div
                className="absolute inset-x-6 bottom-[18%] flex flex-col items-center text-center"
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
        </div>
    );
}
