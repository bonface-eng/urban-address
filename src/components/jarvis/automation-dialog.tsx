
'use client';

import React from 'react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldAlert, Terminal, Zap } from 'lucide-react';

interface AutomationDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  command: {
    type: string;
    params: any;
    isDangerous: boolean;
  } | null;
}

export function AutomationDialog({ isOpen, onConfirm, onCancel, command }: AutomationDialogProps) {
  if (!command) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="bg-black/90 border-cyan-500/30 text-cyan-50 font-rajdhani rounded-none border-l-4 border-l-yellow-500">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-3 text-xl tracking-widest font-orbitron uppercase">
            {command.isDangerous ? (
              <ShieldAlert className="h-6 w-6 text-yellow-500 animate-pulse" />
            ) : (
              <Zap className="h-6 w-6 text-cyan-400" />
            )}
            System Authorization Required
          </AlertDialogTitle>
          <AlertDialogDescription className="text-cyan-500/60 font-mono mt-4">
            JARVIS is requesting permission to execute the following neural routine:
            <div className="mt-4 p-4 bg-cyan-500/5 border border-cyan-500/20 text-cyan-300">
               <div className="flex items-center gap-2 mb-2">
                  <Terminal className="h-3 w-3" />
                  <span className="text-[10px] uppercase font-bold tracking-widest">Command: {command.type}</span>
               </div>
               <pre className="text-xs overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(command.params, null, 2)}
               </pre>
            </div>
            {command.isDangerous && (
              <p className="mt-4 text-yellow-500/80 text-[10px] uppercase font-bold animate-pulse">
                Warning: This action has significant system impact and cannot be undone.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-8">
          <AlertDialogCancel onClick={onCancel} className="bg-transparent border-cyan-500/20 text-cyan-500/60 hover:bg-cyan-500/5 hover:text-cyan-400 rounded-none">
            Abort Routine
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-cyan-500 text-black hover:bg-cyan-400 rounded-none font-bold">
            Authorize Execution
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
