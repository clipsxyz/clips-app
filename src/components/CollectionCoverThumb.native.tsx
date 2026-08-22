import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import Video from 'react-native-video';
import { mockFeedVideoSource } from '../constants/mockFeedVideos.native';
import { androidListSafeVideoProps } from '../utils/androidSafeVideoNative';

type Props = {
    uri: string;
    isVideo?: boolean;
    style?: StyleProp<ImageStyle>;
    onError?: () => void;
};

/** Collection list / save-sheet cover: still JPEG, or a paused first frame for MP4s. */
export default function CollectionCoverThumb({ uri, isVideo = false, style, onError }: Props) {
    if (isVideo) {
        return (
            <Video
                source={mockFeedVideoSource(uri)}
                style={style}
                resizeMode="cover"
                paused
                muted
                repeat={false}
                controls={false}
                playInBackground={false}
                playWhenInactive={false}
                ignoreSilentSwitch="obey"
                disableFocus
                pointerEvents="none"
                {...androidListSafeVideoProps()}
                onError={onError}
            />
        );
    }
    return <Image source={{ uri }} style={style} onError={onError} />;
}
