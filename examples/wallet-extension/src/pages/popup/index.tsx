import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../../App'; // Your main App component

// Add the navigation message listener before rendering
chrome.runtime.onMessage.addListener((message) => {
  if (message && message.action === 'navigate_to_permissions_request') {
    const { requestId, params } = message;

    // Store navigation info in localStorage or sessionStorage for your screens to access
    if (requestId) {
      sessionStorage.setItem('currentRequestId', requestId);
    }

    if (params) {
      sessionStorage.setItem('requestParams', JSON.stringify(params));
    }

    // Navigate to the permissions request screen
    // This depends on your routing implementation
    window.location.hash = `/permissions-request?requestId=${requestId}`;
  }
});

// Render your React app
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
