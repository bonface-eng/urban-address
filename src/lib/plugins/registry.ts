
import { JarvisPlugin } from './types';
import { Layout, TrendingUp, ShoppingBag, Code } from 'lucide-react';

// We import the plugin definitions here for "Auto-loading"
// In a production Next.js app, this registry acts as the source of truth
export class PluginRegistry {
  private static plugins: Map<string, JarvisPlugin> = new Map();

  static register(plugin: JarvisPlugin) {
    this.plugins.set(plugin.id, plugin);
  }

  static getPlugin(id: string): JarvisPlugin | undefined {
    return this.plugins.get(id);
  }

  static getAllPlugins(): JarvisPlugin[] {
    return Array.from(this.plugins.values());
  }
}

// Internal Core Plugins initialized at runtime
export const initializePlugins = (
  CoreModule: React.ComponentType,
  TradingModule: React.ComponentType,
  EcomModule: React.ComponentType,
  DevModule: React.ComponentType
) => {
  PluginRegistry.register({
    id: 'CORE',
    name: 'Core Intelligence',
    description: 'Master system management and general assistance.',
    icon: Layout,
    version: '1.0.0',
    component: CoreModule
  });

  PluginRegistry.register({
    id: 'AXIS_TRADING',
    name: 'AXIS Trading',
    description: 'Financial analysis and market execution core.',
    icon: TrendingUp,
    version: '1.2.0',
    component: TradingModule
  });

  PluginRegistry.register({
    id: 'SOKKO_ECOM',
    name: 'Sokko Sasa',
    description: 'E-commerce operations and order management.',
    icon: ShoppingBag,
    version: '1.0.5',
    component: EcomModule
  });

  PluginRegistry.register({
    id: 'DEV_TOOLS',
    name: 'Dev Terminal',
    description: 'Software development and system automation suite.',
    icon: Code,
    version: '2.0.0',
    component: DevModule
  });
};
