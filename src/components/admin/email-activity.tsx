'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useUser } from '@/firebase';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCw, Mail, Inbox, Search, Send, Clock3, ChevronRight } from 'lucide-react';

type Message = {
  id: string; subject?: string; recipientEmail?: string; recipientName?: string; status?: string; kind?: string;
  sentAt?: number; receivedAt?: number; from?: string; to?: string[]; text?: string; html?: string;
  bodyText?: string; bodyHtml?: string; campaignId?: string; lastEventAt?: number;
};
type Tab = 'inbox' | 'sent';
const dateLabel = (value?: number) => value ? new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Date unavailable';

export function EmailActivity() {
  const { user } = useUser();
  const [tab, setTab] = useState<Tab>('inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [replies, setReplies] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Message | null>(null);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/email/activity', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load email activity.');
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setReplies(Array.isArray(data.replies) ? data.replies : []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load email activity.'); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { void load(); }, [load]);
  const rows = useMemo(() => {
    const source = tab === 'inbox' ? replies : messages;
    const query = search.trim().toLowerCase();
    if (!query) return source;
    return source.filter(item => [item.subject, item.from, item.recipientEmail, item.recipientName, item.text, item.kind, item.status, ...(item.to || [])].some(value => String(value || '').toLowerCase().includes(query)));
  }, [tab, replies, messages, search]);

  return <>
    <section className="relative min-w-0 overflow-hidden rounded-2xl border border-white/80 bg-white/80 p-3 shadow-[0_18px_55px_-38px_rgba(58,45,30,0.35)] backdrop-blur-sm sm:p-5 lg:p-6">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-orange-200/30 blur-3xl" />
      <div className="relative space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#C65A16]">Mailbox</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">Your messages</h2><p className="mt-1 text-xs leading-5 text-zinc-500 sm:text-sm">Read incoming correspondence and review sent messages.</p></div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="h-10 w-full bg-white sm:w-auto"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh mailbox</Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setTab('inbox')} className={`rounded-xl border p-3 text-left transition-all sm:p-4 ${tab === 'inbox' ? 'border-orange-300 bg-orange-50/90 shadow-sm' : 'border-zinc-200 bg-white/80 hover:border-orange-200'}`}>
            <span className="flex items-center gap-2 text-xs font-semibold text-zinc-700"><Inbox className="h-4 w-4 text-[#D66A22]" />Inbox</span><p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">{replies.length}</p><p className="text-[11px] text-zinc-500">Incoming emails</p>
          </button>
          <button type="button" onClick={() => setTab('sent')} className={`rounded-xl border p-3 text-left transition-all sm:p-4 ${tab === 'sent' ? 'border-orange-300 bg-orange-50/90 shadow-sm' : 'border-zinc-200 bg-white/80 hover:border-orange-200'}`}>
            <span className="flex items-center gap-2 text-xs font-semibold text-zinc-700"><Send className="h-4 w-4 text-[#D66A22]" />Sent</span><p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">{messages.length}</p><p className="text-[11px] text-zinc-500">Outgoing messages</p>
          </button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder={tab === 'inbox' ? 'Search sender, subject or message…' : 'Search recipient, subject or status…'} className="h-11 bg-white pl-9 text-sm" /></div>
          <span className="px-1 text-xs text-zinc-500">{rows.length} {rows.length === 1 ? 'message' : 'messages'}</span>
        </div>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {loading ? <div className="space-y-3 py-3">{[1,2,3].map(n => <div key={n} className="h-20 animate-pulse rounded-xl bg-zinc-100" />)}</div> :
          rows.length === 0 ? <div className="rounded-xl border border-dashed border-zinc-300 bg-white/75 px-4 py-12 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-orange-50 text-[#D66A22]">{tab === 'inbox' ? <Inbox className="h-5 w-5" /> : <Send className="h-5 w-5" />}</div><p className="mt-3 text-sm font-semibold text-zinc-800">{search ? 'No matching messages' : tab === 'inbox' ? 'Your inbox is clear' : 'No sent messages yet'}</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-zinc-500">{search ? 'Try another sender, recipient or subject.' : tab === 'inbox' ? 'Incoming emails appear here when Resend inbound email is configured.' : 'Emails sent from the composer will appear here.'}</p></div> :
          <div className="space-y-2">{rows.map(item => {
            const inbox = tab === 'inbox';
            const person = inbox ? item.from || 'Unknown sender' : item.recipientName ? `${item.recipientName} · ${item.recipientEmail || ''}` : item.recipientEmail || 'Recipient unavailable';
            return <button type="button" key={item.id} onClick={() => setSelected(item)} className="group flex min-h-[82px] w-full min-w-0 flex-col gap-2 rounded-xl border border-zinc-200/80 bg-white/90 p-3 text-left transition-all hover:border-orange-200 hover:bg-orange-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
              <div className="flex min-w-0 flex-1 items-start gap-3"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 group-hover:bg-orange-100 group-hover:text-orange-700">{inbox ? <Inbox className="h-4 w-4" /> : <Mail className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-zinc-700">{person}</p><p className="mt-1 truncate text-sm font-semibold text-zinc-900">{item.subject || '(no subject)'}</p><p className="mt-1 line-clamp-1 text-xs text-zinc-500">{inbox ? item.text || 'Open to read this incoming message' : item.bodyText || item.kind || 'Open to review delivery details'}</p></div></div>
              <div className="flex items-center justify-between gap-3 pl-12 sm:justify-end sm:pl-0">{!inbox && <Badge variant={['FAILED','BOUNCED','COMPLAINED'].includes((item.status || '').toUpperCase()) ? 'destructive' : item.status === 'DELIVERED' ? 'default' : 'secondary'} className="shrink-0 text-[10px]">{item.status || 'SENT'}</Badge>}<span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-zinc-400"><Clock3 className="h-3 w-3" />{dateLabel(inbox ? item.receivedAt : item.sentAt)}</span><ChevronRight className="h-4 w-4 shrink-0 text-zinc-300" /></div>
            </button>;
          })}</div>}
        <p className="border-t border-zinc-100 pt-3 text-[10px] leading-5 text-zinc-400">Delivery statuses are updated by signed Resend webhooks. Incoming mail requires Resend inbound email configuration.</p>
      </div>
    </section>
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-20px)] max-w-3xl flex-col gap-0 overflow-hidden border-zinc-200 bg-[#FCFBF9] p-0 sm:w-full">
        {selected && <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-zinc-200 bg-white px-4 py-5 pr-12 sm:px-6"><DialogHeader><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline">{tab === 'inbox' ? 'INBOX' : 'SENT'}</Badge>{tab === 'sent' && <Badge variant={selected.status === 'DELIVERED' ? 'default' : selected.status === 'FAILED' || selected.status === 'BOUNCED' ? 'destructive' : 'secondary'}>{selected.status || 'SENT'}</Badge>}</div><DialogTitle className="break-words text-left text-lg leading-snug text-zinc-900 sm:text-xl">{selected.subject || '(no subject)'}</DialogTitle><DialogDescription className="mt-2 break-all text-left text-xs leading-5">{tab === 'inbox' ? `From: ${selected.from || 'Unknown sender'} · To: ${(selected.to || []).join(', ')}` : `To: ${selected.recipientEmail || 'Unknown recipient'} · ${selected.kind || 'General communication'}`}<span className="block pt-1">{dateLabel(tab === 'inbox' ? selected.receivedAt : selected.sentAt)}</span></DialogDescription></DialogHeader></div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-[#F5F3EF] p-3 sm:p-6">
            {((tab === 'inbox' && selected.html) || (tab === 'sent' && selected.bodyHtml)) ? <iframe title={tab === 'inbox' ? 'Incoming email content' : 'Sent email content'} srcDoc={tab === 'inbox' ? selected.html : selected.bodyHtml} sandbox="" referrerPolicy="no-referrer" className="min-h-[460px] w-full rounded-lg border border-zinc-200 bg-white sm:min-h-[600px]" /> :
              <article className="mx-auto min-h-[300px] max-w-2xl whitespace-pre-wrap break-words rounded-lg border border-zinc-200/80 bg-white p-4 text-sm leading-7 text-zinc-700 shadow-sm sm:p-8">{tab === 'inbox' ? selected.text || 'This email has no plain-text body.' : selected.bodyText || 'The message body was not saved for this older email. New messages will be available here.'}</article>}
            {tab === 'sent' && <p className="mx-auto mt-3 max-w-2xl text-[11px] text-zinc-500">Campaign reference: {selected.campaignId || '—'} · Last update: {dateLabel(selected.lastEventAt || selected.sentAt)}</p>}
          </div>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
