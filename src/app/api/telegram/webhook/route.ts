import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter } from '@/lib/rate-limit';

const STATUS_LABELS: Record<string, string> = {
  ordered: '🛒 Ordered',
  delivered: '📦 Delivered',
  review_rating_submitted: '⭐ Review/Rating Submitted',
  refund_form_pending: '⏳ Refund Form Pending',
  refund_form_filled: '📝 Refund Form Filled',
  informed_mediator: '📢 Informed Mediator',
  payment_received: '✅ Payment Received',
  order_cancelled: '❌ Order Cancelled',
};

const PLATFORM_LABELS: Record<string, string> = {
  amazon: '🛍️ Amazon',
  flipkart: '🛒 Flipkart',
  meesho: '🏪 Meesho',
  myntra: '👗 Myntra',
  ajio: '👔 Ajio',
  blinkit: '⚡ Blinkit',
  jio: '📱 Jio',
  other: '🔗 Other',
};

// Rate limiter: 20 requests per minute per chat ID
const rateLimiter = new RateLimiter(20, 60 * 1000);

const MAX_PAYLOAD_BYTES = 100 * 1024; // 100 KB
const MAX_INPUT_LENGTH = 100;
const ORDER_ID_PATTERN = /^[a-zA-Z0-9\-_]+$/;

function fmt(val: string | null | undefined): string {
  return val?.trim() ? val.trim() : '—';
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number | null | undefined): string {
  if (val == null) return '—';
  return `₹${val.toLocaleString('en-IN')}`;
}

function buildOrderMessage(order: Record<string, unknown>): string {
  const status = order.status as string;
  const platform = order.platform as string;

  const lines: string[] = [
    `<b>📋 Order Details</b>`,
    ``,
    `<b>Order ID:</b> <code>${order.order_id}</code>`,
    `<b>Platform:</b> ${PLATFORM_LABELS[platform] ?? fmt(platform)}`,
    `<b>Status:</b> ${STATUS_LABELS[status] ?? fmt(status)}`,
    ``,
    `<b>Product:</b> ${fmt(order.product_name as string)}`,
    `<b>Brand:</b> ${fmt(order.brand_name as string)}`,
    `<b>Order Type:</b> ${fmt(order.order_type as string)}`,
    `<b>Order Date:</b> ${fmtDate(order.order_date as string)}`,
    ``,
    `<b>Amount:</b> ${fmtAmount(order.total_amount as number)}`,
    `<b>Seller Less:</b> ${fmtAmount(order.seller_less as number)}`,
    ``,
    `<b>Email:</b> ${fmt(order.email as string)}`,
    `<b>Mediator:</b> ${fmt(order.mediator_name as string)}`,
    `<b>Reviewer:</b> ${fmt(order.reviewer_name as string)}`,
  ];

  if (order.delivered_date) {
    lines.push(`<b>Delivered On:</b> ${fmtDate(order.delivered_date as string)}`);
    if (order.return_period_days) lines.push(`<b>Return Period:</b> ${order.return_period_days} days`);
  }
  if (order.review_rating_date) lines.push(`<b>Review/Rating Date:</b> ${fmtDate(order.review_rating_date as string)}`);
  if (order.refund_form_filled_date) lines.push(`<b>Refund Form Filled:</b> ${fmtDate(order.refund_form_filled_date as string)}`);
  if (order.informed_mediator_date) lines.push(`<b>Mediator Informed:</b> ${fmtDate(order.informed_mediator_date as string)}`);
  if (order.payment_received_date) lines.push(`<b>Payment Received:</b> ${fmtDate(order.payment_received_date as string)}`);
  if (order.payment_bank) lines.push(`<b>Payment Bank:</b> ${fmt(order.payment_bank as string)}`);

  if (order.is_replacement) {
    lines.push(``, `<b>🔄 Replacement Order</b>`);
    if (order.replacement_order_id) lines.push(`<b>Replacement ID:</b> <code>${order.replacement_order_id}</code>`);
  }
  if (order.is_exchange) {
    lines.push(``, `<b>🔃 Exchange Order</b>`);
    if (order.exchange_product_name) lines.push(`<b>Exchange Product:</b> ${fmt(order.exchange_product_name as string)}`);
  }
  if (order.mediator_message) lines.push(``, `<b>💬 Mediator Message:</b>`, fmt(order.mediator_message as string));

  return lines.join('\n');
}

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

