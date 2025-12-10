/**
 * Web-compatible icon wrapper for react-native-vector-icons
 * Uses react-icons on web, react-native-vector-icons on native
 */
import React from 'react';
import { isWeb } from './platform';
import * as Icons from 'react-icons/io5';

// Map Ionicons names to react-icons components
const iconMap: { [key: string]: React.ComponentType<any> } = {
    'home': Icons.IoHome,
    'home-outline': Icons.IoHomeOutline,
    'flash': Icons.IoFlash,
    'flash-outline': Icons.IoFlashOutline,
    'camera': Icons.IoCamera,
    'camera-outline': Icons.IoCameraOutline,
    'radio': Icons.IoRadio,
    'radio-outline': Icons.IoRadioOutline,
    'search': Icons.IoSearch,
    'search-outline': Icons.IoSearchOutline,
    'person': Icons.IoPerson,
    'person-outline': Icons.IoPersonOutline,
    'circle': Icons.IoEllipseOutline,
    'ellipse-outline': Icons.IoEllipseOutline,
};

// Create a web-compatible Icon component that matches react-native-vector-icons API
const WebIcon = ({ name, size = 24, color = '#000', ...props }: any) => {
    if (isWeb()) {
        const IconComponent = iconMap[name] || Icons.IoEllipseOutline;

        return React.createElement(IconComponent, {
            size,
            color,
            ...props
        });
    }

    // For native, this should not be used (use react-native-vector-icons directly)
    // This will be replaced by the actual react-native-vector-icons on native builds
    return null;
};

export default WebIcon;

