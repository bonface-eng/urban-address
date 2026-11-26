"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MessageSquare, Send, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatBotProps {
  currentSymbol: string;
  currentPrice: number;
}

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
}

export function ChatBot({ currentSymbol, currentPrice }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = { id: Date.now(), text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);

    // Mock bot response
    setTimeout(() => {
      const botResponse: Message = {
        id: Date.now() + 1,
        text: `Thanks for asking about ${currentSymbol}. The current price is ${currentPrice.toFixed(4)}. How else can I help you?`,
        sender: 'bot',
      };
      setMessages(prev => [...prev, botResponse]);
    }, 1000);

    setInput('');
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" className="rounded-full w-14 h-14 shadow-lg bg-primary hover:bg-primary/90">
          <MessageSquare className="h-6 w-6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 mr-4" align="end">
        <div className="flex flex-col h-[400px]">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-headline font-semibold">TradePilot Assistant</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map(message => (
                <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`rounded-lg px-3 py-2 max-w-[80%] text-sm ${message.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {message.text}
                  </div>
                </div>
              ))}
               {messages.length === 0 && (
                <div className="text-center text-xs text-muted-foreground p-4">
                    Ask me anything about trading, markets, or your account.
                </div>
               )}
            </div>
          </ScrollArea>
          <div className="p-4 border-t">
            <div className="relative">
              <Input
                placeholder="Ask something..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSend()}
              />
              <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={handleSend}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
