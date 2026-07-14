import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export type CreateModeIconId = 'community' | 'type' | 'story' | 'gallery';

type IconProps = {
    size?: number;
    color?: string;
};

const STROKE = 2;

/** Optical boost so stroke + filled icons match FiType weight in the same tile. */
const ICON_SCALE: Record<CreateModeIconId, number> = {
    type: 1,
    gallery: 1.08,
    story: 1.08,
    community: 1.42,
};

function IconCanvas({
    size,
    color,
    children,
    viewBox = '0 0 24 24',
}: {
    size: number;
    color: string;
    children: React.ReactNode;
    viewBox?: string;
}) {
    return (
        <Svg width={size} height={size} viewBox={viewBox} fill="none">
            {children}
        </Svg>
    );
}

/** Feather FiType — web Create hub "Text only". */
export function CreateModeTypeIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
    return (
        <IconCanvas size={size} color={color}>
            <Path d="M4 7V4h16v3" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M9 20h6" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M12 4v16" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
        </IconCanvas>
    );
}

/** Feather FiUpload — web Create hub "Gallery". */
export function CreateModeUploadIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
    return (
        <IconCanvas size={size} color={color}>
            <Path
                d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M17 8l-5-5-5 5"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M12 3v12"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </IconCanvas>
    );
}

/** Feather FiCamera — web Create hub "24h Story". */
export function CreateModeCameraIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
    return (
        <IconCanvas size={size} color={color}>
            <Path
                d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Circle cx={12} cy={13} r={4} stroke={color} strokeWidth={STROKE} fill="none" />
        </IconCanvas>
    );
}

/** Font Awesome FaPeopleRobbery — web Create hub "Community". */
export function CreateModeCommunityIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
    return (
        <Svg width={size} height={size} viewBox="80 0 420 512" fill={color}>
            <Path d="M488.2 59.1C478.1 99.6 441.7 128 400 128s-78.1-28.4-88.2-68.9L303 24.2C298.8 7.1 281.4-3.3 264.2 1S236.7 22.6 241 39.8l8.7 34.9c11 44 40.2 79.6 78.3 99.6V480c0 17.7 14.3 32 32 32s32-14.3 32-32V352h16V480c0 17.7 14.3 32 32 32s32-14.3 32-32V174.3c38.1-20 67.3-55.6 78.3-99.6L559 39.8c4.3-17.1-6.1-34.5-23.3-38.8S501.2 7.1 497 24.2l-8.7 34.9zM400 96a48 48 0 1 0 0-96 48 48 0 1 0 0 96zM80 96A48 48 0 1 0 80 0a48 48 0 1 0 0 96zm-8 32c-35.3 0-64 28.7-64 64v96l0 .6V480c0 17.7 14.3 32 32 32s32-14.3 32-32V352H88V480c0 17.7 14.3 32 32 32s32-14.3 32-32V252.7l13 20.5c5.9 9.2 16.1 14.9 27 14.9h48c17.7 0 32-14.3 32-32s-14.3-32-32-32H209.6l-37.4-58.9C157.6 142 132.1 128 104.7 128H72z" />
        </Svg>
    );
}

export function CreateModeIcon({
    id,
    size = 24,
    color = '#FFFFFF',
}: IconProps & { id: CreateModeIconId }) {
    const px = Math.round(size * ICON_SCALE[id]);

    switch (id) {
        case 'community':
            return <CreateModeCommunityIcon size={px} color={color} />;
        case 'type':
            return <CreateModeTypeIcon size={px} color={color} />;
        case 'story':
            return <CreateModeCameraIcon size={px} color={color} />;
        case 'gallery':
        default:
            return <CreateModeUploadIcon size={px} color={color} />;
    }
}
