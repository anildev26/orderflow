import type { Metadata } from 'next';

/** Public site origin. Swap this when a custom domain replaces the Vercel host. */
export const SITE_URL = 'https://orderflow-manager.vercel.app';

export const SITE_NAME = 'OrderFlow';

export const SITE_TITLE = 'OrderFlow — Free order manager and refund tracker';

export const SITE_DESCRIPTION =
  'Free order management app for agency and mediator work. Track orders, reviews, and refunds across Indian marketplaces. Email, Telegram, and Discord support.';

export const noIndexMetadata: Metadata = {
  robots: { index: false, follow: false },
};

export const HOME_FAQ = [
  {
    question: 'Is OrderFlow free?',
    answer: 'Yes. Create an account with no credit card. There is no paid plan in the app today.',
  },
  {
    question: 'Who is it for?',
    answer: 'People who handle review-based orders through agencies and mediators, not a general warehouse system.',
  },
  {
    question: 'What can I track?',
    answer: 'Order status from ordered through delivery, review, refund form, and payment received, plus mediator messages.',
  },
  {
    question: 'Can I try it first?',
    answer: 'Yes. The live demo is on this site, with sample orders and no account required.',
  },
  {
    question: 'How do I get help?',
    answer: 'Email, Telegram, Discord, and WhatsApp are listed on the Contact page. You do not need an account to open it.',
  },
] as const;

export function homeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: SITE_NAME,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: `${SITE_URL}/`,
        description:
          'Free order manager for agency and mediator workflows. Track marketplace orders, reviews, and refunds.',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'INR',
        },
        featureList: [
          'Order dashboard for Flipkart, Amazon, Meesho, Myntra, and other marketplaces',
          'Review and refund status tracking',
          'Mediator message and refund-form link storage',
          'Excel import and CSV or JSON export',
          'Telegram order lookup',
        ],
      },
      {
        '@type': 'Organization',
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        email: 'anilsahu2672000@gmail.com',
        logo: `${SITE_URL}/icon.svg`,
      },
      {
        '@type': 'FAQPage',
        mainEntity: HOME_FAQ.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
    ],
  };
}
