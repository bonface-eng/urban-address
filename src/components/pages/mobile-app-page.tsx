"use client";

import { Button } from "@/components/ui/button";
import { AppleIcon } from "@/components/icons";
import { Smartphone } from "lucide-react";

const PlayStoreIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3.1,2.5l9.9,9.9l-9.9,9.9C1.6,20.8,1.6,18,3.1,2.5z M14.5,12.4L4.6,2.5C6.1,1,8.9,1,14.5,12.4z M14.5,12.4L4.6,22.3C6.1,23.8,8.9,23.8,14.5,12.4z M16,16.8l4.9-2.9c1.5-1.5,1.5-2.9,0-4.4L16,6.7V16.8z"/>
    </svg>
)

export default function MobileAppPage() {
  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div className="text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-headline font-bold">Trade on the Go</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Get the full power of TradePilot in your pocket. Our mobile app provides a seamless trading experience, so you never miss an opportunity.
          </p>
          <div className="mt-8 flex justify-center md:justify-start gap-4">
            <Button size="lg" className="h-14">
              <AppleIcon />
              <div className="ml-3 text-left">
                <p className="text-xs">Download on the</p>
                <p className="text-lg font-semibold -mt-1">App Store</p>
              </div>
            </Button>
            <Button size="lg" className="h-14">
              <PlayStoreIcon />
              <div className="ml-3 text-left">
                <p className="text-xs">GET IT ON</p>
                <p className="text-lg font-semibold -mt-1">Google Play</p>
              </div>
            </Button>
          </div>
        </div>
        <div className="flex justify-center">
            <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[600px] w-[300px] shadow-xl">
                <div className="w-[148px] h-[18px] bg-gray-800 top-0 rounded-b-[1rem] left-1/2 -translate-x-1/2 absolute"></div>
                <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[124px] rounded-l-lg"></div>
                <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[178px] rounded-l-lg"></div>
                <div className="h-[64px] w-[3px] bg-gray-800 absolute -right-[17px] top-[142px] rounded-r-lg"></div>
                <div className="rounded-[2rem] overflow-hidden w-[272px] h-[572px] bg-background">
                    <div className="flex flex-col h-full p-2 bg-background">
                        <div className="text-center py-2">
                            <h2 className="font-headline font-bold text-xl">TradePilot</h2>
                        </div>
                        <div className="flex-1 bg-muted rounded-lg p-2 flex items-center justify-center">
                            <Smartphone className="w-24 h-24 text-muted-foreground/50"/>
                        </div>
                         <div className="mt-2 text-center">
                             <p className="font-bold">BTC/USD</p>
                             <p className="text-green-500 font-semibold text-lg">$68,123.45</p>
                         </div>
                        <div className="flex gap-2 mt-4">
                            <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white">Buy</Button>
                            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white">Sell</Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
