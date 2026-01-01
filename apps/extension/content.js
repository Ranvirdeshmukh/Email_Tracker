// Email Tracker Content Script
// Runs on mail.google.com

(function () {
  'use strict';

  console.log('mailtracker loaded');

  // Create floating dashboard button
  function createDashboardButton() {
    const button = document.createElement('button');
    button.id = 'mailtracker-dashboard-btn';
    button.textContent = 'Open Dashboard';
    button.addEventListener('click', () => {
      window.open(CONFIG.DASHBOARD_URL, '_blank');
    });
    document.body.appendChild(button);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createDashboardButton);
  } else {
    createDashboardButton();
  }
})();
