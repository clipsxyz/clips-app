import React from 'react';

export default function ClipPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Clip+ Story Creation</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        This is the Clip+ page! If you can see this, the routing is working.
      </p>
      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
        <h2 className="font-semibold mb-2">Test Content:</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>Media upload area</li>
          <li>Story text input</li>
          <li>Location picker</li>
          <li>Share button</li>
        </ul>
      </div>
    </div>
  );
}