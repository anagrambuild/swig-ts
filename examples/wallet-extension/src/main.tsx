import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Add the message listener for navigation to permission requests only if chrome API is available
if (
  typeof chrome !== 'undefined' &&
  chrome.runtime &&
  chrome.runtime.onMessage
) {
  chrome.runtime.onMessage.addListener((message) => {
    try {
      if (message && message.action === 'navigate_to_permissions_request') {
        const { requestId, params } = message;

        // Navigate to the permissions request screen
        if (requestId) {
          let navigationPath = `/permissions-request?requestId=${requestId}`;

          // Add requested permission parameter if provided
          if (params && params.requestedPermission) {
            navigationPath += `&permission=${params.requestedPermission}`;
          }

          console.log('Navigating to:', navigationPath);
          window.location.hash = navigationPath;
        }
      }
    } catch (error) {
      // Improved error logging
      console.error(
        'Navigation error:',
        error instanceof Error ? error.message : String(error)
      );
    }

    // Return true for asynchronous response
    return true;
  });

  // Check for permission requests in storage on popup open
  chrome.storage.local.get(['currentPermissionRequest'], (result) => {
    if (result.currentPermissionRequest) {
      console.log(
        'Found stored permission request:',
        result.currentPermissionRequest
      );
      const { requestId, screen, params } = result.currentPermissionRequest;

      // Build the navigation path
      let path = `/${screen || 'permissions-request'}?requestId=${requestId}`;

      // Add any additional params
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          path += `&${key}=${encodeURIComponent(String(value))}`;
        });
      }

      console.log('Navigating to:', path);
      window.location.hash = path;

      // Clear the stored request after navigation
      chrome.storage.local.remove('currentPermissionRequest');
    } else {
      console.log('No stored permission request found');
    }
  });
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
