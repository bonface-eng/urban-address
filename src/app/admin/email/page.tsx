'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { listImagesFromR2, uploadImageToR2 } from '@/lib/actions';
import { buildEmailConfirmationMessage } from '@/lib/email/confirmation';
import { useUser } from '@/lib/data';
import { useProfile } from '@/hooks/use-profile';
import { EmailActivity } from '@/components/admin/email-activity';
import { PageHeader } from '@/components/shared/page-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Mail, Send, ShieldCheck, FileText, Megaphone, ShoppingCart, AlertTriangle, RefreshCw } from 'lucide-react';

type Kind = 'DISMISSAL' | 'PURCHASE_ORDER' | 'WARNING_LETTER' | 'OFFICIAL_COMMUNICATION' | 'MARKETING' | 'GENERAL';
type Audience = 'CUSTOM' | 'ALL_STAFF' | 'ALL_CLIENTS' | 'MARKETING_CONSENTED';

const TEMPLATES: Array<{ value: Kind; label: string; subject: string; heading: string; message: string; note: string }> = [
  { value: 'OFFICIAL_COMMUNICATION', label: 'Official communication', subject: 'Official communication from Urban Auto Express', heading: 'Important business communication', message: 'We are writing to formally communicate the following information.\n\n[Enter the communication details here.]\n\nPlease contact management if you require clarification.', note: 'For company-wide notices, policy updates and formal business correspondence.' },
  { value: 'WARNING_LETTER', label: 'Staff warning letter', subject: 'Private & Confidential — Formal Warning', heading: 'Formal warning notice', message: 'This letter serves as a formal notice concerning the following matter:\n\n[Describe the incident, date and relevant policy or procedure.]\n\nExpected corrective action:\n[Specify the action and any applicable review period.]\n\nPlease contact management or Human Resources to discuss this notice.', note: 'Send to one named staff member only. Review the facts and applicable HR process before sending.' },
  { value: 'DISMISSAL', label: 'Employment separation letter', subject: 'Private & Confidential — Employment Notice', heading: 'Employment notice', message: 'This letter concerns your employment with Urban Auto Express.\n\n[Insert the approved decision, effective date, reasons and any applicable final-pay or handover information.]\n\nPlease contact management for the next steps and any required documentation.', note: 'Send to one named staff member only. Use an approved HR/legal document and verify due process before sending.' },
  { value: 'PURCHASE_ORDER', label: 'Purchase order', subject: 'Purchase Order — Urban Auto Express', heading: 'Purchase order', message: 'Please find our purchase order details below.\n\nSupplier: [Supplier name]\nDelivery location: [Branch / address]\nRequired delivery date: [Date]\n\nItems and quantities:\n[Item | Quantity | Unit price | Total]\n\nPlease confirm acceptance and expected delivery. Do not treat this email alone as approval to change bank or payment details.', note: 'Send to one supplier contact. Include item quantities, agreed prices, delivery terms and an internal PO reference.' },
  { value: 'MARKETING', label: 'Marketing broadcast', subject: 'News and offers from Urban Auto Express', heading: 'A little something for your next visit', message: 'We have updates and offers to share with you.\n\n[Add campaign details, offer validity, exclusions and booking instructions.]', note: 'Only customers with recorded marketing consent are eligible. Unsubscribe is included automatically.' },
  { value: 'GENERAL', label: 'General customer email', subject: 'A message from Urban Auto Express', heading: 'A message from our team', message: 'Thank you for choosing Urban Auto Express.\n\n[Enter your message here.]', note: 'Use for individual customer correspondence and service follow-ups.' },
];

