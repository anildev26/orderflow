'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  DEVELOPER,
  LIMITS,
  availabilityText,
  isSafeHttpsUrl,
  timeAgo,
  whatsAppLink,
  whatsAppText,
} from '@/lib/featureRequests';
import { useFeatureRequestStore } from '@/store/useFeatureRequestStore';
import { WhatsAppGlyph } from '@/components/WhatsAppChatLink';
import { CharCount, CloseButton, Spinner, btnPrimary, inputClass, useLayer } from './ui';

const DOT: Record<string, string> = { available: 'bg-accent-green', busy: 'bg-accent-yellow', away: 'bg-text-muted' };

export default function TalkToDeveloper({
  open,
  mode,
  contextRequestId,
  onOpenChange,
  onModeChange,
}: {
  open: boolean;
  mode: 'menu' | 'chat';
  contextRequestId: string | null;
  onOpenChange: (open: boolean) => void;
  onModeChange: (mode: 'menu' | 'chat') => void;
}) {
  const settings = useFeatureRequestStore((s) => s.settings);
  const messages = useFeatureRequestStore((s) => s.myMessages);
  const contextTitle = useFeatureRequestStore((s) => (contextRequestId ? s.requests.find((r) => r.id === contextRequestId)?.title ?? null : null));
  const unread = messages.filter((m) => m.fromAdmin && !m.readByUser).length;

  const anyChannel = settings.whatsappEnabled || settings.telegramEnabled || settings.inappEnabled || isSafeHttpsUrl(settings.callUrl);
  if (!anyChannel) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          onModeChange(unread > 0 && settings.inappEnabled ? 'chat' : 'menu');
          onOpenChange(!open);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? `Talk to the developer, ${unread} new ${unread === 1 ? 'reply' : 'replies'}` : 'Talk to the developer'}
        className="fixed z-20 right-4 bottom-4 md:right-6 md:bottom-6 inline-flex items-center gap-2 rounded-full bg-accent-blue text-white shadow-lg shadow-accent-blue/30 hover:opacity-95 transition p-2 sm:pl-2 sm:pr-4"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <span className="relative w-8 h-8 rounded-full bg-white/25 grid place-items-center text-xs font-bold">
          {DEVELOPER.name.charAt(0)}
          <span className={`absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-accent-blue ${DOT[settings.availability]}`} />
        </span>
        <span className="hidden sm:inline text-sm font-semibold">Talk to the developer</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-red text-white text-[10px] font-bold grid place-items-center">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <Sheet
          mode={mode}
          contextRequestId={contextRequestId}
          contextTitle={contextTitle}
          onClose={() => onOpenChange(false)}
          onModeChange={onModeChange}
        />
      )}
    </>
  );
}

