"use client";

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BrainCircuit, X } from 'lucide-react';
import { getTradeIdeaAction } from '@/lib/actions';
import type { MarketPoint, TimeFrame } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  history: MarketPoint[];
  strategy: string;
  timeFrame: TimeFrame;
}

const initialState = {
  message: null,
  tradeIdea: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? 'Generating...' : 'Get AI Trade Idea'}
    </Button>
  );
}

export function AIAssistant({ isOpen, onClose, symbol, history, strategy, timeFrame }: AIAssistantProps) {
  const [state, formAction] = useFormState(getTradeIdeaAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset form state when modal opens
      state.message = null;
      state.tradeIdea = null;
      state.error = null;
    }
  }, [isOpen, state]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0" onInteractOutside={(e) => e.preventDefault()}>
        <Card className="border-0 shadow-none rounded-lg">
          <form ref={formRef} action={formAction}>
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 p-6">
                <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <BrainCircuit className="w-6 h-6 text-primary" />
                    </div>
                </div>
                <div className="flex-1">
                    <CardTitle className="font-headline text-2xl">AI Technical Analyst</CardTitle>
                    <CardDescription>Get an AI-powered trade idea based on current market conditions.</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="absolute top-4 right-4">
                    <X className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <div className="space-y-4">
                <input type="hidden" name="symbol" value={symbol} />
                <input type="hidden" name="history" value={JSON.stringify(history)} />
                <input type="hidden" name="strategy" value={strategy} />
                <input type="hidden" name="timeFrame" value={timeFrame} />

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-muted-foreground">Symbol</p>
                    <p className="font-semibold">{symbol}</p>
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-muted-foreground">Strategy</p>
                    <p className="font-semibold">{strategy}</p>
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-muted-foreground">Timeframe</p>
                    <p className="font-semibold">{timeFrame}</p>
                  </div>
                </div>
                
                {state.error && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{state.error}</AlertDescription>
                  </Alert>
                )}

                {state.tradeIdea && (
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-semibold mb-2">Trade Idea:</h4>
                    <p className="text-sm font-code">{state.tradeIdea}</p>
                  </div>
                )}

                {!state.tradeIdea && useFormStatus().pending && (
                    <div className="bg-muted p-4 rounded-lg space-y-2">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="p-6 pt-0">
              <SubmitButton />
            </CardFooter>
          </form>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
