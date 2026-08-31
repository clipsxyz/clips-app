import {
    resolveVerifiedAccountType,
    VERIFIED_BADGE_BLUE,
    VERIFIED_BADGE_PERSONAL_CHECK,
    VERIFIED_BADGE_PERSONAL_FILL,
    VERIFIED_BADGE_PERSONAL_STROKE,
    VERIFIED_CHECK_PATH,
    VERIFIED_SEAL_PATH,
} from '../utils/verifiedBadge';

type Props = {
    accountType?: string | null;
    size?: number;
    className?: string;
};

/** Instagram / X–style scalloped verified seal (personal = white, business = blue). */
export default function VerifiedBadge({ accountType, size = 15, className = '' }: Props) {
    const isBusiness = resolveVerifiedAccountType(accountType) === 'business';
    const fill = isBusiness ? VERIFIED_BADGE_BLUE : VERIFIED_BADGE_PERSONAL_FILL;
    const check = isBusiness ? '#FFFFFF' : VERIFIED_BADGE_PERSONAL_CHECK;
    const label = isBusiness ? 'Business verified' : 'Verified';

    return (
        <span
            className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`}
            style={{
                width: size,
                height: size,
                filter: isBusiness
                    ? 'drop-shadow(0 0.5px 0.5px rgba(0,0,0,0.22))'
                    : 'drop-shadow(0 0.5px 0.5px rgba(0,0,0,0.28))',
            }}
            title={label}
            aria-label={label}
        >
            <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
                <path
                    d={VERIFIED_SEAL_PATH}
                    fill={fill}
                    stroke={isBusiness ? 'none' : VERIFIED_BADGE_PERSONAL_STROKE}
                    strokeWidth={isBusiness ? 0 : 0.75}
                />
                <path d={VERIFIED_CHECK_PATH} fill={check} />
            </svg>
        </span>
    );
}
