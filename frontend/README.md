# ⚡ LeadIntel AI — Frontend

React 19 + Vite 7 frontend for the LeadIntel AI lead intelligence platform.

## 🌐 Live

**Production:** https://frontend-py0dda1db-sage1ll1001s-projects.vercel.app

---

## 🚀 Local Development

```bash
npm install
npm run dev
# → http://localhost:5173
```

Make sure the backend is running at `http://localhost:8000` (or set `VITE_API_BASE` env var).

## 📦 Production Build

```bash
npm run build
# Output → dist/
```

---

## 🗂️ Source Structure

```
src/
├── main.jsx          # React 19 entry point
├── App.jsx           # BrowserRouter + Navbar + 3 page routes
├── index.css         # Full design system (CSS variables, dark theme, glassmorphism)
├── api.js            # Centralised fetch layer for all backend calls
├── components/
│   ├── LeadsTable.jsx    # Sortable table, StatusCell, NotesCell, EmailModal
│   ├── SearchBar.jsx     # NL query input with hint chips
│   ├── Loader.jsx        # Animated spinner
│   └── Toast.jsx         # Global notification system (success/error/info)
└── pages/
    ├── SearchPage.jsx    # / — Hero search UI + recent searches
    ├── LeadsPage.jsx     # /leads — Dashboard with filters, sort, pagination, CSV
    └── HistoryPage.jsx   # /history — Search history + Re-run button
```

---

## 🔧 Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE` | Backend API URL | `http://localhost:8000` |

For production, set in `.env.production`:
```env
VITE_API_BASE=https://leadintel-backend.onrender.com
```

---

## 📋 Routes

| Path | Page | Description |
|---|---|---|
| `/` | SearchPage | Natural language lead search |
| `/leads` | LeadsPage | Leads dashboard with filtering & export |
| `/history` | HistoryPage | Search history with Re-run |

---

## 🏗️ Key Files

### `api.js`
All backend calls go through here — single source of truth for the API base URL.

| Function | Method | Endpoint |
|---|---|---|
| `searchLeads(query)` | POST | `/search-leads` |
| `getLeads({ page, limit, search, status, sort_by, order })` | GET | `/leads` |
| `updateLead(id, { status, notes })` | PATCH | `/leads/{id}` |
| `getSearchHistory({ page, limit, order })` | GET | `/search-history` |
| `generateEmail(lead)` | POST | `/generate-email` |
| `downloadLeadsUrl(params)` | — | Returns CSV download URL |

### `vercel.json`
Configures SPA routing so React Router handles all paths:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

---

## 🎨 Design System

`index.css` provides the entire visual design system:
- CSS custom properties for colours, gradients, spacing, shadows
- Dark mode with glassmorphism cards
- Responsive at 768px breakpoint
- Status badges: New (blue) · Contacted (yellow) · Qualified (green) · Rejected (red)
- Animations: `spin`, `fadeIn`, `slideUp`, `slideInRight`
