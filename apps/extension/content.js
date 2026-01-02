// Email Tracker Content Script
// Runs on mail.google.com

(function () {
  'use strict';

  console.log('[MailTracker] Extension loaded');

  // Track which compose windows we've already processed
  const processedComposeWindows = new WeakSet();
  
  // Store tracking state per compose window
  const composeWindowStates = new WeakMap();

  // ============================================
  // Gmail DOM Selectors (Gmail's DOM is complex)
  // ============================================
  
  const SELECTORS = {
    // Compose window dialog
    composeWindow: 'div[role="dialog"]',
    // Message body (contenteditable div)
    messageBody: 'div[aria-label="Message Body"], div[g_editable="true"], div[contenteditable="true"].editable',
    // To field
    toField: 'input[aria-label="To recipients"], input[aria-label="To"], textarea[aria-label="To recipients"]',
    // Subject field  
    subjectField: 'input[name="subjectbox"], input[aria-label="Subject"]',
    // Send button - Gmail uses various attributes
    sendButton: 'div[role="button"][aria-label*="Send"], div[data-tooltip*="Send"]',
    // Compose toolbar (where we'll add our toggle)
    composeToolbar: 'tr.btC td.gU',
  };

  // ============================================
  // API Functions (via Background Script)
  // ============================================

  async function createTrackedEmail(recipient, subject) {
    return new Promise((resolve) => {
      console.log('[MailTracker] Sending to background:', { recipient, subject });
      
      chrome.runtime.sendMessage(
        {
          action: 'createTrackedEmail',
          data: {
            recipient: recipient,
            subject: subject,
            sender: 'me',
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('[MailTracker] Runtime error:', chrome.runtime.lastError);
            resolve(null);
            return;
          }
          
          if (response && response.success) {
            console.log('[MailTracker] Created tracked email:', response.data.id);
            resolve(response.data);
          } else {
            console.error('[MailTracker] API Error:', response?.error);
            resolve(null);
          }
        }
      );
    });
  }

  // ============================================
  // UI Components
  // ============================================

  function createTrackingToggle(composeWindow) {
    // Create toggle container
    const container = document.createElement('div');
    container.className = 'mailtracker-toggle-container';
    container.innerHTML = `
      <label class="mailtracker-toggle">
        <input type="checkbox" checked>
        <span class="mailtracker-toggle-slider"></span>
        <span class="mailtracker-toggle-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          Track
        </span>
      </label>
    `;

    const checkbox = container.querySelector('input[type="checkbox"]');
    
    // Store state
    composeWindowStates.set(composeWindow, { trackingEnabled: true });
    
    checkbox.addEventListener('change', (e) => {
      const state = composeWindowStates.get(composeWindow);
      if (state) {
        state.trackingEnabled = e.target.checked;
        console.log('[MailTracker] Tracking:', e.target.checked ? 'enabled' : 'disabled');
      }
    });

    return container;
  }

  function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `mailtracker-notification mailtracker-notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // ============================================
  // Gmail Integration
  // ============================================

  function findComposeElements(composeWindow) {
    // Find message body - try multiple selectors
    let messageBody = composeWindow.querySelector('div[aria-label="Message Body"]');
    if (!messageBody) {
      messageBody = composeWindow.querySelector('div[g_editable="true"]');
    }
    if (!messageBody) {
      // Fallback: find contenteditable div within compose
      const editables = composeWindow.querySelectorAll('div[contenteditable="true"]');
      messageBody = Array.from(editables).find(el => {
        // Skip small editables (like subject line if contenteditable)
        return el.offsetHeight > 50;
      });
    }

    // Find to field
    let toField = composeWindow.querySelector('input[aria-label="To recipients"]');
    if (!toField) {
      toField = composeWindow.querySelector('input[aria-label="To"]');
    }
    if (!toField) {
      toField = composeWindow.querySelector('textarea[name="to"]');
    }
    if (!toField) {
      // Look for To row and find input within
      const toRow = composeWindow.querySelector('[data-hovercard-id], [email]');
      if (toRow) {
        toField = { value: toRow.getAttribute('email') || toRow.getAttribute('data-hovercard-id') };
      }
    }

    // Find subject field
    let subjectField = composeWindow.querySelector('input[name="subjectbox"]');
    if (!subjectField) {
      subjectField = composeWindow.querySelector('input[aria-label="Subject"]');
    }

    // Find send button
    let sendButton = composeWindow.querySelector('div[role="button"][aria-label*="Send"]');
    if (!sendButton) {
      sendButton = composeWindow.querySelector('div[data-tooltip*="Send"]');
    }
    if (!sendButton) {
      // Fallback: look for button with "Send" text
      const buttons = composeWindow.querySelectorAll('div[role="button"]');
      sendButton = Array.from(buttons).find(btn => {
        const text = btn.textContent || '';
        const label = btn.getAttribute('aria-label') || '';
        return text.includes('Send') || label.includes('Send');
      });
    }

    return { messageBody, toField, subjectField, sendButton };
  }

  function getRecipients(composeWindow) {
    // Gmail shows recipients as chips/pills with email attribute
    const recipientChips = composeWindow.querySelectorAll('[email], [data-hovercard-id]');
    const emails = [];
    
    recipientChips.forEach(chip => {
      const email = chip.getAttribute('email') || chip.getAttribute('data-hovercard-id');
      if (email && email.includes('@')) {
        emails.push(email);
      }
    });

    // Also check input field
    const toInput = composeWindow.querySelector('input[aria-label="To recipients"], input[aria-label="To"]');
    if (toInput && toInput.value && toInput.value.includes('@')) {
      emails.push(toInput.value);
    }

    return [...new Set(emails)]; // Remove duplicates
  }

  function getSubject(composeWindow) {
    const subjectInput = composeWindow.querySelector('input[name="subjectbox"], input[aria-label="Subject"]');
    return subjectInput ? subjectInput.value : '';
  }

  function injectTrackingPixel(messageBody, trackingUrl) {
    if (!messageBody) {
      console.error('[MailTracker] No message body found');
      return false;
    }

    // Create invisible tracking pixel
    const pixel = document.createElement('img');
    pixel.src = trackingUrl;
    pixel.width = 1;
    pixel.height = 1;
    pixel.style.cssText = 'display:none!important;width:1px!important;height:1px!important;opacity:0!important;';
    pixel.alt = '';
    
    // Add at the end of the message body
    messageBody.appendChild(pixel);
    
    console.log('[MailTracker] Tracking pixel injected:', trackingUrl);
    return true;
  }

  // ============================================
  // Compose Window Processing
  // ============================================

  function processComposeWindow(composeWindow) {
    // Skip if already processed
    if (processedComposeWindows.has(composeWindow)) {
      return;
    }

    // Verify this is actually a compose window (has message body)
    const { messageBody, sendButton } = findComposeElements(composeWindow);
    
    if (!messageBody) {
      // Not a compose window, or not fully loaded yet
      return;
    }

    console.log('[MailTracker] Found compose window');
    processedComposeWindows.add(composeWindow);

    // Add tracking toggle to compose window
    const toggle = createTrackingToggle(composeWindow);
    
    // Find a good place to insert the toggle
    // Try to find the formatting toolbar
    const toolbar = composeWindow.querySelector('tr.btC td.gU');
    if (toolbar) {
      toolbar.appendChild(toggle);
    } else {
      // Fallback: insert near the bottom of compose window
      const bottomArea = composeWindow.querySelector('table[role="presentation"]');
      if (bottomArea) {
        bottomArea.parentNode.insertBefore(toggle, bottomArea);
      } else {
        // Last resort: prepend to compose window
        composeWindow.insertBefore(toggle, composeWindow.firstChild);
      }
    }

    // Intercept send button click
    if (sendButton) {
      interceptSendButton(composeWindow, sendButton);
    } else {
      // If send button not found immediately, observe for it
      const observer = new MutationObserver(() => {
        const { sendButton: btn } = findComposeElements(composeWindow);
        if (btn) {
          interceptSendButton(composeWindow, btn);
          observer.disconnect();
        }
      });
      observer.observe(composeWindow, { childList: true, subtree: true });
    }
  }

  function interceptSendButton(composeWindow, sendButton) {
    // We can't directly intercept Gmail's send, but we can detect the click
    // and inject our pixel before Gmail processes it
    
    sendButton.addEventListener('click', async (e) => {
      const state = composeWindowStates.get(composeWindow);
      
      if (!state || !state.trackingEnabled) {
        console.log('[MailTracker] Tracking disabled for this email');
        return; // Let send proceed without tracking
      }

      // Get email details
      const recipients = getRecipients(composeWindow);
      const subject = getSubject(composeWindow);
      const { messageBody } = findComposeElements(composeWindow);

      if (recipients.length === 0) {
        console.warn('[MailTracker] No recipients found');
        return;
      }

      console.log('[MailTracker] Sending tracked email to:', recipients.join(', '));

      // Create tracked email via API
      const trackedEmail = await createTrackedEmail(
        recipients.join(', '),
        subject || '(No subject)'
      );

      if (trackedEmail && trackedEmail.tracking_url) {
        // Inject tracking pixel
        const injected = injectTrackingPixel(messageBody, trackedEmail.tracking_url);
        
        if (injected) {
          showNotification(`Tracking enabled for: ${recipients[0]}`);
        }
      } else {
        console.error('[MailTracker] Failed to create tracked email');
        showNotification('Tracking failed - email will send without tracking', 'error');
      }
    }, true); // Use capture phase to run before Gmail's handler
  }

  // ============================================
  // Main Observer
  // ============================================

  function observeGmail() {
    // Process any existing compose windows
    document.querySelectorAll(SELECTORS.composeWindow).forEach(processComposeWindow);

    // Watch for new compose windows
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node is a compose window
            if (node.matches && node.matches(SELECTORS.composeWindow)) {
              // Wait a bit for Gmail to fully render the compose window
              setTimeout(() => processComposeWindow(node), 500);
            }
            // Also check children
            const composeWindows = node.querySelectorAll?.(SELECTORS.composeWindow);
            composeWindows?.forEach(cw => {
              setTimeout(() => processComposeWindow(cw), 500);
            });
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log('[MailTracker] Gmail observer started');
  }

  // ============================================
  // Dashboard Button (Keep existing functionality)
  // ============================================

  function createDashboardButton() {
    const button = document.createElement('button');
    button.id = 'mailtracker-dashboard-btn';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="3" y1="9" x2="21" y2="9"></line>
        <line x1="9" y1="21" x2="9" y2="9"></line>
      </svg>
      Dashboard
    `;
    button.addEventListener('click', () => {
      window.open(CONFIG.DASHBOARD_URL, '_blank');
    });
    document.body.appendChild(button);
  }

  // ============================================
  // Initialize
  // ============================================

  function init() {
    createDashboardButton();
    
    // Wait for Gmail to fully load
    if (document.querySelector('div[role="main"]')) {
      observeGmail();
    } else {
      // Gmail not ready yet, wait for it
      const readyObserver = new MutationObserver(() => {
        if (document.querySelector('div[role="main"]')) {
          readyObserver.disconnect();
          observeGmail();
        }
      });
      readyObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
