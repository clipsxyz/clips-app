import React from 'react';
import { useViewTracking } from '../hooks/useViewTracking';

// Debug component to show view tracking statistics
export function ViewTrackingDebug() {
  const { getViewedCount, clearViewedPosts } = useViewTracking();
  const [isVisible, setIsVisible] = React.useState(false);

  if (process.env.NODE_ENV !== 'development') {
    return null; // Only show in development
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-20 right-4 z-50 bg-blue-500 text-white px-3 py-1 rounded text-xs"
      >
        Views: {getViewedCount()}
      </button>

      {/* Debug panel */}
      {isVisible && (
        <div className="fixed bottom-20 right-4 z-50 bg-black/80 text-white p-3 rounded text-xs max-w-xs">
          <h3 className="font-bold mb-2">View Tracking Debug</h3>
          <p>Posts viewed: {getViewedCount()}</p>
          <button
            onClick={clearViewedPosts}
            className="mt-2 bg-red-500 px-2 py-1 rounded text-xs"
          >
            Clear Views
          </button>
        </div>
      )}
    </>
  );
}


