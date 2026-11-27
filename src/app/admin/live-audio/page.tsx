'use client';

import { PageHeader } from '@/components/shared/page-layout';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { collection, addDoc, doc, onSnapshot, query, updateDoc, where, limit } from '@/lib/db';
import { ArrowLeft, Headphones, Mic, MicOff, Radio, ShieldAlert, Volume2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDb, useUser } from '@/lib/data';
import { useProfile } from '@/hooks/use-profile';
import { POSTerminal } from '@/lib/types';

type Session = {
  id: string;
  terminalId: string;
  terminalName?: string;
  cashierId: string;
  cashierName?: string;
  requestedBy: string;
  requestedByName?: string;
  status: 'REQUESTED' | 'ACCEPTED' | 'DECLINED' | 'ENDED';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  createdAt: number;
  acceptedAt?: number;
};

export default function AdminLiveAudioPage() {
  const firestore = useDb();
  const { user } = useUser();
  const { profile, role, isSuperAdmin, loading: profileLoading } = useProfile();
  const [terminals, setTerminals] = useState<POSTerminal[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [auditEntries, setAuditEntries] = useState<any[]>([]);
  const [busyTerminal, setBusyTerminal] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [audioConnected, setAudioConnected] = useState(false);
  const [audioError, setAudioError] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);

  const isAdmin = isSuperAdmin || role === 'ADMIN' || profile?.role === 'ADMIN';

  useEffect(() => {
    if (!firestore || !isAdmin) return;
    const unsubTerminals = onSnapshot(collection(firestore, 'pos_terminals'), snap => {
      setTerminals(snap.docs.map(d => ({ ...d.data(), id: d.id } as POSTerminal)));
    });
    const activeQuery = query(collection(firestore, 'live_audio_sessions'), where('status', 'in', ['REQUESTED', 'ACCEPTED']), limit(30));
    const unsubSessions = onSnapshot(activeQuery, snap => {
      setSessions(snap.docs.map(d => ({ ...d.data(), id: d.id } as Session)));
    });
    const auditQuery = query(collection(firestore, 'audit_logs'), where('action', 'in', ['LIVE_AUDIO_REQUESTED', 'LIVE_AUDIO_ACCEPTED', 'LIVE_AUDIO_DECLINED', 'LIVE_AUDIO_ENDED']), limit(20));
    const unsubAudit = onSnapshot(auditQuery, snap => {
      setAuditEntries(snap.docs.map(d => ({ ...d.data(), id: d.id } as any)).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    });
    return () => { unsubTerminals(); unsubSessions(); unsubAudit(); };
  }, [firestore, isAdmin]);

  useEffect(() => {
    if (!firestore || !activeSession || activeSession.status !== 'ACCEPTED' || !activeSession.offer) return;
    let cancelled = false;
    const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peerRef.current = peer;
    peer.ontrack = event => {
      if (audioRef.current) {
        audioRef.current.srcObject = event.streams[0];
        void audioRef.current.play().then(() => setAudioConnected(true)).catch(() => setAudioConnected(false));
      }
    };
    peer.onicecandidate = event => {
      if (event.candidate && firestore) {
        void addDoc(collection(firestore, 'live_audio_sessions', activeSession.id, 'admin_candidates'), event.candidate.toJSON());
      }
    };
    const connect = async () => {
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(activeSession.offer!));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        if (cancelled) return;
        await updateDoc(doc(firestore, 'live_audio_sessions', activeSession.id), {
          answer: { type: answer.type, sdp: answer.sdp },
          answerAt: Date.now()
        });
        const candidatesQuery = collection(firestore, 'live_audio_sessions', activeSession.id, 'staff_candidates');
        const unsubCandidates = onSnapshot(candidatesQuery, snap => {
          snap.docChanges().forEach(change => {
            if (change.type === 'added') {
              void peer.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(() => {});
            }
          });
        });
        (peer as any).__candidatesUnsub = unsubCandidates;
      } catch {
        setAudioError('Could not establish the audio connection. Check the network and try again.');
      }
    };
    void connect();
    peer.addEventListener('connectionstatechange', () => {
      if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
        setAudioConnected(false);
        setAudioError('Connection interrupted. End this session and request a new one.');
      }
    });
    return () => {
      cancelled = true;
      (peer as any).__candidatesUnsub?.();
      peer.close();
      if (peerRef.current === peer) peerRef.current = null;
      if (audioRef.current) audioRef.current.srcObject = null;
      setAudioConnected(false);
    };
  }, [firestore, activeSession?.id, activeSession?.status, activeSession?.offer]);

  useEffect(() => {
    if (!firestore || !activeSession?.id) return;
    return onSnapshot(doc(firestore, 'live_audio_sessions', activeSession.id), snap => {
      if (!snap.exists() || snap.data().status !== 'ACCEPTED') {
        setActiveSession(null);
        setAudioConnected(false);
      }
    });
  }, [firestore, activeSession?.id]);

  const requestSession = async (terminal: POSTerminal) => {
    if (!firestore || !user || !terminal.id || !terminal.currentCashierId || busyTerminal) return;
    setBusyTerminal(terminal.id);
    try {
      const created = await addDoc(collection(firestore, 'live_audio_sessions'), {
        terminalId: terminal.id,
        terminalName: terminal.name || 'POS Terminal',
        cashierId: terminal.currentCashierId,
        requestedBy: user.uid,
        requestedByName: profile?.displayName || user.displayName || 'Administrator',
        status: 'REQUESTED',
        createdAt: Date.now()
      });
      try { await addDoc(collection(firestore, 'audit_logs'), { action: 'LIVE_AUDIO_REQUESTED', userId: user.uid, details: 'Requested staff-consented live audio for terminal ' + terminal.id + ' (session ' + created.id + ')', timestamp: Date.now(), severity: 'WARNING' }); } catch {}
    } finally {
      setBusyTerminal(null);
    }
  };

  const endSession = async (session: Session) => {
    if (!firestore) return;
    await updateDoc(doc(firestore, 'live_audio_sessions', session.id), { status: 'ENDED', endedAt: Date.now(), endedBy: user?.uid || '' });
    try { await addDoc(collection(firestore, 'audit_logs'), { action: 'LIVE_AUDIO_ENDED', userId: user?.uid || '', details: 'Administrator ended live audio session ' + session.id + ' for terminal ' + session.terminalId, timestamp: Date.now(), severity: 'WARNING' }); } catch {}
    setActiveSession(null);
    setAudioConnected(false);
  };

  if (profileLoading) return <div className="p-8 text-sm text-zinc-500">Loading administrator access…</div>;
  if (!isAdmin) return <div className="max-w-xl mx-auto p-8 mt-12 border rounded-2xl bg-white"><ShieldAlert className="w-8 h-8 text-red-500 mb-3" /><h1 className="text-xl font-black">Administrator access required</h1><p className="text-sm text-zinc-500 mt-2">Only users with the ADMIN role can access live audio monitoring.</p><Link href="/admin" className="text-sm text-orange-600 inline-block mt-4">Return to Administration</Link></div>;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-7 pb-24">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin" className="h-10 w-10 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-50"><ArrowLeft className="w-4 h-4" /></Link>
        <div className="flex-1 min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-600">Admin-only · Staff support</p><PageHeader title="Live Audio Sessions" breadcrumb={["Admin", "Live Audio Sessions"]} className="mb-0" /><p className="text-sm text-zinc-500 mt-1">Request a disclosed, staff-accepted audio support session from an active POS terminal.</p></div>
        <Badge variant="outline" className="border-zinc-200 text-zinc-600">No recording</Badge>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between"><div><h2 className="font-bold text-zinc-900">POS terminals</h2><p className="text-xs text-zinc-500 mt-1">Only active cashier assignments can receive a request.</p></div><Radio className="w-5 h-5 text-orange-600" /></div>
        <div className="divide-y divide-zinc-100">
          {terminals.length === 0 && <p className="p-5 text-sm text-zinc-500">No POS terminals found.</p>}
          {terminals.map(terminal => (
            <div key={terminal.id} className="p-4 sm:px-5 flex flex-wrap items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-600"><Headphones className="w-5 h-5" /></div>
              <div className="flex-1 min-w-[160px]"><p className="font-bold text-sm text-zinc-900">{terminal.name || 'POS Terminal'}</p><p className="text-xs text-zinc-500">{terminal.unit || 'Business unit'} · {terminal.currentCashierId ? 'Cashier assigned' : 'No active cashier'}</p></div>
              <Badge variant="outline" className={terminal.currentCashierId ? 'border-emerald-200 text-emerald-700' : 'border-zinc-200 text-zinc-500'}>{terminal.currentCashierId ? 'Available' : 'Unassigned'}</Badge>
              <Button onClick={() => void requestSession(terminal)} disabled={!terminal.currentCashierId || busyTerminal === terminal.id} className="h-10 rounded-lg bg-orange-600 hover:bg-orange-700 text-white">{busyTerminal === terminal.id ? 'Sending…' : 'Request audio'}</Button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100"><h2 className="font-bold text-zinc-900">Session requests and active sessions</h2><p className="text-xs text-zinc-500 mt-1">Staff must explicitly accept before their microphone is opened.</p></div>
        <div className="divide-y divide-zinc-100">
          {sessions.length === 0 && <p className="p-5 text-sm text-zinc-500">No pending or active sessions.</p>}
          {sessions.map(session => (
            <div key={session.id} className="p-4 sm:px-5 flex flex-wrap items-center gap-3">
              <span className={'h-2.5 w-2.5 rounded-full ' + (session.status === 'ACCEPTED' ? 'bg-red-500 animate-pulse' : 'bg-amber-500')} />
              <div className="flex-1 min-w-[180px]"><p className="font-bold text-sm text-zinc-900">{session.terminalName || 'POS Terminal'}</p><p className="text-xs text-zinc-500">{session.status === 'REQUESTED' ? 'Waiting for staff approval' : 'Accepted by ' + (session.cashierName || 'staff operator')}</p></div>
              <Badge variant="outline">{session.status}</Badge>
              {session.status === 'ACCEPTED' && <Button variant="outline" className="h-10 rounded-lg" onClick={() => { setActiveSession(session); setAudioError(''); }}><Volume2 className="w-4 h-4 mr-2" />Listen</Button>}
              <Button variant="destructive" className="h-10 rounded-lg" onClick={() => void endSession(session)}><XCircle className="w-4 h-4 mr-2" />End</Button>
            </div>
          ))}
        </div>
      </section>

      {activeSession && (
        <section className="rounded-2xl border-2 border-red-300 bg-white p-5 space-y-4">
          <div className="flex items-center gap-3"><span className="h-10 w-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center"><Mic className="w-5 h-5" /></span><div className="flex-1"><p className="text-xs font-black uppercase tracking-wider text-red-700">Live · Staff consented</p><h2 className="font-bold text-zinc-900">{activeSession.terminalName || 'POS Terminal'}</h2></div><Badge className="bg-red-600 text-white">LIVE</Badge></div>
          <audio ref={audioRef} autoPlay controls className="w-full" />
          {!audioConnected && <p className="text-xs text-zinc-500">Connecting to the staff device. If audio does not start, use the audio player controls.</p>}
          {audioError && <p role="alert" className="text-sm text-red-600">{audioError}</p>}
          <div className="flex flex-wrap gap-2"><Button onClick={() => void audioRef.current?.play().then(() => setAudioConnected(true))} variant="outline" className="rounded-lg"><Volume2 className="w-4 h-4 mr-2" />Enable audio</Button><Button onClick={() => void endSession(activeSession)} variant="destructive" className="rounded-lg"><MicOff className="w-4 h-4 mr-2" />End session</Button></div>
        </section>
      )}
      <section className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100"><h2 className="font-bold text-zinc-900">Live audio audit trail</h2><p className="text-xs text-zinc-500 mt-1">Recent requests, acceptances, declines and session endings.</p></div>
        <div className="divide-y divide-zinc-100">
          {auditEntries.length === 0 && <p className="p-5 text-sm text-zinc-500">No live audio audit events yet.</p>}
          {auditEntries.map(entry => <div key={entry.id} className="px-5 py-3 flex flex-wrap gap-2 justify-between"><div><p className="text-xs font-bold text-zinc-800">{String(entry.action || '').replaceAll('_', ' ')}</p><p className="text-xs text-zinc-500 mt-1">{entry.details}</p></div><time className="text-[10px] text-zinc-400">{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ''}</time></div>)}
        </div>
      </section>
      <p className="text-[11px] text-zinc-400 leading-relaxed">Sessions are not recorded. A staff member must accept each request, the POS displays a persistent microphone-live warning, and either party can end the session. A production TURN relay may be required for networks that block direct peer-to-peer audio.</p>
    </main>
  );
}
