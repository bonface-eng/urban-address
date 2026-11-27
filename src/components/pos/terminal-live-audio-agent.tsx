'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Headphones, Mic, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDb } from '@/lib/data';
import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from '@/lib/db';

type AudioSession = {
  id: string;
  terminalId: string;
  terminalName?: string;
  cashierId: string;
  requestedByName?: string;
  status: 'REQUESTED' | 'ACCEPTED' | 'DECLINED' | 'ENDED';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
};

export function TerminalLiveAudioAgent({ terminalId, cashierId, cashierName }: { terminalId?: string; cashierId?: string; cashierName?: string }) {
  const firestore = useDb();
  const [request, setRequest] = useState<AudioSession | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<AudioSession | null>(null);
  const seenRequestRef = useRef<string | null>(null);
  const answerTimeoutRef = useRef<number | null>(null);

  const stopSession = useCallback(async (notify = true) => {
    const current = sessionRef.current;
    if (answerTimeoutRef.current !== null) window.clearTimeout(answerTimeoutRef.current);
    answerTimeoutRef.current = null;
    const peer = peerRef.current as (RTCPeerConnection & { __sessionUnsub?: () => void; __candidatesUnsub?: () => void }) | null;
    peer?.__sessionUnsub?.();
    peer?.__candidatesUnsub?.();
    peer?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    sessionRef.current = null;
    setActive(false);
    setRequest(null);
    if (notify && current && firestore) {
      try {
        await updateDoc(doc(firestore, 'live_audio_sessions', current.id), { status: 'ENDED', endedAt: Date.now(), endedBy: cashierId || '' });
        await addDoc(collection(firestore, 'audit_logs'), { action: 'LIVE_AUDIO_ENDED', userId: cashierId || '', details: 'Staff ended live audio session ' + current.id, timestamp: Date.now(), severity: 'WARNING' });
      } catch {}
    }
  }, [firestore, cashierId]);

  useEffect(() => {
    if (!firestore || !terminalId || !cashierId) return;
    const q = query(collection(firestore, 'live_audio_sessions'), where('cashierId', '==', cashierId));
    return onSnapshot(q, snapshot => {
      const next = snapshot.docs.find(item => item.data().status === 'REQUESTED' && item.data().terminalId === terminalId);
      if (!next) return;
      const data = { ...next.data(), id: next.id } as AudioSession;
      if (seenRequestRef.current === data.id) return;
      seenRequestRef.current = data.id;
      setRequest(data);
      setError('');
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification('Live audio session requested', { body: 'An administrator is requesting a live audio session. Review and accept on the POS screen.' }); } catch {}
      }
    });
  }, [firestore, terminalId, cashierId]);

  useEffect(() => () => {
    if (answerTimeoutRef.current !== null) window.clearTimeout(answerTimeoutRef.current);
    const current = sessionRef.current;
    const peer = peerRef.current as (RTCPeerConnection & { __sessionUnsub?: () => void; __candidatesUnsub?: () => void }) | null;
    peer?.__sessionUnsub?.();
    peer?.__candidatesUnsub?.();
    peer?.close();
    streamRef.current?.getTracks().forEach(track => track.stop());
    if (current && firestore) {
      void updateDoc(doc(firestore, 'live_audio_sessions', current.id), { status: 'ENDED', endedAt: Date.now(), endedBy: cashierId || '' }).catch(() => {});
    }
  }, [firestore, cashierId]);

  const decline = async () => {
    if (!request || !firestore) return;
    await updateDoc(doc(firestore, 'live_audio_sessions', request.id), { status: 'DECLINED', declinedAt: Date.now(), declinedBy: cashierId });
    try { await addDoc(collection(firestore, 'audit_logs'), { action: 'LIVE_AUDIO_DECLINED', userId: cashierId, details: 'Staff declined a live audio request for terminal ' + request.terminalId, timestamp: Date.now(), severity: 'WARNING' }); } catch {}
    seenRequestRef.current = null;
    setRequest(null);
  };

  const accept = async () => {
    if (!request || !firestore || busy) return;
    setBusy(true);
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      streamRef.current = stream;
      const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerRef.current = peer;
      sessionRef.current = request;
      stream.getAudioTracks().forEach(track => peer.addTrack(track, stream));
      let signalingReady = false;
      const queuedLocalCandidates: RTCIceCandidateInit[] = [];
      peer.onicecandidate = event => {
        if (!event.candidate || !firestore) return;
        const candidate = event.candidate.toJSON();
        if (!signalingReady) queuedLocalCandidates.push(candidate);
        else void addDoc(collection(firestore, 'live_audio_sessions', request.id, 'staff_candidates'), candidate);
      };
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await updateDoc(doc(firestore, 'live_audio_sessions', request.id), {
        status: 'ACCEPTED',
        acceptedAt: Date.now(),
        acceptedBy: cashierId,
        cashierName: cashierName || 'Staff operator',
        offer: { type: offer.type, sdp: offer.sdp }
      });
      signalingReady = true;
      for (const candidate of queuedLocalCandidates.splice(0)) {
        await addDoc(collection(firestore, 'live_audio_sessions', request.id, 'staff_candidates'), candidate);
      }
      const pendingCandidates: RTCIceCandidateInit[] = [];
      const sessionUnsub = onSnapshot(doc(firestore, 'live_audio_sessions', request.id), async snap => {
        const data = snap.data();
        if (!data || data.status === 'ENDED' || data.status === 'DECLINED') {
          void stopSession(false);
          return;
        }
        if (data.answer && peer.signalingState === 'have-local-offer') {
          try {
            await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
            if (answerTimeoutRef.current !== null) window.clearTimeout(answerTimeoutRef.current);
            answerTimeoutRef.current = null;
            for (const candidate of pendingCandidates.splice(0)) await peer.addIceCandidate(new RTCIceCandidate(candidate));
            setActive(true);
          } catch {}
        }
      });
      const candidatesUnsub = onSnapshot(collection(firestore, 'live_audio_sessions', request.id, 'admin_candidates'), snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const candidate = change.doc.data() as RTCIceCandidateInit;
            if (peer.remoteDescription) void peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            else pendingCandidates.push(candidate);
          }
        });
      });
      peer.addEventListener('connectionstatechange', () => {
        if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected' || peer.connectionState === 'closed') {
          void stopSession(true);
        }
      });
      // Keep Firestore listeners attached to the session lifecycle.
      try { await addDoc(collection(firestore, 'audit_logs'), { action: 'LIVE_AUDIO_ACCEPTED', userId: cashierId, details: 'Staff accepted a live audio session for terminal ' + request.terminalId, timestamp: Date.now(), severity: 'WARNING' }); } catch {}
      (peer as any).__sessionUnsub = sessionUnsub;
      (peer as any).__candidatesUnsub = candidatesUnsub;
      answerTimeoutRef.current = window.setTimeout(() => {
        if (peer.signalingState === 'have-local-offer') {
          setError('No administrator joined the session. The microphone has been turned off.');
          void stopSession(true);
        }
      }, 30000);
      setRequest(null);
      setActive(true);
    } catch (err: any) {
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      peerRef.current?.close();
      peerRef.current = null;
      setError(err?.name === 'NotAllowedError' ? 'Microphone permission was denied. No audio was sent.' : 'Could not start the live audio session. Check the microphone and network.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {error && !request && !active && <div role="alert" className="fixed bottom-4 left-4 right-4 z-[6500] mx-auto max-w-xl rounded-xl border border-amber-300 bg-white p-3 text-sm text-amber-800 shadow-xl">{error}</div>}
      {request && !active && (
        <div className="fixed inset-0 z-[6000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <section role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3"><div className="h-11 w-11 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center"><Headphones className="w-5 h-5" /></div><div><p className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Live audio request</p><h2 className="text-xl font-black text-zinc-900">Administrator wants to listen</h2></div></div>
            <p className="text-sm text-zinc-600 leading-relaxed"><strong>{request.requestedByName || 'An administrator'}</strong> is requesting a live audio support session for this POS terminal. Audio will only be transmitted if you accept. The microphone indicator will remain visible until the session ends.</p>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={decline} disabled={busy} className="h-12 rounded-xl">Decline</Button>
              <Button onClick={accept} disabled={busy} className="h-12 rounded-xl bg-orange-600 hover:bg-orange-700">{busy ? 'Connecting…' : 'Accept & start mic'}</Button>
            </div>
          </section>
        </div>
      )}
      {active && (
        <div className="fixed bottom-4 left-4 right-4 z-[6500] mx-auto max-w-xl rounded-xl border-2 border-red-500 bg-white p-3 shadow-2xl flex items-center gap-3">
          <span className="h-9 w-9 shrink-0 rounded-lg bg-red-50 text-red-600 flex items-center justify-center animate-pulse"><Mic className="w-5 h-5" /></span>
          <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-wide text-red-700">Microphone live · session accepted</p><p className="text-[11px] text-zinc-500">Audio is available to the administrator until either party ends the session.</p></div>
          <Button size="sm" variant="destructive" onClick={() => void stopSession(true)} className="h-10 rounded-lg"><PhoneOff className="w-4 h-4 mr-1" />End</Button>
        </div>
      )}
    </>
  );
}
