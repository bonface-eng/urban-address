'use client';

import React, { useState } from 'react';
import { Star, Send, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useUser, useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export function ReviewForm() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  
  // Starts with 0 rating so user has to mark them manually
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Identification Required", description: "Sign in to share your Urban experience." });
      router.push('/login');
      return;
    }

    if (rating === 0) {
      toast({ variant: "destructive", title: "Rating Required", description: "Please select a star rating between 1 and 5." });
      return;
    }

    if (!comment.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore!, 'reviews'), {
        userId: user.uid,
        userName: user.displayName || 'Urban Guest',
        userPhoto: user.photoURL,
        rating,
        comment: comment.trim(),
        timestamp: Date.now()
      });

      setComment('');
      setRating(0);
      toast({ title: "Feedback Captured", description: "Your review is now live in the community feed." });
    } catch (err) {
      toast({ variant: "destructive", title: "Sync Error", description: "Failed to post your review." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary shadow-inner">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-black uppercase text-zinc-900 tracking-tight">Leave a Review</h3>
          <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Global Community Feed</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <Label className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Rate Quality</Label>
            <span className="text-[8px] font-black text-primary uppercase">{rating > 0 ? `${rating}/5 Stars` : 'Select Rating'}</span>
          </div>
          <div className="flex gap-1.5 p-3 bg-zinc-50 rounded-xl border border-zinc-100/50 justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="transition-transform active:scale-90"
              >
                <Star 
                  className={cn(
                    "w-6 h-6 transition-colors",
                    star <= rating ? "fill-primary text-primary" : "text-zinc-200 fill-white"
                  )} 
                />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[8px] font-black uppercase tracking-widest text-zinc-400 px-1">Review Message</Label>
          <Textarea 
            placeholder="Describe your service experience..." 
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[100px] bg-zinc-50 border-none rounded-xl p-4 text-xs font-bold resize-none focus:ring-1 focus:ring-primary/20"
            required
          />
        </div>

        <Button 
          type="submit" 
          disabled={isSubmitting || !comment.trim() || rating === 0}
          className="w-full h-12 bg-zinc-900 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-xl transition-all active:scale-95 gap-3"
        >
          {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {isSubmitting ? 'Processing...' : 'Submit Review'}
        </Button>
      </form>
    </div>
  );
}