function Sheet({
  mode,
  contextRequestId,
  contextTitle,
  onClose,
  onModeChange,
}: {
  mode: 'menu' | 'chat';
  contextRequestId: string | null;
  contextTitle: string | null;
  onClose: () => void;
  onModeChange: (mode: 'menu' | 'chat') => void;
}) {
  const settings = useFeatureRequestStore((s) => s.settings);
  useLayer(onClose, { lockScroll: false });
  const callOk = isSafeHttpsUrl(settings.callUrl);

  return (
    <>
      <div className="fixed inset-0 z-20 md:bg-transparent bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label="Talk to the developer"
        className="fixed z-30 inset-x-0 bottom-0 md:inset-x-auto md:right-6 md:bottom-24 md:w-[360px] max-h-[85vh] flex flex-col bg-dashboard-card border border-dashboard-border rounded-t-2xl md:rounded-2xl shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-dashboard-border">
          {mode === 'chat' ? (
            <button type="button" onClick={() => onModeChange('menu')} aria-label="Back" className="w-8 h-8 grid place-items-center rounded-lg text-text-muted hover:text-text-primary hover:bg-dashboard-bg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
          ) : (
            <span className="w-9 h-9 rounded-full bg-accent-blue text-white grid place-items-center font-bold flex-shrink-0">{DEVELOPER.name.charAt(0)}</span>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary">{mode === 'chat' ? 'Message the developer' : `Hi, I'm ${DEVELOPER.name}. I build OrderFlow.`}</p>
            <p className="text-[11px] text-text-muted flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${DOT[settings.availability]}`} aria-hidden="true" />
              {availabilityText(settings)}
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {mode === 'menu' ? (
          <div className="p-2 space-y-1 overflow-y-auto">
            {settings.whatsappEnabled && (
              <ChannelLink
                href={whatsAppLink(whatsAppText(contextTitle))}
                icon={<span className="w-8 h-8 rounded-lg bg-[#25D366] text-white grid place-items-center"><WhatsAppGlyph className="w-4 h-4" /></span>}
                title="Chat on WhatsApp"
                hint={contextTitle ? 'Opens with this request mentioned' : 'Opens with your message started'}
              />
            )}
            {settings.telegramEnabled && (
              <ChannelLink
                href={DEVELOPER.telegramUrl}
                icon={<span className="w-8 h-8 rounded-lg bg-sky-500 text-white grid place-items-center text-[11px] font-bold">TG</span>}
                title="Chat on Telegram"
                hint="If you would rather not share your number"
              />
            )}
            {settings.inappEnabled && (
              <button type="button" onClick={() => onModeChange('chat')} className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-accent-blue/10 transition">
                <span className="w-8 h-8 rounded-lg bg-accent-blue text-white grid place-items-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-text-primary">Leave a message here</span>
                  <span className="block text-[11px] text-text-muted">The reply shows up on this page</span>
                </span>
              </button>
            )}
            {callOk && settings.callUrl && (
              <ChannelLink
                href={settings.callUrl}
                icon={<span className="w-8 h-8 rounded-lg bg-violet-500 text-white grid place-items-center text-[11px] font-bold">15</span>}
                title="Book a 15-minute call"
                hint="For bigger ideas"
              />
            )}
          </div>
        ) : (
          <Chat contextRequestId={contextRequestId} contextTitle={contextTitle} />
        )}
      </div>
    </>
  );
}

function ChannelLink({ href, icon, title, hint }: { href: string; icon: React.ReactNode; title: string; hint: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent-blue/10 transition">
      {icon}
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-text-primary">{title}</span>
        <span className="block text-[11px] text-text-muted">{hint}</span>
      </span>
    </a>
  );
}

function Chat({ contextRequestId, contextTitle }: { contextRequestId: string | null; contextTitle: string | null }) {
  const messages = useFeatureRequestStore((s) => s.myMessages);
  const sendMessage = useFeatureRequestStore((s) => s.sendMessage);
  const refresh = useFeatureRequestStore((s) => s.refreshMyMessages);
  const markRead = useFeatureRequestStore((s) => s.markMyMessagesRead);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refresh()
      .then(() => markRead())
      .catch(() => markRead());
  }, [refresh, markRead]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const send = async () => {
    if (sending) return;
    setSending(true);
    setError('');
    try {
      await sendMessage(body, {
        page: contextRequestId ? `/feature-requests#${contextRequestId}` : '/feature-requests',
        requestId: contextRequestId,
      });
      setBody('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not send your message.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex-1 min-h-[160px] max-h-[45vh] overflow-y-auto px-3 py-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-text-muted text-center py-6">
            Ask anything: a feature you cannot find, an idea, or something confusing. Only the developer can read this.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-xl px-3 py-2 text-sm max-w-[88%] ${
              m.fromAdmin ? 'bg-accent-blue/10 border border-accent-blue/30 text-text-primary' : 'ml-auto bg-dashboard-bg border border-dashboard-border text-text-secondary'
            }`}
          >
            <p className={`text-[10px] mb-0.5 ${m.fromAdmin ? 'text-accent-blue font-semibold' : 'text-text-muted'}`}>
              {m.fromAdmin ? DEVELOPER.name : 'You'} · {timeAgo(m.createdAt)}
            </p>
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="border-t border-dashboard-border p-3 space-y-2">
        {contextTitle && <p className="text-[11px] text-text-muted truncate">About: {contextTitle}</p>}
        <div className="relative">
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (error) setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            rows={3}
            maxLength={LIMITS.messageMax}
            placeholder="Write your message…"
            className={`${inputClass} resize-none pr-16`}
            aria-label="Message to the developer"
          />
          <span className="absolute bottom-2 right-3"><CharCount value={body} max={LIMITS.messageMax} /></span>
        </div>
        {error && <p role="alert" className="text-xs text-accent-red">{error}</p>}
        <button type="button" onClick={send} disabled={sending || !body.trim()} className={`${btnPrimary} w-full`}>
          {sending && <Spinner className="w-3.5 h-3.5" light />}
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
