'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot, setDoc, addDoc, collection } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useProfile } from '@/hooks/use-profile';

export interface ReceiptCustomSection {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  order: number;
}

export interface ReceiptSettings {
  storeHeader: string;
  loungeHeader: string;
  carwashHeader: string;
  branchName: string;
  location: string;
  phone: string;
  paybill: string;
  accountNo: string;
  loungePaybill: string;
  loungeAccountNo: string;
  vatNumber?: string;
  footerNote: string;
  footerTagline: string;
  receiptSections?: ReceiptCustomSection[];
  updatedAt?: number;
  updatedBy?: string;
}

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  storeHeader: 'URBAN ACCESSORIES',
  loungeHeader: 'URBAN ADDRESS',
  carwashHeader: 'URBAN AUTO EXPRESS',
  branchName: 'NAKA CENTER BRANCH',
  location: 'NAKURU, KENYA',
  phone: '0785860753',
  paybill: '222111',
  accountNo: '035',
  loungePaybill: '516600',
  loungeAccountNo: '449449',
  vatNumber: 'P051234567Z',
  footerNote: 'Thank you for your patronage',
  footerTagline: 'Urban Express Business OS',
  receiptSections: [],
};

export function useReceiptSettings() {
  const firestore = useFirestore();
  const { profile } = useProfile();
  const [settings, setSettings] = useState<ReceiptSettings>(DEFAULT_RECEIPT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore) {
      setLoading(false);
      return;
    }

    const docRef = doc(firestore, 'settings', 'receipt_config');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Partial<ReceiptSettings>;
        setSettings({
          ...DEFAULT_RECEIPT_SETTINGS,
          ...data,
          receiptSections: Array.isArray(data.receiptSections) ? data.receiptSections : [],
        });
      } else {
        setSettings(DEFAULT_RECEIPT_SETTINGS);
      }
      setLoading(false);
    }, (err) => {
      console.error('[RECEIPT_SETTINGS_ERROR]', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore]);

  const updateSettings = async (newSettings: Partial<ReceiptSettings>) => {
    if (!firestore || !profile) return false;
    try {
      const merged = {
        ...settings,
        ...newSettings,
        updatedAt: Date.now(),
        updatedBy: profile.uid
      };

      await setDoc(doc(firestore, 'settings', 'receipt_config'), merged, { merge: true });

      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'RECEIPT_CONFIG_UPDATE',
        userId: profile.uid,
        details: `Updated receipt header and branding settings (${merged.branchName})`,
        timestamp: Date.now(),
        severity: 'INFO'
      });

      toast({ 
        title: "Receipt Settings Saved", 
        description: "Updated thermal receipt headers, address, and branding." 
      });
      return true;
    } catch (err: any) {
      toast({ 
        variant: "destructive", 
        title: "Save Failed", 
        description: err.message || "Failed to update receipt settings." 
      });
      return false;
    }
  };

  return { settings, loading, updateSettings };
}
