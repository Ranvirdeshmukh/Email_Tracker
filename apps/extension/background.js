// Background Service Worker
// Handles API calls for the extension (Manifest V3 requirement)

const API_BASE = 'http://localhost:8080';

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'createTrackedEmail') {
    createTrackedEmail(request.data)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'healthCheck') {
    healthCheck()
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function createTrackedEmail(data) {
  console.log('[MailTracker BG] Creating tracked email:', data);
  
  const response = await fetch(`${API_BASE}/api/emails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const result = await response.json();
  console.log('[MailTracker BG] Created:', result);
  return result;
}

async function healthCheck() {
  const response = await fetch(`${API_BASE}/health`);
  return response.json();
}

console.log('[MailTracker BG] Background service worker loaded');

