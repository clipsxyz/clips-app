import {
    resolveVerifiedAccountType,
    VERIFIED_BADGE_BLUE,
    VERIFIED_BADGE_PERSONAL_BG,
    VERIFIED_BADGE_PERSONAL_CHECK,
} from '../utils/verifiedBadge';

type Props = {
    accountType?: string | null;
    size?: number;
    className?: string;
};

/** Instagram-style verified tick beside usernames (personal = white, business = blue). */
export default function VerifiedBadge({ accountType, size = 14, className = '' }: Props) {
    const isBusiness = resolveVerifiedAccountType(accountType) === 'business';
    const check = Math.max(8, Math.round(size * 0.55));

    return (
        <span
            className={`inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
            style={{
                width: size,
                height: size,
                backgroundColor: isBusiness ? VERIFIED_BADGE_BLUE : VERIFIED_BADGE_PERSONAL_BG,
            }}
            title={isBusiness ? 'Business verified' : 'Verified'}
            aria-label={isBusiness ? 'Business verified' : 'Verified'}
        >
            <svg
                width={check}
                height={check}
                viewBox="0 0 24 24"
                fill={isBusiness ? '#FFFFFF' : VERIFIED_BADGE_PERSONAL_CHECK}
                aria-hidden
            >
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
        </span>
    );
}
