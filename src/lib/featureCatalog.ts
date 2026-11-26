// Features that already exist in OrderFlow. The Feature Requests page matches what a
// user types against this list, so they find an existing feature before posting a
// request for it. The admin's "Already exists" reply also picks from this list.
//
// When you ship something new, add an entry here (with the words people would use
// to ask for it) in the same change as the What's New entry.

export interface CatalogFeature {
  /** Stable id, stored on a request marked "Already exists". Max 60 chars. */
  id: string;
  name: string;
  /** One or two sentences on what it does and where to find it. */
  description: string;
  /** In-app link. Must be a same-site path starting with "/". */
  href: string;
  /** Short "where" label for the button, e.g. "Open Follow-ups". */
  cta: string;
  /** Words people use when they ask for this. Matching also uses name and description. */
  keywords: string;
}

export const FEATURE_CATALOG: readonly CatalogFeature[] = [
  {
    id: 'follow-ups',
    name: 'Follow-ups page',
    description: 'Lists every order waiting on a mediator or a refund, how many working days it has waited, and a ready-made WhatsApp follow-up message.',
    href: '/follow-ups',
    cta: 'Open Follow-ups',
    keywords: 'follow up followup remind reminder chase nudge pending refund mediator whatsapp message overdue waiting late delay',
  },
  {
    id: 'mediator-whatsapp',
    name: 'Saved mediators with WhatsApp',
    description: 'Save mediators and their WhatsApp number under Account Settings → Mediators. Orders and Follow-ups then open their chat with the message already written.',
    href: '/account-settings',
    cta: 'Open Account Settings',
    keywords: 'mediator save number phone contact whatsapp chat list saved agent',
  },
  {
    id: 'saved-reviewers',
    name: 'Saved reviewer accounts',
    description: 'Save the reviewer accounts you use under Account Settings → Reviewers, then pick them on any order.',
    href: '/account-settings',
    cta: 'Open Account Settings',
    keywords: 'reviewer account accounts save saved list profile name names',
  },
  {
    id: 'name-suggestions',
    name: 'Mediator and reviewer name suggestions',
    description: 'On a new or edited order, start typing a mediator or reviewer name and matching names appear. Tap one to fill it in.',
    href: '/order-form',
    cta: 'Open Order Form',
    keywords: 'autocomplete autofill suggest suggestion suggestions type typing name fill dropdown remember mediator reviewer',
  },
  {
    id: 'theme-toggle',
    name: 'Light and dark theme',
    description: 'The sun/moon button in the top bar switches between light and dark on every page, and remembers your choice.',
    href: '/dashboard',
    cta: 'Go to Dashboard',
    keywords: 'dark light theme mode night colour color bright brightness eye white black darkmode',
  },
  {
    id: 'export-csv',
    name: 'Export orders to CSV',
    description: 'Dashboard → your profile icon → Export Data (CSV) downloads every order as a spreadsheet you can open in Excel or Google Sheets.',
    href: '/dashboard',
    cta: 'Go to Dashboard',
    keywords: 'export download csv excel spreadsheet sheet xlsx report data orders file',
  },
  {
    id: 'json-backup',
    name: 'Backup and restore',
    description: 'Dashboard → your profile icon → Backup Data (JSON) saves all your orders. Import Data restores them from that file.',
    href: '/dashboard',
    cta: 'Go to Dashboard',
    keywords: 'backup restore json save copy data lose lost safe recover',
  },
  {
    id: 'excel-import',
    name: 'Import old orders from Excel',
    description: 'Dashboard → your profile icon → Download Excel Template. Fill in your old orders, then use Import Data to add them all at once.',
    href: '/dashboard',
    cta: 'Go to Dashboard',
    keywords: 'import upload excel template old previous past existing orders xlsx',
  },
  {
    id: 'telegram-bot',
    name: 'Telegram order lookup',
    description: 'A Telegram bot shows an order\'s status when you send the Order ID and the email used on the order, without signing in.',
    href: '/contact',
    cta: 'See Contact page',
    keywords: 'telegram bot track tracking status lookup check order id',
  },
  {
    id: 'archive',
    name: 'Archive of paid orders',
    description: 'Orders marked Payment Received move to Archive, with dates, bank, reviewer, mediator and the amount received.',
    href: '/archive',
    cta: 'Open Archive',
    keywords: 'archive archived completed paid payment received history finished done past old closed',
  },
  {
    id: 'analytics',
    name: 'Order analytics',
    description: 'My Order Analytics shows monthly trends, platform split, status breakdown, and your top mediators and reviewers.',
    href: '/analytics',
    cta: 'Open Analytics',
    keywords: 'analytics chart charts graph stats statistics report trend monthly insight leaderboard top platform total summary dashboard',
  },
  {
    id: 'custom-platforms',
    name: 'Add your own platforms',
    description: 'Add any marketplace (Meesho, Ajio, Blinkit, Shopsy, Nykaa and more are already included) under Account Settings, or straight from the order form.',
    href: '/account-settings',
    cta: 'Open Account Settings',
    keywords: 'platform platforms add custom new marketplace store site meesho ajio blinkit shopsy nykaa',
  },
  {
    id: 'dropdown-settings',
    name: 'Customise dropdown lists',
    description: 'Under Account Settings you can edit the lists the order form uses, such as payment banks and order types.',
    href: '/account-settings',
    cta: 'Open Account Settings',
    keywords: 'dropdown option options list bank banks customise customize edit choices',
  },
  {
    id: 'filters-search',
    name: 'Dashboard search and filters',
    description: 'Search orders and filter the dashboard by status, platform and month, newest or oldest first.',
    href: '/dashboard',
    cta: 'Go to Dashboard',
    keywords: 'filter filters search find sort status platform month newest oldest lookup',
  },
  {
    id: 'return-window',
    name: 'Return window countdown',
    description: 'After you mark an order Delivered, the card counts down the return period and moves it to Refund Form Pending when it ends.',
    href: '/dashboard',
    cta: 'Go to Dashboard',
    keywords: 'return window period countdown days left delivered expire expiry closing date',
  },
  {
    id: 'review-timing',
    name: 'Review reminder timing',
    description: 'When you mark an order Delivered, choose when to submit the review: after 1, 3 or 7 days, or after the return period.',
    href: '/dashboard',
    cta: 'Go to Dashboard',
    keywords: 'review rating reminder submit when days after early pending',
  },
  {
    id: 'refund-form-link',
    name: 'Refund form link on each order',
    description: 'Save the mediator\'s refund form link on an order and copy it in one tap when it is time to fill it.',
    href: '/dashboard',
    cta: 'Go to Dashboard',
    keywords: 'refund form link copy url google form fill',
  },
  {
    id: 'whatsapp-copy',
    name: 'Copy order details for WhatsApp',
    description: 'Copy an order\'s details as a ready-to-send WhatsApp message from the order card.',
    href: '/dashboard',
    cta: 'Go to Dashboard',
    keywords: 'copy share whatsapp order details message send text',
  },
  {
    id: 'commission-deal',
    name: 'Commission deals',
    description: 'On the order form, choose "Commission deal instead?" when the mediator pays back the product amount plus a flat commission.',
    href: '/order-form',
    cta: 'Open Order Form',
    keywords: 'commission flat extra amount deal seller less percent percentage deduction',
  },
  {
    id: 'order-types',
    name: 'Order types',
    description: 'Pick the order type on the order form, including Order Deal, Rating, Review, Empty Box and Exchange Deal.',
    href: '/order-form',
    cta: 'Open Order Form',
    keywords: 'order type types deal exchange empty box rating review only',
  },
  {
    id: 'working-days',
    name: 'Working-day refund timelines',
    description: 'Refund follow-ups count working days (Monday to Friday), so reminders never land on a weekend.',
    href: '/follow-ups',
    cta: 'Open Follow-ups',
    keywords: 'working days weekend business days timeline 60 days count',
  },
  {
    id: 'contact',
    name: 'Contact the developer',
    description: 'Email, Telegram, Discord and WhatsApp are on the Contact page. On this page you can also use Talk to the developer.',
    href: '/contact',
    cta: 'Open Contact',
    keywords: 'contact support help email telegram discord whatsapp talk developer',
  },
];

export function findCatalogFeature(id: string | null | undefined): CatalogFeature | undefined {
  if (!id) return undefined;
  return FEATURE_CATALOG.find((f) => f.id === id);
}
