import React, { useState, useEffect } from 'react';
import { FiDownload, FiX, FiSmartphone, FiCheck } from 'react-icons/fi';
import { usePWA } from '../hooks/usePWA';

interface InstallPromptProps {
  onDismiss?: () => void;
}

export default function InstallPrompt({ onDismiss }: InstallPromptProps) {
  const { isInstallable, isInstalled, installApp } = usePWA();
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Show prompt after a delay if installable and not already dismissed
    const dismissed = localStorage.getItem('install-prompt-dismissed');
    const lastShown = localStorage.getItem('install-prompt-last-shown');
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    if (isInstallable && !isInstalled && !dismissed) {
      // Show immediately if never shown, or after 7 days if previously dismissed
      if (!lastShown || (now - parseInt(lastShown)) > (7 * dayInMs)) {
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 3000); // Show after 3 seconds

        return () => clearTimeout(timer);
      }
    }
  }, [isInstallable, isInstalled]);

  const handleInstall = async () => {
    setIsInstalling(true);
    
    try {
      const success = await installApp();
      
      if (success) {
        setShowSuccess(true);
        setTimeout(() => {
          setIsVisible(false);
          onDismiss?.();
        }, 2000);
      } else {
        setIsInstalling(false);
      }
    } catch (error) {
      console.error('Install failed:', error);
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('install-prompt-dismissed', 'true');
    localStorage.setItem('install-prompt-last-shown', Date.now().toString());
    onDismiss?.();
  };

  const handleRemindLater = () => {
    setIsVisible(false);
    localStorage.setItem('install-prompt-last-shown', Date.now().toString());
    onDismiss?.();
  };

  if (!isVisible || isInstalled) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center sm:justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl transform transition-transform duration-300 ease-out">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <FiSmartphone className="text-white" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Install Gossapp
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Get the full app experience
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {showSuccess ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiCheck className="text-green-600 dark:text-green-400" size={32} />
              </div>
              <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Successfully Installed!
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                Gossapp has been added to your home screen
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Why install Gossapp?
                </h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Faster loading and better performance
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Works offline with cached content
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Push notifications for new activity
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Native app-like experience
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Quick access from your home screen
                  </li>
                </ul>
              </div>

              {/* Install Steps */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
                <h5 className="font-medium text-gray-900 dark:text-white mb-2">
                  Installation is quick and easy:
                </h5>
                <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>1. Tap "Install App" below</li>
                  <li>2. Confirm installation in the popup</li>
                  <li>3. Find Gossapp on your home screen</li>
                </ol>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {isInstalling ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Installing...
                    </>
                  ) : (
                    <>
                      <FiDownload size={20} />
                      Install App
                    </>
                  )}
                </button>
                <button
                  onClick={handleRemindLater}
                  className="px-4 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium transition-colors"
                >
                  Later
                </button>
              </div>

              {/* Privacy Note */}
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-4 text-center">
                Installing Gossapp doesn't share any additional data with us. 
                You can uninstall anytime from your device settings.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
