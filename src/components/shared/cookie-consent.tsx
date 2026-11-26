'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Cookie, ShieldCheck, Settings2, X, Check } from 'lucide-react';

type ConsentCategories = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
};

type StoredConsent = {
  version: number;
  consentId: string;
  categories: ConsentCategories;
  action: 'accepted_all' | 'rejected_optional' | 'customized';
  savedAt: string;
};

const STORAGE_KEY = 'uax_cookie_consent_v2';
const CONSENT_VERSION = 1;

function getConsentId() {
  const existing = localStorage.getItem('uax_cookie_consent_id');
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem('uax_cookie_consent_id', id);
  return id;
}

function readStoredConsent(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (parsed.version !== CONSENT_VERSION || !parsed.consentId || !parsed.categories) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function CookieConsent() {
  const pathname = usePathname();
  const isPosRoute = pathname === '/lounge' || pathname === '/store' || pathname === '/carwash/pos' || pathname === '/kds';
  const [isOpen, setIsOpen] = useState(false);
  const [hasChoice, setHasChoice] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (isPosRoute) { setIsOpen(false); return; }
    const saved = readStoredConsent();
    if (saved) {
      setHasChoice(true);
      setAnalytics(saved.categories.analytics);
      setMarketing(saved.categories.marketing);
      return;
    }
    const timer = window.setTimeout(() => setIsOpen(true), 900);
    return () => window.clearTimeout(timer);
  }, [isPosRoute, pathname]);

  const saveConsent = useCallback(async (action: StoredConsent['action'], categories: ConsentCategories) => {
    if (saving) return;
    setSaving(true);
    setSaveError('');

    const consent: StoredConsent = {
      version: CONSENT_VERSION,
      consentId: getConsentId(),
      categories,
      action,
      savedAt: new Date().toISOString(),
    };

    try {
      const response = await fetch('/api/privacy/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(consent),
        credentials: 'same-origin',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'We could not sync your preference. Please try again.');
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
      setHasChoice(true);
      setAnalytics(categories.analytics);
      setMarketing(categories.marketing);
      setIsOpen(false);
      setShowPreferences(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save your cookie preferences.');
    } finally {
      setSaving(false);
    }
  }, [saving]);

  const acceptAll = () => saveConsent('accepted_all', { essential: true, analytics: true, marketing: true });
  const rejectOptional = () => saveConsent('rejected_optional', { essential: true, analytics: false, marketing: false });
  const saveCustom = () => saveConsent('customized', { essential: true, analytics, marketing });

  if (isPosRoute) return null;

  if (!isOpen && hasChoice) {
    return (
      <button
        type="button"
        onClick={() => { setSaveError(''); setIsOpen(true); }}
        className="fixed bottom-[calc(9.5rem_+_env(safe-area-inset-bottom))] right-3 z-[5000] inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-200 bg-white p-0 text-zinc-700 shadow-lg transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:bottom-4 md:right-4"
        aria-label="Open cookie settings"
        title="Cookie settings"
      >
        <Cookie className="h-5 w-5" />
      </button>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.25rem_+_env(safe-area-inset-bottom))] z-[5000] flex justify-center p-2 md:bottom-0 md:p-5" role="dialog" aria-modal="true" aria-labelledby="cookie-consent-title">
      <section className="relative max-h-[calc(100dvh_-_5.5rem_-_env(safe-area-inset-bottom))] w-full max-w-[1080px] overflow-y-auto rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-[0_18px_70px_rgba(0,0,0,0.22)] md:max-h-[calc(100dvh-2.5rem)] md:rounded-xl">
        <div className="grid grid-cols-1 gap-3 p-3 sm:gap-5 sm:p-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-8 lg:p-7">
          <div className="flex min-w-0 flex-col gap-2.5 sm:gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-orange-100 bg-orange-50 text-primary sm:h-10 sm:w-10 sm:rounded-lg">
                  <Cookie className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-400 sm:text-[10px] sm:tracking-[0.18em]">Urban Address · Privacy centre</p>
                  <h2 id="cookie-consent-title" className="text-base font-bold tracking-tight sm:text-xl">Your privacy matters</h2>
                </div>
              </div>
              {hasChoice && (
                <button type="button" onClick={() => setIsOpen(false)} aria-label="Close cookie settings" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="max-w-xl text-xs leading-[1.45rem] text-zinc-600 sm:text-sm sm:leading-6">
              We use essential cookies to keep the platform secure and working. With your permission, optional analytics and marketing cookies help us understand usage and measure campaigns. Choose which optional categories you allow.
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 sm:gap-x-4 sm:gap-y-2 sm:text-xs">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Preferences can be changed at any time</span>
              <Link href="/privacy" className="font-semibold text-primary underline-offset-4 hover:underline">Privacy policy</Link>
            </div>
          </div>

          <div className="rounded-md border border-zinc-200 bg-zinc-50/70 p-3 sm:rounded-lg sm:p-5">
            <div className="mb-1.5 flex items-center justify-between gap-3 sm:mb-3">
              <h3 className="text-xs font-bold sm:text-sm">Cookie categories</h3>
              <button type="button" onClick={() => setShowPreferences(value => !value)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-primary hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <Settings2 className="h-4 w-4" /> {showPreferences ? 'Hide controls' : 'Manage choices'}
              </button>
            </div>

            <div className="divide-y divide-zinc-200">
              <div className="flex items-center justify-between gap-3 py-2 first:pt-1 sm:py-3">
                <div>
                  <p className="text-xs font-semibold sm:text-sm">Essential</p>
                  <p className="mt-0.5 text-[10px] text-zinc-500 sm:text-xs">Security, sessions and core functions</p>
                </div>
                <span className="shrink-0 rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">Always on</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2 sm:py-3">
                <div>
                  <p className="text-sm font-semibold">Analytics</p>
                  <p className="mt-0.5 text-xs text-zinc-500">Usage and platform performance</p>
                </div>
                {showPreferences ? (
                  <button type="button" role="switch" aria-checked={analytics} aria-label="Allow analytics cookies" onClick={() => setAnalytics(value => !value)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${analytics ? 'bg-primary' : 'bg-zinc-300'}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${analytics ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                ) : <span className="text-xs font-medium text-zinc-500">{analytics ? 'Allowed' : 'Optional'}</span>}
              </div>
              <div className="flex items-center justify-between gap-3 py-2 last:pb-1 sm:py-3">
                <div>
                  <p className="text-sm font-semibold">Marketing</p>
                  <p className="mt-0.5 text-xs text-zinc-500">Campaign and advertising measurement</p>
                </div>
                {showPreferences ? (
                  <button type="button" role="switch" aria-checked={marketing} aria-label="Allow marketing cookies" onClick={() => setMarketing(value => !value)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${marketing ? 'bg-primary' : 'bg-zinc-300'}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${marketing ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                ) : <span className="text-xs font-medium text-zinc-500">{marketing ? 'Allowed' : 'Optional'}</span>}
              </div>
            </div>
          </div>
        </div>

        {saveError && <p role="alert" className="mx-5 mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:mx-7">{saveError}</p>}

        <div className="flex flex-col gap-2 border-t border-zinc-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4 lg:px-7">
          <p className="text-[10px] leading-4 text-zinc-500 sm:text-[11px] sm:leading-5">Your selection is saved for this browser.</p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <button type="button" disabled={saving} onClick={rejectOptional} className="min-h-10 rounded-md border border-zinc-300 bg-white px-2 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60 sm:min-h-11 sm:rounded-lg sm:px-4 sm:text-xs">Reject optional</button>
            {showPreferences && <button type="button" disabled={saving} onClick={saveCustom} className="col-span-2 min-h-10 rounded-md border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60 sm:col-span-1 sm:min-h-11 sm:rounded-lg sm:px-4">Save preferences</button>}
            <button type="button" disabled={saving} onClick={acceptAll} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md bg-primary px-2 text-[11px] font-semibold text-white transition hover:brightness-95 disabled:opacity-60 sm:min-h-11 sm:gap-2 sm:rounded-lg sm:px-5 sm:text-xs">
              {saving ? 'Saving…' : <><Check className="h-4 w-4" /> Accept all</>}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
