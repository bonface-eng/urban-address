'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-layout';
import { useUser } from '@/lib/data';
import { useProfile } from '@/hooks/use-profile';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity, AlertCircle, Bot, CheckCircle2, Clock3, Command,
  ExternalLink, Loader2, RefreshCw, ShieldCheck, Webhook, Users, UserPlus, Pencil, Trash2, Smartphone, MapPin
} from 'lucide-react';

type TelegramAccessUser = { telegramUserId: string; role: 'OWNER' | 'MANAGER' | 'STAFF'; name: string; branchIds: string[]; source: 'DATABASE' | 'ENVIRONMENT'; updatedAt?: number };

type TelegramStatus = {
  mpesa: { configured: boolean; environment: string; missing: string[] };
  maps: { configured: boolean; provider: string; apiKeyRequired: boolean };
  bot: { id: number; firstName: string; username: string; canJoinGroups?: boolean } | null;
  webhook: { url: string; pendingUpdateCount: number; lastErrorDate: number | null; lastErrorMessage: string | null; maxConnections?: number } | null;
  access: { total: number; owners: number; managers: number; staff: number };
  commands: { command: string; description: string; roles: string }[];
  activity: { id: string; status: string; receivedAt?: number; completedAt?: number; failedAt?: number; lastError?: string }[];
  audit: { id: string; action: string; createdAt?: number; actorEmail?: string; webhookUrl?: string }[];
  configured: { token: boolean; secret: boolean };
  errors: { bot?: string; webhook?: string };
};

const LOGO = 'https://commons.wikimedia.org/wiki/Special:FilePath/Telegram_logo.svg';