export default function AdminEmailPage() {
  const { user } = useUser();
  const { isSuperAdmin, loading: profileLoading } = useProfile();
  const [kind, setKind] = useState<Kind>('OFFICIAL_COMMUNICATION');
  const [audience, setAudience] = useState<Audience>('ALL_STAFF');
  const [recipientsText, setRecipientsText] = useState('');
  const [subject, setSubject] = useState(TEMPLATES[0].subject);
  const [heading, setHeading] = useState(TEMPLATES[0].heading);
  const [message, setMessage] = useState(TEMPLATES[0].message);
  const [reference, setReference] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [actionLabel, setActionLabel] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [assetImages, setAssetImages] = useState<Array<{ url: string; key: string; category: string }>>([]);
  const [selectedLogoUrl, setSelectedLogoUrl] = useState('');
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [result, setResult] = useState<{ sentCount: number; failedCount: number; recipientCount: number; status: string } | null>(null);

  const template = useMemo(() => TEMPLATES.find(item => item.value === kind) || TEMPLATES[0], [kind]);

  useEffect(() => {
    let active = true;
    listImagesFromR2('All').then(result => {
      if (active && result.success) setAssetImages(result.images || []);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const uploadEmailAsset = async (file?: File) => {
    if (!file) return;
    setUploadingAsset(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'system');
      const uploaded = await uploadImageToR2(formData);
      if (!uploaded.success || !uploaded.url) throw new Error(uploaded.message || 'Image upload failed.');
      const item = { url: uploaded.url, key: uploaded.key || '', category: 'System Images' };
      setAssetImages(current => [item, ...current]);
      setSelectedImageUrl(uploaded.url);
      toast({ title: 'Image uploaded', description: 'The image is now available from Cloudflare for email reuse.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Image upload failed', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setUploadingAsset(false);
    }
  };
  const requiresSingle = kind === 'DISMISSAL' || kind === 'WARNING_LETTER' || kind === 'PURCHASE_ORDER';
  const audienceOptions: Array<{ value: Audience; label: string }> = kind === 'MARKETING'
    ? [{ value: 'MARKETING_CONSENTED', label: 'Customers with recorded marketing consent' }]
    : requiresSingle
      ? [{ value: 'CUSTOM', label: kind === 'PURCHASE_ORDER' ? 'One supplier / recipient' : 'One staff member' }]
      : [
          { value: 'CUSTOM', label: 'Specific email address(es)' },
          { value: 'ALL_STAFF', label: 'All staff' },
        ];

  const changeKind = (next: Kind) => {
    const nextTemplate = TEMPLATES.find(item => item.value === next)!;
    setKind(next);
    setSubject(nextTemplate.subject);
    setHeading(nextTemplate.heading);
    setMessage(nextTemplate.message);
    setAudience(next === 'MARKETING' ? 'MARKETING_CONSENTED' : ['DISMISSAL', 'WARNING_LETTER', 'PURCHASE_ORDER'].includes(next) ? 'CUSTOM' : 'ALL_STAFF');
    setResult(null);
  };

  const send = async (confirmed = false) => {
    if (!user || !subject.trim() || !heading.trim() || !message.trim()) {
      toast({ variant: 'destructive', title: 'Complete the email details', description: 'Subject, heading and message are required.' });
      return;
    }
    const rawRecipients = recipientsText.split(/[\s,;]+/).map(value => value.trim()).filter(Boolean);
    const recipients = [...new Set(rawRecipients.map(value => value.toLowerCase()).filter(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))];
    if (audience === 'CUSTOM' && (!recipients.length || recipients.length > 20 || recipients.length !== rawRecipients.length)) {
      toast({ variant: 'destructive', title: 'Check recipient addresses', description: 'Enter 1–20 valid email addresses. Duplicate addresses are counted once.' });
      return;
    }
    const uniqueRecipients = recipients;
    if (!confirmed) {
      setConfirmationText(audience === 'CUSTOM'
        ? buildEmailConfirmationMessage(subject, uniqueRecipients.length)
        : `Send “${subject}” to ${audience === 'ALL_STAFF' ? 'all staff' : 'customers with recorded marketing consent'}? This action cannot be recalled.`);
      setConfirmOpen(true);
      return;
    }

    setSending(true);
    setResult(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          kind, audience, recipients, subject, heading, message,
          reference: reference.trim(), actionUrl: actionUrl.trim(), actionLabel: actionLabel.trim(),
          logoUrl: selectedLogoUrl, imageUrl: selectedImageUrl,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'The email could not be sent.');
      setResult(data);
      toast({ title: data.status === 'SENT' ? 'Email sent' : 'Email campaign completed', description: `${data.sentCount} sent · ${data.failedCount} failed.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Email sending failed', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setSending(false);
    }
  };

  if (profileLoading) return <div className="p-8 text-sm text-zinc-500">Verifying administrator access…</div>;
  if (!isSuperAdmin) return <div className="p-8 text-sm text-zinc-600">You do not have access to the email communications centre.</div>;

  return (
    <div className="relative isolate mx-auto min-h-screen w-full max-w-[1200px] space-y-5 rounded-2xl px-3 pb-20 pt-4 sm:px-5 ua-compact-page" style={{ backgroundImage: "radial-gradient(circle at 8% 4%, rgba(255,106,0,0.10), transparent 28%), radial-gradient(circle at 94% 32%, rgba(39,39,42,0.05), transparent 26%), linear-gradient(135deg, #faf9f6 0%, #f3f1ed 52%, #fbfaf8 100%)" }}>
      <PageHeader title="Email Communications" breadcrumb={['Admin', 'Communications']} description="Prepare branded business correspondence and customer campaigns." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4"><Mail className="h-5 w-5 text-primary" /><div><p className="text-sm font-semibold">Resend connected</p><p className="text-xs text-zinc-500">Server-side delivery</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><ShieldCheck className="h-5 w-5 text-primary" /><div><p className="text-sm font-semibold">Admin restricted</p><p className="text-xs text-zinc-500">Server verifies admin role</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Megaphone className="h-5 w-5 text-primary" /><div><p className="text-sm font-semibold">Consent-aware</p><p className="text-xs text-zinc-500">Marketing opt-in required</p></div></CardContent></Card>
      </div>

      <EmailActivity />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm email delivery</AlertDialogTitle>
            <AlertDialogDescription>{confirmationText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={sending} onClick={(event) => { event.preventDefault(); setConfirmOpen(false); void send(true); }} className="bg-[#FF6A00] text-white hover:bg-[#E85F00]">{sending ? 'Sending…' : 'Confirm and send'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <Card className="min-w-0">
          <CardHeader className="pb-3"><CardTitle className="text-base">Compose an email</CardTitle><CardDescription>Choose a document type, then edit its content before sending.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label htmlFor="email-kind">Template</Label><select id="email-kind" value={kind} onChange={event => changeKind(event.target.value as Kind)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{TEMPLATES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><p className="text-xs text-zinc-500">{template.note}</p></div>
            <div className="space-y-2"><Label htmlFor="email-audience">Recipients</Label><select id="email-audience" value={audience} onChange={event => setAudience(event.target.value as Audience)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{audienceOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
            {audience === 'CUSTOM' && <div className="space-y-2"><Label htmlFor="email-recipients">Recipient email address(es)</Label><Textarea id="email-recipients" value={recipientsText} onChange={event => setRecipientsText(event.target.value)} placeholder="supplier@example.com" rows={2} /><p className="text-xs text-zinc-500">Separate multiple addresses with commas or new lines. Maximum 20 recipients.</p></div>}
            <div className="space-y-2"><Label htmlFor="email-subject">Email subject</Label><Input id="email-subject" value={subject} onChange={event => setSubject(event.target.value)} maxLength={180} /></div>
            <div className="space-y-2"><Label htmlFor="email-heading">Heading</Label><Input id="email-heading" value={heading} onChange={event => setHeading(event.target.value)} maxLength={180} /></div>
            <div className="space-y-2"><Label htmlFor="email-logo">Email logo (Cloudflare image library)</Label><select id="email-logo" value={selectedLogoUrl} onChange={event => setSelectedLogoUrl(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Use default company logo</option>{assetImages.map(item => <option key={item.key || item.url} value={item.url}>{item.key || item.url}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="email-image">Email image (optional)</Label><select id="email-image" value={selectedImageUrl} onChange={event => setSelectedImageUrl(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">No additional image</option>{assetImages.map(item => <option key={item.key || item.url} value={item.url}>{item.key || item.url}</option>)}</select><Input aria-label="Upload email image to Cloudflare" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" disabled={uploadingAsset} onChange={event => { void uploadEmailAsset(event.target.files?.[0]); event.currentTarget.value = ''; }} /><p className="text-xs text-zinc-500">Uploads to the existing Cloudflare R2 system folder. The resulting public URL is embedded in the email HTML and can be reused.</p></div>
            <div className="space-y-2"><Label htmlFor="email-reference">Reference number (optional)</Label><Input id="email-reference" value={reference} onChange={event => setReference(event.target.value)} placeholder="e.g. UAX-PO-2026-001" maxLength={120} /></div>
            <div className="space-y-2"><Label htmlFor="email-message">Message / document details</Label><Textarea id="email-message" value={message} onChange={event => setMessage(event.target.value)} rows={10} maxLength={12000} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="email-action-url">Action link (optional)</Label><Input id="email-action-url" value={actionUrl} onChange={event => setActionUrl(event.target.value)} placeholder="https://…" /></div>
              <div className="space-y-2"><Label htmlFor="email-action-label">Button label</Label><Input id="email-action-label" value={actionLabel} onChange={event => setActionLabel(event.target.value)} placeholder="View details" /></div>
            </div>
            {kind === 'MARKETING' && <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-xs leading-5 text-orange-900">Marketing sends only to customer profiles with explicit recorded marketing consent. Unsubscribed contacts are excluded and the email includes an unsubscribe link. Customer-wide promotional sends cannot use the general-email template.</div>}
            {(kind === 'DISMISSAL' || kind === 'WARNING_LETTER') && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><AlertTriangle className="mr-1 inline h-4 w-4" /> Confidential employment correspondence. Confirm the facts, approval and applicable HR/legal process before sending.</div>}
            <Button className="w-full bg-[#FF6A00] text-white hover:bg-[#E85F00]" onClick={() => void send(false)} disabled={sending}><Send className="mr-2 h-4 w-4" />{sending ? 'Sending…' : 'Review and send'}</Button>
            {result && <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm"><p className="font-semibold">Campaign {result.status.toLowerCase()}</p><p className="mt-1 text-xs text-zinc-600">{result.sentCount} sent · {result.failedCount} failed · {result.recipientCount} recipients</p></div>}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card><CardHeader className="pb-3"><CardTitle className="text-base">Email preview</CardTitle><CardDescription>Content preview; final email includes the company logo and branded footer.</CardDescription></CardHeader><CardContent><div className="overflow-hidden rounded-md border border-zinc-200 bg-white"><div className="h-1.5 bg-[#FF6A00]" /><div className="p-4"><img src={selectedLogoUrl || '/assets/logo.png'} alt="Urban Auto Express" className="mb-5 h-10 max-w-[170px] object-contain object-left" /><p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#FF6A00]">{template.label}</p><h2 className="mb-3 text-lg font-bold text-zinc-900">{heading || 'Email heading'}</h2><p className="mb-3 text-xs text-zinc-500">{subject}</p>{selectedImageUrl && <img src={selectedImageUrl} alt="Email attachment preview" className="my-4 max-h-56 w-full rounded-md object-contain" />}<p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-700">{message}</p><div className="mt-6 border-t border-zinc-100 pt-4 text-center text-xs text-zinc-500"><p className="font-semibold text-zinc-900">Urban Auto Express</p><p>0785 860 753 · Nakuru, Kenya</p><p className="mt-2 text-[#FF6A00]">Terms of Service · Privacy Policy</p></div></div></div></CardContent></Card>
          <Card><CardHeader className="pb-3"><CardTitle className="text-base">Available document templates</CardTitle></CardHeader><CardContent className="space-y-3">{TEMPLATES.map(item => <div key={item.value} className="flex items-start gap-3"><div className="mt-0.5 rounded-md bg-orange-50 p-2 text-[#FF6A00]">{item.value === 'PURCHASE_ORDER' ? <ShoppingCart className="h-4 w-4" /> : item.value === 'MARKETING' ? <Megaphone className="h-4 w-4" /> : item.value.includes('WARNING') || item.value === 'DISMISSAL' ? <AlertTriangle className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</div><div className="min-w-0"><p className="text-sm font-medium text-zinc-900">{item.label}</p><p className="text-xs text-zinc-500">{item.note}</p></div></div>)}</CardContent></Card>
          <p className="text-xs leading-5 text-zinc-500">Sending is logged for audit. Message bodies are not copied into the campaign log. Each recipient receives a separate email rather than being exposed in a shared CC list.</p>
        </div>
      </div>
    </div>
  );
}
