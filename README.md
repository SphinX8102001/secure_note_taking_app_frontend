# Secure Notes – Frontend

A minimal vanilla-JS client for the Secure Notes API. There is no framework and no build step: it is three static files.

| File | Purpose |
| --- | --- |
| `index.html` | page layout and forms |
| `app.js` | calls the API and renders notes, posts, interest groups and admin views |
| `config.js` | the backend URL |

All user content is rendered with `textContent`, never `innerHTML`.

## Run it locally

1. Start the backend (see the backend repository) on `http://localhost:4000`.
2. Serve this folder on any localhost port:
   ```bash
   npx serve -l 5173
   ```
3. Open http://localhost:5173.

When opened from `localhost`, `config.js` points to `http://localhost:4000` automatically.

## Deploy (Vercel or Netlify)

1. Set the production URL in `config.js` to your deployed backend, e.g. `https://secure-notes-api.onrender.com` (no trailing slash).
2. Import this repository on Vercel (framework preset **Other**, no build command, output directory `.`) or Netlify (no build command, publish directory `.`).
3. Add the resulting site URL to the backend's `CORS_ORIGIN` setting.