export default function TelegramAdminPage() {
  const { user, loading: isUserLoading } = useUser();
  const { isSuperAdmin, loading: profileLoading } = useProfile();
  const [data, setData] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [accessUsers, setAccessUsers] = useState<TelegramAccessUser[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);
  const [draft, setDraft] = useState({ telegramUserId: '', name: '', role: 'STAFF' as 'OWNER' | 'MANAGER' | 'STAFF', branchIds: '' });

  const authHeaders = useCallback(async () => {
    if (!user) throw new Error('Sign in again to continue.');
    return { Authorization: `Bearer ${await user.getIdToken()}` };
  }, [user]);

  const loadStatus = useCallback(async (quiet = false) => {
    if (!user) return;
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const response = await fetch('/api/admin/telegram/status', {
        headers: await authHeaders(),
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load Telegram status.');
      setData(result);
      const accessResponse = await fetch('/api/admin/telegram/access', { headers: await authHeaders(), cache: 'no-store' });
      const accessResult = await accessResponse.json();
      if (!accessResponse.ok) throw new Error(accessResult.error || 'Unable to load Telegram user access.');
      setAccessUsers(accessResult.users || []);
    } catch (error) {
      toast({ title: 'Telegram status unavailable', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authHeaders, user]);

  useEffect(() => {
    if (!isUserLoading && user && isSuperAdmin) void loadStatus();
  }, [isUserLoading, user, isSuperAdmin, loadStatus]);

  const saveAccess = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingAccess(true);
    try {
      const response = await fetch('/api/admin/telegram/access', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramUserId: draft.telegramUserId.trim(),
          name: draft.name.trim(),
          role: draft.role,
          branchIds: draft.branchIds.split(',').map(value => value.trim()).filter(Boolean),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save access.');
      toast({ title: 'Telegram access saved', description: `${draft.name || draft.telegramUserId} can now use the bot as ${draft.role.toLowerCase()}.` });
      setDraft({ telegramUserId: '', name: '', role: 'STAFF', branchIds: '' });
      await loadStatus(true);
    } catch (error) {
      toast({ title: 'Unable to save access', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally { setSavingAccess(false); }
  };

  const editAccess = (entry: TelegramAccessUser) => {
    setDraft({ telegramUserId: entry.telegramUserId, name: entry.name || '', role: entry.role, branchIds: (entry.branchIds || []).join(', ') });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const revokeAccess = async (telegramUserId: string) => {
    if (!window.confirm(`Revoke Telegram access for user ${telegramUserId}?`)) return;
    try {
      const response = await fetch(`/api/admin/telegram/access?telegramUserId=${encodeURIComponent(telegramUserId)}`, {
        method: 'DELETE',
        headers: await authHeaders(),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to revoke access.');
      toast({ title: 'Telegram access revoked' });
      await loadStatus(true);
    } catch (error) {
      toast({ title: 'Unable to revoke access', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    }
  };

  const registerWebhook = async () => {
    setRegistering(true);
    try {
      const response = await fetch('/api/admin/telegram/register-webhook', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: '{}',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Webhook registration failed.');
      toast({ title: 'Webhook verified', description: result.message || 'Telegram webhook registered successfully.' });
      await loadStatus(true);
    } catch (error) {
      toast({ title: 'Webhook registration failed', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setRegistering(false);
    }
  };

  const dateLabel = (value?: number) => value ? new Date(value).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const webhookHealthy = Boolean(data?.webhook?.url && !data.webhook.lastErrorMessage);
  const botReady = Boolean(data?.bot);

  if (isUserLoading || profileLoading || (Boolean(user) && loading)) return (
    <div className="mx-auto flex min-h-[55vh] max-w-6xl items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      <span className="ml-3 text-sm text-zinc-500">Loading Telegram controls…</span>
    </div>
  );
  if (!user) return <div className="p-8 text-sm text-zinc-500">Sign in with an administrator account to continue.</div>;
  if (!isSuperAdmin) return <div className="p-8 text-sm text-zinc-500">Owner access is required to manage Telegram.</div>;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 px-2 pb-28 sm:space-y-8 sm:px-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">System integrations / Messaging</p>
          <PageHeader title="Telegram Management" breadcrumb={['Admin', 'Telegram']} className="mb-0" />
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">Manage the Urban Address operations bot, webhook health, access coverage and delivery activity.</p>
        </div>
        <Button variant="outline" onClick={() => loadStatus(true)} disabled={refreshing} className="h-10 gap-2 rounded-lg">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh status
        </Button>
      </div>

      <Card className="overflow-hidden rounded-xl border-zinc-200 shadow-sm">
        <CardContent className="p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#229ED9]/10 p-2">
                <img src={LOGO} alt="Telegram official logo" className="h-12 w-12 object-contain" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Urban Address Telegram Bot</h2>
                  <Badge className={botReady ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                    {botReady ? 'Bot connected' : 'Not connected'}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-zinc-500">{data?.bot?.username ? `@${data.bot.username}` : 'Bot identity unavailable'} {data?.bot?.firstName ? `· ${data.bot.firstName}` : ''}</p>
                <p className="mt-1 text-xs text-zinc-400">Credentials remain server-side in Vercel environment variables.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={registerWebhook} disabled={registering || !data?.configured.token || !data?.configured.secret} className="h-10 gap-2 rounded-lg bg-zinc-900 px-4 text-white hover:bg-zinc-800">
                {registering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Webhook className="h-4 w-4" />}
                Register webhook
              </Button>
              <Button variant="outline" asChild className="h-10 gap-2 rounded-lg">
                <a href={data?.bot?.username ? `https://t.me/${data.bot.username}` : 'https://t.me/BotFather'} target="_blank" rel="noreferrer">
                  Open bot <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard title="Bot identity" value={botReady ? 'Verified' : 'Unavailable'} detail={data?.configured.token ? 'Token detected on server' : 'Bot token missing'} icon={Bot} good={botReady} />
        <StatusCard title="Webhook" value={webhookHealthy ? 'Healthy' : data?.webhook?.url ? 'Needs attention' : 'Not registered'} detail={data?.webhook?.url ? 'Telegram has a webhook URL' : 'No webhook is registered'} icon={Webhook} good={webhookHealthy} />
        <StatusCard title="Pending updates" value={String(data?.webhook?.pendingUpdateCount ?? '—')} detail="Updates waiting for delivery" icon={Clock3} good={Boolean(data?.webhook && data.webhook.pendingUpdateCount === 0)} />
        <StatusCard title="Authorized accounts" value={String(data?.access.total ?? 0)} detail={`${data?.access.owners ?? 0} owners · ${data?.access.managers ?? 0} managers · ${data?.access.staff ?? 0} staff`} icon={Users} good={Boolean(data?.access.total)} />
      </div>

      {(data?.errors?.bot || data?.errors?.webhook || data?.webhook?.lastErrorMessage) && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-semibold">Telegram requires attention</p><p className="mt-1">{data.errors?.bot || data.errors?.webhook || data.webhook?.lastErrorMessage}</p></div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-xl border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Command className="h-4 w-4 text-zinc-500" /> Bot commands</CardTitle>
            <CardDescription>Commands currently implemented in the production bot.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-zinc-100">
              {(data?.commands || []).map(command => (
                <div key={command.command} className="flex flex-col justify-between gap-1 py-3 sm:flex-row sm:items-center">
                  <div><code className="text-sm font-semibold text-zinc-900">/{command.command}</code><p className="mt-1 text-sm text-zinc-500">{command.description}</p></div>
                  <Badge variant="outline" className="w-fit text-[10px] font-medium">{command.roles}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-zinc-500" /> Access configuration</CardTitle>
            <CardDescription>Role counts read from the server-side TELEGRAM_USER_ACCESS configuration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              ['Owner', data?.access.owners ?? 0, 'Full administrative access'],
              ['Manager', data?.access.managers ?? 0, 'Reports, approvals and remote operations'],
              ['Staff', data?.access.staff ?? 0, 'Submit refund/stock requests and receive operational notifications'],
            ].map(([role, count, description]) => (
              <div key={String(role)} className="flex items-center justify-between gap-3">
                <div><p className="text-sm font-medium text-zinc-800">{role}</p><p className="text-xs text-zinc-500">{description}</p></div>
                <span className="min-w-8 rounded-md bg-zinc-100 px-2 py-1 text-center text-sm font-semibold tabular-nums">{count}</span>
              </div>
            ))}
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">
              Telegram user IDs and role assignments are managed through the protected Vercel environment configuration. Bot tokens and webhook secrets are never sent to this page.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-zinc-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-zinc-500" /> Telegram user access</CardTitle>
          <CardDescription>Add Telegram accounts, assign permissions and limit managers or staff to selected branches. Users must message the bot at least once to obtain their numeric Telegram ID.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={saveAccess} className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-medium text-zinc-600">Telegram user ID
              <input required inputMode="numeric" pattern="[0-9]{1,20}" value={draft.telegramUserId} onChange={event => setDraft(current => ({...current, telegramUserId: event.target.value}))} placeholder="e.g. 123456789" className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500" />
            </label>
            <label className="space-y-1.5 text-xs font-medium text-zinc-600">Display name
              <input value={draft.name} onChange={event => setDraft(current => ({...current, name: event.target.value}))} placeholder="Staff member name" maxLength={100} className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500" />
            </label>
            <label className="space-y-1.5 text-xs font-medium text-zinc-600">Role
              <select value={draft.role} onChange={event => setDraft(current => ({...current, role: event.target.value as 'OWNER' | 'MANAGER' | 'STAFF'}))} className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500">
                <option value="STAFF">Staff</option><option value="MANAGER">Manager</option><option value="OWNER">Owner</option>
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-medium text-zinc-600">Branch IDs (comma-separated)
              <input value={draft.branchIds} onChange={event => setDraft(current => ({...current, branchIds: event.target.value}))} placeholder="Leave blank for all branches" className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500" />
            </label>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Button type="submit" disabled={savingAccess} className="h-10 gap-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800">
                {savingAccess ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {savingAccess ? 'Saving…' : 'Save access'}
              </Button>
              {draft.telegramUserId && <Button type="button" variant="outline" onClick={() => setDraft({telegramUserId:'',name:'',role:'STAFF',branchIds:''})} className="h-10 rounded-lg">Clear form</Button>}
              <p className="text-xs text-zinc-500">Database assignments override legacy Vercel entries. Revoking a legacy entry creates a database deny rule.</p>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead><tr className="border-b border-zinc-200 text-[10px] uppercase tracking-wider text-zinc-400"><th className="py-3 pr-3 font-semibold">Telegram account</th><th className="py-3 pr-3 font-semibold">Role</th><th className="py-3 pr-3 font-semibold">Branches</th><th className="py-3 pr-3 font-semibold">Source</th><th className="py-3 text-right font-semibold">Actions</th></tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {accessUsers.map(entry => <tr key={entry.telegramUserId}>
                  <td className="py-3 pr-3"><p className="font-medium text-zinc-800">{entry.name || 'Unnamed account'}</p><p className="mt-0.5 text-xs text-zinc-500">{entry.telegramUserId}</p></td>
                  <td className="py-3 pr-3"><Badge variant="outline">{entry.role}</Badge></td>
                  <td className="py-3 pr-3 text-xs text-zinc-500">{entry.branchIds?.length ? entry.branchIds.join(', ') : 'All branches'}</td>
                  <td className="py-3 pr-3 text-xs text-zinc-500">{entry.source === 'DATABASE' ? 'Managed here' : 'Legacy environment'}</td>
                  <td className="py-3 text-right"><div className="flex justify-end gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => editAccess(entry)} aria-label="Edit Telegram user"><Pencil className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => revokeAccess(entry.telegramUserId)} aria-label="Revoke Telegram access" className="text-red-600 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                  </div></td>
                </tr>)}
                {!accessUsers.length && <tr><td colSpan={5} className="py-8 text-center text-sm text-zinc-400">No Telegram users configured yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {(data?.mpesa || data?.maps) && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-xl border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Smartphone className="h-4 w-4 text-zinc-500" /> M-Pesa Daraja</CardTitle>
              <CardDescription>POS and customer checkout STK Push configuration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-zinc-600">Configuration</span>
                <Badge className={data.mpesa?.configured ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}>{data.mpesa?.configured ? 'Configured' : 'Credentials required'}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3"><span className="text-sm text-zinc-600">Environment</span><span className="text-sm font-medium text-zinc-900">{data.mpesa?.environment || 'Unknown'}</span></div>
              {data.mpesa?.missing?.length ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-semibold text-amber-900">Add these Vercel environment variables:</p><ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-900">{data.mpesa.missing.map(key => <li key={key}><code>{key}</code></li>)}</ul></div> : <p className="text-xs text-emerald-700">Required credentials and callback URL are present. Complete a Safaricom sandbox test before enabling production.</p>}
            </CardContent>
          </Card>
          <Card className="rounded-xl border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-zinc-500" /> Maps and geolocation</CardTitle>
              <CardDescription>Branch, delivery and pickup location services.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3"><span className="text-sm text-zinc-600">Provider</span><Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Enabled</Badge></div>
              <p className="text-sm font-medium text-zinc-900">{data.maps?.provider || 'OpenStreetMap + Nominatim'}</p>
              <p className="text-xs leading-5 text-zinc-500">Geocoding is cached server-side. No maps API key is required. Device GPS still requires the user's permission.</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="rounded-xl border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-zinc-500" /> Webhook activity</CardTitle>
            <CardDescription>Recent Telegram update processing records.</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.activity.length ? <div className="space-y-3">{data.activity.map(item => (
              <div key={item.id} className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3 last:border-0">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-800">Update {item.id}</p><p className="mt-1 text-xs text-zinc-500">{dateLabel(item.receivedAt)}</p>{item.lastError && <p className="mt-1 break-words text-xs text-red-600">{item.lastError}</p>}</div>
                <Badge variant="outline" className={item.status === 'COMPLETED' ? 'border-emerald-200 text-emerald-700' : item.status === 'FAILED' ? 'border-red-200 text-red-700' : 'text-amber-700'}>{item.status}</Badge>
              </div>
            ))}</div> : <EmptyState text="No webhook updates have been recorded yet." />}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-zinc-500" /> Administration audit</CardTitle>
            <CardDescription>Recent webhook registration and integration changes.</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.audit.length ? <div className="space-y-3">{data.audit.map(item => (
              <div key={item.id} className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3 last:border-0">
                <div className="min-w-0"><p className="text-sm font-medium text-zinc-800">{item.action.replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-zinc-500">{item.actorEmail || 'System'} · {dateLabel(item.createdAt)}</p></div>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              </div>
            ))}</div> : <EmptyState text="No Telegram administration events recorded yet." />}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-zinc-200 shadow-sm">
        <CardHeader><CardTitle className="text-base">Webhook details</CardTitle><CardDescription>Live values returned by Telegram getWebhookInfo.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Detail label="Webhook URL" value={data?.webhook?.url || 'Not registered'} />
          <Detail label="Pending updates" value={String(data?.webhook?.pendingUpdateCount ?? '—')} />
          <Detail label="Last Telegram error" value={data?.webhook?.lastErrorMessage || 'None reported'} />
          <Detail label="Last error time" value={dateLabel(data?.webhook?.lastErrorDate ? data.webhook.lastErrorDate * 1000 : undefined)} />
        </CardContent>
      </Card>
      <p className="text-center text-[11px] text-zinc-400">Telegram bot management · Owner-only controls · Secrets remain on the server</p>
    </div>
  );
}

function StatusCard({ title, value, detail, icon: Icon, good }: { title: string; value: string; detail: string; icon: React.ElementType; good: boolean }) {
  return <Card className="rounded-xl border-zinc-200 shadow-sm"><CardContent className="p-4"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-zinc-500">{title}</p><p className="mt-2 text-xl font-semibold tracking-tight text-zinc-900">{value}</p><p className="mt-1 text-xs text-zinc-500">{detail}</p></div><span className="rounded-lg bg-zinc-100 p-2"><Icon className="h-4 w-4 text-zinc-600" /></span></div><div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">{good ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertCircle className="h-3.5 w-3.5 text-amber-600" />}<span className={good ? 'text-emerald-700' : 'text-amber-700'}>{good ? 'Operational' : 'Review status'}</span></div></CardContent></Card>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg border border-zinc-200 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p><p className="mt-1 break-all text-sm text-zinc-800">{value}</p></div>;
}
function EmptyState({ text }: { text: string }) {
  return <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-zinc-200 px-4 text-center text-sm text-zinc-400">{text}</div>;
}
