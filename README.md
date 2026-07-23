# EasyJob Kazakhstan

A production-ready MVP gig work / short-term job platform for Kazakhstan. Built with React, Tailwind CSS, Shadcn UI, and Supabase.

## Features

- **Jobs Feed (Explore)** — Search, filter by category & city, apply to open gigs
- **Create Job** — 3-step wizard to publish gigs (title, description, payment)
- **My Jobs** — Client tab (manage applicants, accept workers) & Worker tab (track applications)
- **In-App Chat** — Messaging between client and selected worker for active jobs
- **Profile** — Avatar, rating, client/worker mode switcher, job history
- **Reviews** — 1–5 star ratings with comments after job completion
- **PWA** — Installable progressive web app with offline manifest

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS, Shadcn UI, Lucide Icons |
| State | Zustand |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| Routing | React Router v7 |

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start dev server (uses mock data by default)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Mock Data Mode

By default, `VITE_USE_MOCK_DATA=true` in `.env.example`. The app runs fully offline with realistic Kazakh mock data — no Supabase account needed for development.

**Demo user:** Айдар Нурланов (`user-001`) — dual client/worker role with sample jobs, applications, and chat history.

## Connecting to Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL Editor
3. Update `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_USE_MOCK_DATA=false
```

4. Restart the dev server

## Project Structure

```
src/
├── components/
│   ├── ui/           # Shadcn UI primitives
│   ├── layout/       # AppLayout, BottomNav
│   └── jobs/         # JobCard, JobDetailsModal, ReviewModal
├── pages/            # Route-level screens
├── store/            # Zustand global state
├── data/             # Mock data for development
├── lib/              # Supabase client, utils, constants
└── types/            # TypeScript interfaces
supabase/
└── schema.sql        # Full database schema + RLS policies
```

## Business Flows

### Apply to Job
Worker clicks "Apply" → `job_applications` record created with `status: pending`

### Accept Worker
Client views applicants → clicks "Accept" → job status → `in_progress`, application → `accepted`, others → `rejected`

### Complete Job
Either party marks job `completed` → review modal opens → rating saved to `reviews`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Design

- Mobile-first (375px–430px optimized)
- Emerald green + indigo blue accent palette
- Bottom navigation on mobile, top nav on desktop
- Skeleton loaders, toast notifications, smooth animations

## License

MIT
