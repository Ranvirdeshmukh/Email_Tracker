// Extension configuration - single source of truth for URLs
//
// FOR LOCAL DEVELOPMENT:
// Keep API_BASE as localhost (only works with non-Gmail email clients)
//
// FOR GMAIL TESTING:
// 1. Run: cloudflared tunnel --url http://localhost:8080
// 2. Copy the https://xxx.trycloudflare.com URL
// 3. Replace API_BASE below with that URL
// 4. Reload extension and refresh Gmail

const CONFIG = {
  // Change this to your Cloudflare tunnel URL for Gmail testing
  API_BASE: 'http://localhost:8080',
  DASHBOARD_URL: 'http://localhost:3000',
};
