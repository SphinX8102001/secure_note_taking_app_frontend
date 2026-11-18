// Where the backend API lives.
// - Opened from localhost: talks to the local backend on port 4000.
// - Deployed: talks to the hosted backend. Replace the URL below with your
//   Render service URL after deploying the backend (no trailing slash).
window.API_BASE_URL = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? 'http://localhost:4000'
  : 'https://secure-notes-api.onrender.com';
