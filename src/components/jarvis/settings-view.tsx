
'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Cpu, 
  Volume2, 
  Mic, 
  ShieldAlert, 
  Database, 
  Key, 
  Download, 
  Upload, 
  Trash2,
  Zap,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { useFirestore, useUser } from '@/firebase';
import { doc, setDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { logger } from '@/lib/logger';
import { UserSettings } from '@/lib/types';
import { jarvisVoice } from '@/lib/voice-system';

interface SettingsViewProps {
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => void;
}

export function SettingsView({ settings, onUpdateSettings }: SettingsViewProps) {
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setMics(devices.filter(d => d.kind === 'audioinput'));
    });
  }, []);

  const handleUpdate = (updates: Partial<UserSettings>) => {
    onUpdateSettings({ ...settings, ...updates });
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "jarvis_settings.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        onUpdateSettings(imported);
        logger.info("Settings imported successfully.");
      } catch (err) {
        logger.error("Failed to import settings.");
      }
    };
    reader.readAsText(file);
  };

  const handleClearMemory = async () => {
    if (!user || !firestore) return;
    const confirm = window.confirm("Are you sure you want to clear all neural memories? This cannot be undone.");
    if (!confirm) return;

    try {
      const memoriesRef = collection(firestore, 'users', user.uid, 'memories');
      const snapshot = await getDocs(memoriesRef);
      const batch = writeBatch(firestore);
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      logger.info("Neural memory purged.");
    } catch (err) {
      logger.error("Failed to purge memories.");
    }
  };

  return (
    <div className="h-full flex flex-col p-8 font-rajdhani">
      <div className="flex items-center gap-4 mb-8 border-b border-cyan-500/20 pb-4">
        <Settings className="h-8 w-8 text-cyan-400" />
        <div>
          <h2 className="text-2xl font-bold tracking-[0.2em] uppercase font-orbitron">System Configuration</h2>
          <p className="text-xs text-cyan-500/60 uppercase tracking-widest">Hardware & Neural Interface calibration</p>
        </div>
      </div>

      <ScrollArea className="flex-1 pr-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-20">
          
          {/* Intelligence Section */}
          <div className="space-y-6">
            <div className="p-6 border border-cyan-500/10 bg-cyan-500/5 space-y-4">
              <div className="flex items-center gap-3 text-cyan-400 font-bold tracking-widest uppercase text-sm">
                <Cpu className="h-4 w-4" /> Neural Engine
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest opacity-60">Gemini Model</Label>
                  <Select value={settings.geminiModel} onValueChange={(v: any) => handleUpdate({ geminiModel: v })}>
                    <SelectTrigger className="bg-black/40 border-cyan-500/20 rounded-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-cyan-500/30 text-cyan-50 rounded-none">
                      <SelectItem value="googleai/gemini-2.5-flash">Gemini 2.5 Flash (Fastest)</SelectItem>
                      <SelectItem value="googleai/gemini-1.5-pro">Gemini 1.5 Pro (Deep Reasoning)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] uppercase tracking-widest">Continuous Listening</Label>
                    <p className="text-[9px] text-cyan-500/40">Keep neural link open for passive wake-word</p>
                  </div>
                  <Switch checked={settings.continuousListening} onCheckedChange={(v) => handleUpdate({ continuousListening: v })} />
                </div>
              </div>
            </div>

            {/* Voice Section */}
            <div className="p-6 border border-cyan-500/10 bg-cyan-500/5 space-y-4">
              <div className="flex items-center gap-3 text-cyan-400 font-bold tracking-widest uppercase text-sm">
                <Volume2 className="h-4 w-4" /> Auditory Output
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase tracking-widest">Neural Vocalization</Label>
                  <Switch checked={settings.voiceEnabled} onCheckedChange={(v) => handleUpdate({ voiceEnabled: v })} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest opacity-60">Voice Pitch</Label>
                  <Slider value={[settings.voicePitch]} min={0.5} max={1.5} step={0.1} onValueChange={([v]) => handleUpdate({ voicePitch: v })} className="py-2" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest opacity-60">Vocalization Rate</Label>
                  <Slider value={[settings.voiceRate]} min={0.5} max={2} step={0.1} onValueChange={([v]) => handleUpdate({ voiceRate: v })} className="py-2" />
                </div>
              </div>
            </div>

            {/* Audio Input Section */}
            <div className="p-6 border border-cyan-500/10 bg-cyan-500/5 space-y-4">
              <div className="flex items-center gap-3 text-cyan-400 font-bold tracking-widest uppercase text-sm">
                <Mic className="h-4 w-4" /> Auditory Input
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest opacity-60">Input Device</Label>
                  <Select value={settings.selectedMicId} onValueChange={(v) => handleUpdate({ selectedMicId: v })}>
                    <SelectTrigger className="bg-black/40 border-cyan-500/20 rounded-none">
                      <SelectValue placeholder="Select Microphone" />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-cyan-500/30 text-cyan-50 rounded-none">
                      {mics.map(mic => (
                        <SelectItem key={mic.deviceId} value={mic.deviceId}>{mic.label || `Mic ${mic.deviceId.slice(0, 5)}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase tracking-widest">Wake-Word Detection</Label>
                  <Switch checked={settings.wakeWordEnabled} onCheckedChange={(v) => handleUpdate({ wakeWordEnabled: v })} />
                </div>
              </div>
            </div>
          </div>

          {/* Security & Data Section */}
          <div className="space-y-6">
            <div className="p-6 border border-yellow-500/10 bg-yellow-500/5 space-y-4">
              <div className="flex items-center gap-3 text-yellow-500 font-bold tracking-widest uppercase text-sm">
                <ShieldAlert className="h-4 w-4" /> System Safety
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] uppercase tracking-widest">Automation Auth</Label>
                    <p className="text-[9px] text-yellow-500/40">Require confirmation for dangerous routines</p>
                  </div>
                  <Switch checked={settings.requireAutomationConfirmation} onCheckedChange={(v) => handleUpdate({ requireAutomationConfirmation: v })} />
                </div>
              </div>
            </div>

            <div className="p-6 border border-cyan-500/10 bg-cyan-500/5 space-y-4">
              <div className="flex items-center gap-3 text-cyan-400 font-bold tracking-widest uppercase text-sm">
                <Key className="h-4 w-4" /> Neural Access Keys
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest opacity-60">Gemini API Key</Label>
                  <Input 
                    type="password" 
                    value={settings.apiKeys.gemini || ''} 
                    onChange={(e) => handleUpdate({ apiKeys: { ...settings.apiKeys, gemini: e.target.value } })}
                    className="bg-black/40 border-cyan-500/20 rounded-none"
                    placeholder="Enter API Key"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-widest opacity-60">Search API Key</Label>
                  <Input 
                    type="password" 
                    value={settings.apiKeys.search || ''} 
                    onChange={(e) => handleUpdate({ apiKeys: { ...settings.apiKeys, search: e.target.value } })}
                    className="bg-black/40 border-cyan-500/20 rounded-none"
                    placeholder="Enter API Key"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border border-cyan-500/10 bg-cyan-500/5 space-y-4">
              <div className="flex items-center gap-3 text-cyan-400 font-bold tracking-widest uppercase text-sm">
                <Database className="h-4 w-4" /> Neural Context
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={handleExport} variant="outline" className="border-cyan-500/20 rounded-none flex gap-2 text-[10px] uppercase font-bold">
                  <Download className="h-3 w-3" /> Export Settings
                </Button>
                <div className="relative">
                  <Button variant="outline" className="w-full border-cyan-500/20 rounded-none flex gap-2 text-[10px] uppercase font-bold">
                    <Upload className="h-3 w-3" /> Import Settings
                  </Button>
                  <input type="file" onChange={handleImport} className="absolute inset-0 opacity-0 cursor-pointer" accept=".json" />
                </div>
                <Button onClick={handleClearMemory} variant="destructive" className="col-span-2 rounded-none flex gap-2 text-[10px] uppercase font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20">
                  <Trash2 className="h-3 w-3" /> Purge Neural Memory
                </Button>
              </div>
            </div>
          </div>

        </div>
      </ScrollArea>
    </div>
  );
}