async function lookupOrder(chatId: number, orderId: string): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .ilike('order_id', orderId);

  if (error) {
    await sendTelegramMessage(chatId, '⚠️ Something went wrong while fetching order details. Please try again.');
    return;
  }

  if (!orders || orders.length === 0) {
    await sendTelegramMessage(chatId, `🔍 No order found with ID <code>${orderId}</code>.\n\nPlease check the Order ID and try again.`);
    return;
  }

  for (const order of orders) {
    await sendTelegramMessage(chatId, buildOrderMessage(order));
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Webhook secret validation
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
      const token = req.headers.get('x-telegram-bot-api-secret-token');
      if (token !== webhookSecret) {
        return NextResponse.json({ ok: false }, { status: 401 });
      }
    }

    // 2. Payload size limit
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ ok: true });
    }

    const body = await req.json();
    const message = body?.message;
    if (!message?.text || !message?.chat?.id) {
      return NextResponse.json({ ok: true });
    }

    const chatId: number = message.chat.id;

    // 3. Rate limiting per chat ID
    const { allowed, retryAfterMs } = rateLimiter.check(String(chatId));
    if (!allowed) {
      const waitMin = Math.ceil(retryAfterMs / 60000);
      await sendTelegramMessage(chatId, `⏳ Too many requests. Please wait ${waitMin} minute${waitMin !== 1 ? 's' : ''} before trying again.`);
      return NextResponse.json({ ok: true });
    }

    // 4. Input sanitization
    const rawText = message.text.trim();
    if (rawText.length > MAX_INPUT_LENGTH) {
      await sendTelegramMessage(chatId, '⚠️ Input too long. Order IDs should be under 100 characters.');
      return NextResponse.json({ ok: true });
    }

    // Handle commands (/start or /start@botname or /start ORDERID deep link)
    if (rawText.startsWith('/')) {
      const parts = rawText.split(' ');
      const command = parts[0].split('@')[0].toLowerCase();
      const deepLinkParam = parts[1]?.trim();

      if (command === '/start' && deepLinkParam) {
        if (!ORDER_ID_PATTERN.test(deepLinkParam) || deepLinkParam.length > MAX_INPUT_LENGTH) {
          await sendTelegramMessage(chatId, '⚠️ Invalid Order ID format.');
          return NextResponse.json({ ok: true });
        }
        await lookupOrder(chatId, deepLinkParam);
      } else if (command === '/start') {
        await sendTelegramMessage(
          chatId,
          `🛒 <b>Welcome to OrderFlow Bot!</b>\n\n` +
          `I can instantly look up any order for you — no login needed.\n\n` +
          `<b>How to use:</b>\n` +
          `Simply send me an <b>Order ID</b> and I'll show you everything about that order — status, dates, amounts, mediator details, and more.\n\n` +
          `<b>Example:</b>\n` +
          `<code>MH1234567890</code>\n\n` +
          `<b>Commands:</b>\n` +
          `/start — Show this message\n` +
          `/help — How to use this bot\n\n` +
          `Go ahead, send an Order ID to get started! 👇`
        );
      } else if (command === '/help') {
        await sendTelegramMessage(
          chatId,
          `ℹ️ <b>OrderFlow Bot — Help</b>\n\n` +
          `<b>What can this bot do?</b>\n` +
          `Look up full order details using just an Order ID.\n\n` +
          `<b>What details will I see?</b>\n` +
          `• Order status & platform\n` +
          `• Product & brand name\n` +
          `• Order & delivery dates\n` +
          `• Amount & seller less\n` +
          `• Mediator & reviewer info\n` +
          `• Refund, payment & review dates\n` +
          `• Replacement / exchange info\n\n` +
          `<b>How to search:</b>\n` +
          `Just type or paste the Order ID and send it.\n\n` +
          `<code>MH1234567890</code>`
        );
      }
      return NextResponse.json({ ok: true });
    }

    // 5. Order ID format validation before DB query
    if (!ORDER_ID_PATTERN.test(rawText)) {
      await sendTelegramMessage(chatId, `🔍 No order found with ID <code>${rawText}</code>.\n\nPlease check the Order ID and try again.`);
      return NextResponse.json({ ok: true });
    }

    await lookupOrder(chatId, rawText);
    return NextResponse.json({ ok: true });

  } catch {
    return NextResponse.json({ ok: true });
  }
}
