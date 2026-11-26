"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FlaskConical, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface StrategyBuilderProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StrategyBuilder({ isOpen, onClose }: StrategyBuilderProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0">
        <Card className="border-0">
          <CardHeader className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <FlaskConical className="w-8 h-8 text-primary" />
                <div>
                  <CardTitle className="font-headline text-2xl">Strategy Builder</CardTitle>
                  <CardDescription>Design, backtest, and deploy your custom trading strategies.</CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="-mt-2 -mr-2">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0 text-center">
            <div className="min-h-[400px] flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/50">
                <div className="text-center">
                    <FlaskConical className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">Coming Soon</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Our powerful strategy builder is under construction.
                    </p>
                </div>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
