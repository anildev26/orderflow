# OrderFlow - E-commerce Order Manager

A full-featured order management portal built for e-commerce sellers to track orders, manage refunds, monitor payments, and analyze performance across multiple platforms.

## Features

### Orders Dashboard
- View all active orders with real-time status tracking
- Filter by status: Ordered, Delivered, Review/Rating Submitted, Refund Form Pending/Filled, Informed Mediator
- Filter by platform (Flipkart, Amazon, Myntra, and custom platforms)
- Sort by newest/oldest and filter by month
- KPI cards showing order counts, total amounts, refund tracking, and archive stats
- Color-coded status badges and left-border indicators for quick scanning

### Order Form
- Create new orders with platform, product, amount, reviewer, and mediator details
- Auto-fills logged-in user's email
- Add new platforms, mediators, and reviewers directly from the form or link to settings
- Mandatory fields validation with helpful hints and placeholders

### Order Updates & Status Flow
- Update order status through a guided flow: Ordered → Delivered → Review Submitted → Refund Form → Informed Mediator → Payment Received
- Track return periods with countdown timers after delivery
- Record payment bank details when marking as payment received
- Quick-copy refund form links from mediator messages
- Archive confirmation before moving completed orders

### Archive
- View all completed (payment received) orders
- Expandable order cards showing full details: dates, bank, reviewer, mediator, brand
- Track received amounts and seller deductions

### Analytics
- Monthly order trends with interactive charts
- Platform-wise order distribution (pie chart)
- Status breakdown visualization
- Top reviewers and mediators leaderboard
- Key metrics: total orders, total amount, average order value

### Account Settings
- **Account Tab**: Profile info, logout, data backup (JSON export), data import
- **Dropdown Settings Tab**: Customize platforms, mediators, reviewers, payment banks, and order types
- All settings persist per user via Supabase

### Additional Pages
- **Contact**: Email, Telegram, Discord, WhatsApp with pre-filled messages
- **Refund Form**: Dedicated refund submission page

### UI/UX
- Dark and light theme with smooth toggle (dark by default)
- Responsive design: collapsible sidebar on desktop (hover to expand), mobile hamburger menu
- Real-time toast notifications
- Tailwind CSS v4 with CSS custom properties theming

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| State Management | Zustand |
| Database & Auth | Supabase (PostgreSQL + Auth + RLS) |
| Charts | Chart.js + react-chartjs-2 |
| Icons | react-icons (Heroicons) |
| Notifications | react-hot-toast |
| Analytics | Vercel Analytics |
| Deployment | Vercel |

## Project Structure

```
src/
├── app/
│   ├── dashboard/        # Main orders dashboard
│   ├── order-form/       # Create new orders
│   ├── archive/          # Completed orders archive
│   ├── analytics/        # Order analytics & charts
│   ├── account-settings/ # User settings & dropdowns
│   ├── contact/          # Contact information
│   ├── refund-form/      # Refund submission
│   ├── login/            # Authentication
│   ├── signup/           # User registration
│   ├── forgot-password/  # Password recovery
│   └── auth/callback/    # OAuth callback
├── components/
│   ├── Sidebar.tsx       # Navigation sidebar
│   ├── OrderCard.tsx     # Order display card
│   ├── UpdateOrderModal.tsx # Status update modal
│   ├── FilterPanel.tsx   # Order filters
│   └── ThemeToggle.tsx   # Dark/light theme switch
├── store/
│   ├── useOrderStore.ts  # Orders state (Zustand)
│   └── useSettingsStore.ts # Settings state (Zustand)
├── context/
│   └── ThemeContext.tsx   # Theme provider
├── lib/
│   └── supabase.ts       # Supabase client
├── types/
│   └── order.ts          # TypeScript types & constants
└── middleware.ts          # Auth route protection
```

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project (free tier works)

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/orderflow.git
cd orderflow
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Set up Supabase
- Create the required tables (`orders`, `user_settings`) in your Supabase project
- Enable Row Level Security (RLS) policies
- Configure authentication (email/password with OTP)

### 5. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment on Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your GitHub repository
3. Add environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy - Vercel will auto-detect Next.js and configure the build

### Post-deployment
- Update your Supabase **Site URL** to your Vercel domain (e.g., `https://your-app.vercel.app`)
- Add the Vercel domain to Supabase **Redirect URLs**
- Update email templates in Supabase Auth settings for branded signup/reset emails

## License

This project is private and not licensed for redistribution.
