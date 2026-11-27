import type { Order } from './types';

export function summarizeDashboard(baseOrders: Order[], dateFilter: string, personal: boolean) {
    const loungeSales = baseOrders.filter(o => o.type === 'LOUNGE').reduce((sum, o) => sum + o.total, 0);
    const storeSales = baseOrders.filter(o => o.type === 'STORE').reduce((sum, o) => sum + o.total, 0);
    const carwashSales = baseOrders.filter(o => o.type === 'CARWASH').reduce((sum, o) => sum + o.total, 0);
    const totalSales = loungeSales + storeSales + carwashSales;

    const departmentalData = [
      { name: 'Lounge', value: loungeSales, color: 'hsl(35, 91%, 50%)' },
      { name: 'Store', value: storeSales, color: 'hsl(240, 5%, 10%)' },
      { name: 'Carwash', value: carwashSales, color: 'hsl(25, 100%, 50%)' },
    ];

    let velocityData: Array<{name:string;total:number}> = [];
    if (dateFilter === 'TODAY' || dateFilter === 'YESTERDAY') {
      const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
      velocityData = hours.map(h => ({ name: h, total: 0 }));
      baseOrders.forEach(o => {
        const hour = Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Nairobi',hour:'2-digit',hourCycle:'h23'}).format(new Date(o.timestamp)));
        const timeSlot = velocityData.find(d => parseInt(d.name) <= hour && parseInt(d.name) + 2 > hour);
        if (timeSlot) timeSlot.total += o.total;
      });
    } else {
      const days: Record<string, number> = {};
      baseOrders.forEach(o => {
        const dayStr = new Date(o.timestamp).toLocaleDateString('en-KE', { timeZone:'Africa/Nairobi', day: '2-digit', month: 'short' });
        days[dayStr] = (days[dayStr] || 0) + o.total;
      });
      velocityData = Object.entries(days).map(([name, total]) => ({ name, total })).reverse();
    }

    const lowStockItems: never[] = [];
    const activeNodes = 0;

    const productCounts: Record<string, { name: string, count: number }> = {};
    baseOrders.forEach(o => {
      o.items?.forEach(item => {
        if (!productCounts[item.productId]) productCounts[item.productId] = { name: item.name, count: 0 };
        productCounts[item.productId].count += item.quantity;
      });
    });
    const topProducts = Object.values(productCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const cashierLeaderboard: Record<string, { name: string, volume: number }> = {};
    baseOrders.forEach(o => {
      const cid = o.cashierId || 'System';
      if (!cashierLeaderboard[cid]) cashierLeaderboard[cid] = { name: o.cashierName || 'Staff', volume: 0 };
      cashierLeaderboard[cid].volume += o.total;
    });

    const topCashier = Object.values(cashierLeaderboard)
      .sort((a, b) => b.volume - a.volume)[0];

    // Services vs Products comparison metrics
    let serviceVolume = 0;
    let serviceCount = 0;
    let productVolume = 0;
    let productCount = 0;

    baseOrders.forEach(o => {
      const itemsCount = o.items?.reduce((s, it) => s + (it.quantity || 1), 0) || 1;
      if (o.type === 'CARWASH') {
        serviceVolume += (o.total || 0);
        serviceCount += itemsCount;
      } else {
        productVolume += (o.total || 0);
        productCount += itemsCount;
      }
    });

    const servicesVsProducts = [
      { name: 'Services (Carwash)', value: serviceVolume, count: serviceCount, color: 'hsl(25, 100%, 50%)' },
      { name: 'Products (Store & F&B)', value: productVolume, count: productCount, color: 'hsl(240, 5%, 26%)' }
    ];

    const departmentalComparison = [
      { name: 'Carwash Services', value: carwashSales, count: baseOrders.filter(o => o.type === 'CARWASH').length, color: 'hsl(25, 100%, 50%)' },
      { name: 'Retail Store', value: storeSales, count: baseOrders.filter(o => o.type === 'STORE').length, color: 'hsl(240, 5%, 15%)' },
      { name: 'Lounge & Bar', value: loungeSales, count: baseOrders.filter(o => o.type === 'LOUNGE').length, color: 'hsl(38, 92%, 50%)' }
    ];

    const itemSalesMap: Record<string, { name: string; value: number; count: number; isService: boolean }> = {};
    baseOrders.forEach(o => {
      const isService = o.type === 'CARWASH';
      o.items?.forEach(it => {
        const key = it.name.trim();
        if (!itemSalesMap[key]) {
          itemSalesMap[key] = { name: key, value: 0, count: 0, isService };
        }
        itemSalesMap[key].value += (it.price || 0) * (it.quantity || 1);
        itemSalesMap[key].count += (it.quantity || 1);
      });
    });

    const PIE_COLORS = [
      'hsl(25, 100%, 50%)',
      'hsl(217, 91%, 60%)',
      'hsl(38, 92%, 50%)',
      'hsl(142, 71%, 45%)',
      'hsl(262, 83%, 58%)',
      'hsl(240, 5%, 35%)'
    ];

    const topSoldComparison = Object.values(itemSalesMap)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((it, idx) => ({
        name: it.name,
        value: it.value,
        count: it.count,
        color: PIE_COLORS[idx % PIE_COLORS.length]
      }));

    return {
      loungeSales,
      storeSales,
      carwashSales,
      totalSales,
      velocityData,
      departmentalData,
      topProducts,
      topCashier,
      lowStockItems,
      activeNodes,
      orderCount: baseOrders.length,
      isPersonalView: personal,
      baseOrders: [...baseOrders].sort((a,b)=>b.timestamp-a.timestamp).slice(0,5),
      servicesVsProducts,
      departmentalComparison,
      topSoldComparison
    };
}
