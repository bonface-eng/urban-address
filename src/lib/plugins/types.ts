
import { LucideIcon } from 'lucide-react';
import { Tool } from 'genkit';

/**
 * JARVIS Plugin Manifest Interface
 */
export interface JarvisPlugin {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  version: string;
  
  // Intelligence extensions
  tools?: Tool<any, any>[];
  
  // UI extensions
  component: React.ComponentType<any>;
  
  // Module-specific settings
  settings?: {
    id: string;
    label: string;
    type: 'boolean' | 'string' | 'number';
    default: any;
  }[];
}
