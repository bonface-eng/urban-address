'use client';

import React from 'react';
import { Star, Quote, CheckCircle2 } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Review } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export function ReviewList() {
  const firestore = useFirestore();

  const reviewsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'reviews'), orderBy('timestamp', 'desc'), limit(9));
  }, [firestore]);

  const { data: reviews, loading } = useCollection<Review>(reviewsQuery);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-40 bg-zinc-50 rounded-2xl border border-zinc-100" />
        ))}
      </div>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <div className="py-16 text-center bg-zinc-50 rounded-[2rem] border-2 border-dashed border-zinc-100">
         <Quote className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
         <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-300">Share the first Urban story</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {reviews.map((review) => (
        <div 
          key={review.id} 
          className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-lg transition-all group flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star} 
                    className={cn(
                      "w-3 h-3",
                      star <= review.rating ? "fill-primary text-primary" : "text-zinc-100 fill-zinc-50"
                    )} 
                  />
                ))}
              </div>
              <Quote className="w-4 h-4 text-zinc-100 group-hover:text-primary/10 transition-colors" />
            </div>

            <p className="text-[11px] font-bold text-zinc-600 leading-relaxed uppercase tracking-tight line-clamp-4">
              "{review.comment}"
            </p>
          </div>

          <div className="flex items-center gap-3 pt-4 mt-4 border-t border-zinc-50">
            <Avatar className="h-8 w-8 rounded-lg border border-zinc-100 shadow-sm">
              <AvatarImage src={review.userPhoto || undefined} />
              <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black uppercase">{review.userName?.[0]}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-black uppercase text-zinc-900 truncate">{review.userName}</p>
                <CheckCircle2 className="w-2.5 h-2.5 text-blue-500 shrink-0" />
              </div>
              <p className="text-[7px] font-bold text-zinc-400 uppercase tracking-widest">Verified</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
