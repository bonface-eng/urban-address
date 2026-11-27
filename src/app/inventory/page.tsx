'use client';

import { PageHeader } from '@/components/shared/page-layout';

import React, { useState, useMemo, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { 
  Search, 
  Plus, 
  Edit2, 
  Package, 
  Zap, 
  Wine,
  ShoppingBag,
  TrendingUp,
  AlertTriangle,
  Boxes,
  Printer,
  FileText,
  Clock,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCcw,
  LayoutList,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Info,
  Calendar,
  History,
  TrendingDown,
  Activity,
  CheckCircle2,
  Tag,
  BarChart3, 
  ShieldCheck,
  Barcode,
  Moon,
  Sun,
  Minus,
  Upload,
  ClipboardCheck,
  ArrowLeftRight,
  Archive,
  FileDown,
  DollarSign,
  PackageX,
  Filter,
  ArrowUpDown,
  CheckSquare,
  Square,
  AlertCircle,
  Percent,
  Camera,
  Coins,
  Link as LinkIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { notifyTelegramClientEvent } from '@/lib/telegram/client-events';
import { Product, BusinessUnit, Order } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, addDoc, where, doc, updateDoc, deleteDoc, getDocs, limit, writeBatch } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useProfile } from '@/hooks/use-profile';
import { ImageUpload } from '@/components/shared/image-upload';
import { exportAsReceiptText } from '@/lib/csv-export';
import { ReceiptPreview } from '@/components/pos/receipt-preview';
import Link from 'next/link';

const CATEGORIES = ['Accessories', 'Oils', 'Cleaning', 'Tyres', 'Parts', 'Drinks', 'Food', 'Tobacco', 'Other'];

type StockStatusFilter = 'ALL' | 'IN_STOCK' | 'LOW' | 'OUT' | 'ARCHIVED';
type SortOption = 'name_asc' | 'name_desc' | 'price_desc' | 'price_asc' | 'stock_asc' | 'stock_desc' | 'value_desc';

export default function InventoryCatalogue() {
  const firestore = useFirestore();
  const { profile, isSuperAdmin } = useProfile();
  
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [activeUnitTab, setActiveUnitTab] = useState<BusinessUnit>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('uax_inventory_unit') as BusinessUnit) || 'STORE';
    }
    return 'STORE';
  });

  const [stockStatusFilter, setStockStatusFilter] = useState<StockStatusFilter>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('uax_inventory_status') as StockStatusFilter) || 'ALL';
    }
    return 'ALL';
  });

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  type InventoryWorkflow = 'product' | 'service' | 'details' | 'transfer' | 'import' | 'report';
  const [activeWorkflow, setActiveWorkflow] = useState<InventoryWorkflow | null>(null);

  const openWorkflow = (workflow: InventoryWorkflow, itemId?: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('workflow', workflow);
    if (itemId) url.searchParams.set('item', itemId);
    else url.searchParams.delete('item');
    window.history.pushState({ inventoryWorkflow: workflow }, '', url);
    setActiveWorkflow(workflow);
  };

  const closeWorkflow = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('workflow');
    url.searchParams.delete('item');
    window.history.replaceState({}, '', url);
    setActiveWorkflow(null);
  };

  const cancelWorkflow = () => {
    closeWorkflow();
    resetForms();
  };

  useEffect(() => {
    const syncWorkflowFromUrl = () => {
      const value = new URLSearchParams(window.location.search).get('workflow');
      const allowed: InventoryWorkflow[] = ['product', 'service', 'details', 'transfer', 'import', 'report'];
      setActiveWorkflow(allowed.includes(value as InventoryWorkflow) ? value as InventoryWorkflow : null);
    };
    syncWorkflowFromUrl();
    window.addEventListener('popstate', syncWorkflowFromUrl);
    return () => window.removeEventListener('popstate', syncWorkflowFromUrl);
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingAnalytics, setIsFetchingAnalytics] = useState(false);
  
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [previewReport, setPreviewReport] = useState<any>(null);
  const [productAnalytics, setProductAnalytics] = useState<{
    lastSoldAt: number | null;
    totalSold: number;
    totalRevenue: number;
  } | null>(null);

  // SKU Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stockLevel, setStockLevel] = useState('');
  const [minStock, setMinStock] = useState('');
  const [barcode, setBarcode] = useState('');
  const [unit, setUnit] = useState<BusinessUnit>('STORE');
  const [imageUrl, setImageUrl] = useState('');

  // Service Form State
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceCat, setServiceCategory] = useState('Detailing');
  const [serviceCommission, setServiceCommission] = useState('30');
  const [serviceCommissionNight, setServiceCommissionNight] = useState('30');
  const [serviceImageUrl, setServiceImageUrl] = useState('');

  // Bulk Import State
  const [csvData, setCsvData] = useState('');

  // Stock Transfer State
  const [transferItemId, setTransferItemId] = useState<string>('');
  const [transferTargetUnit, setTransferTargetUnit] = useState<BusinessUnit>('LOUNGE');
  const [transferQuantity, setTransferQuantity] = useState<string>('1');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('uax_inventory_unit', activeUnitTab);
      localStorage.setItem('uax_inventory_status', stockStatusFilter);
    }
  }, [activeUnitTab, stockStatusFilter, mounted]);

  const inventoryQuery = useMemoFirebase(() => {
    if (!firestore || !profile) return null;
    return query(collection(firestore, 'inventory'), orderBy('name', 'asc'));
  }, [firestore, profile?.uid]);

  const { data: inventory, loading: inventoryLoading, error: inventoryError } = useCollection<Product>(inventoryQuery);

  // Product sales analytics are subscribed only while a product detail sheet is open.
  // This keeps the totals live and avoids a one-time getDocs snapshot.
  const productOrdersQuery = useMemoFirebase(() => {
    if (!firestore || activeWorkflow !== 'details' || !editingItem?.id) return null;
    return query(
      collection(firestore, 'orders'),
      where('status', '==', 'PAID')
    );
  }, [firestore, activeWorkflow, editingItem?.id]);
  const { data: productOrders, loading: productOrdersLoading } = useCollection<Order>(productOrdersQuery);

  useEffect(() => {
    if (activeWorkflow !== 'details' || !editingItem?.id) {
      setProductAnalytics(null);
      setIsFetchingAnalytics(false);
      return;
    }
    if (productOrdersLoading || productOrders === null) {
      setIsFetchingAnalytics(true);
      return;
    }

    let lastSoldAt: number | null = null;
    let totalSold = 0;
    let totalRevenue = 0;
    productOrders.forEach(order => {
      const matches = order.items?.filter(item => item.productId === editingItem.id) || [];
      if (matches.length > 0) {
        if (lastSoldAt === null || order.timestamp > lastSoldAt) lastSoldAt = order.timestamp;
        matches.forEach(item => {
          totalSold += item.quantity;
          totalRevenue += item.price * item.quantity;
        });
      }
    });
    setProductAnalytics({ lastSoldAt, totalSold, totalRevenue });
    setIsFetchingAnalytics(false);
  }, [activeWorkflow, editingItem?.id, productOrders, productOrdersLoading]);

  useEffect(() => {
    if (!inventory?.length) return;
    const itemId = new URLSearchParams(window.location.search).get('item');
    if (!itemId || editingItem?.id === itemId) return;
    const item = inventory.find(record => record.id === itemId);
    if (!item) return;
    setEditingItem(item);
    if (item.unit === 'CARWASH') {
      setServiceName(item.name);
      setServicePrice(String(item.price));
      setServiceCategory(item.category);
      setServiceCommission(String(item.commission ?? 30));
      setServiceCommissionNight(String(item.commissionNightShift ?? 30));
      setServiceImageUrl(item.image || '');
    } else {
      setName(item.name);
      setCategory(item.category);
      setPrice(String(item.price));
      setCostPrice(String(item.costPrice ?? ''));
      setStockLevel(String(item.stockLevel));
      setMinStock(String(item.minStock));
      setBarcode(item.barcode || '');
      setUnit(item.unit);
      setImageUrl(item.image || '');
    }
  }, [inventory, editingItem?.id]);

  const handleQuickStockAdjust = async (item: Product, delta: number) => {
    if (!firestore || !profile) return;
    if (!isSuperAdmin) {
      toast({
        variant: "destructive",
        title: "Stock adjustment requires approval",
        description: "Submit this change through the Urban Address Telegram bot using /request_stock_adjustment " + item.id + " " + (delta > 0 ? "+" : "") + delta + " REASON.",
      });
      return;
    }
    const newStock = Math.max(0, (item.stockLevel || 0) + delta);
    try {
      await updateDoc(doc(firestore, 'inventory', item.id!), { stockLevel: newStock, updatedAt: Date.now() });
      await notifyTelegramClientEvent(getAuth().currentUser, { type: 'STOCK_ADJUSTMENT', item: item.name, before: item.stockLevel || 0, after: newStock, minimum: item.minStock || 0, unit: item.unit });
      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'STOCK_ADJUSTMENT',
        userId: profile.uid,
        details: `Adjusted stock for ${item.name} (${delta > 0 ? '+' : ''}${delta}): ${item.stockLevel} -> ${newStock}`,
        timestamp: Date.now(),
        severity: 'INFO'
      });
      toast({ title: "Stock Updated", description: `${item.name}: ${newStock} units` });
    } catch (err) {
      toast({ variant: "destructive", title: "Stock update failed" });
    }
  };

  const handleToggleArchive = async (item: Product) => {
    if (!firestore || !profile) return;
    const newArchived = !item.archived;
    try {
      await updateDoc(doc(firestore, 'inventory', item.id!), { 
        archived: newArchived, 
        updatedAt: Date.now() 
      });
      await addDoc(collection(firestore, 'audit_logs'), {
        action: newArchived ? 'ARCHIVE_ITEM' : 'RESTORE_ITEM',
        userId: profile.uid,
        details: `${newArchived ? 'Archived' : 'Restored'} ${item.name} in ${item.unit}`,
        timestamp: Date.now(),
        severity: 'WARNING'
      });
      toast({ 
        title: newArchived ? "Item Archived" : "Item Restored", 
        description: `${item.name} is now ${newArchived ? 'hidden from POS catalog' : 'active'}` 
      });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to update item state" });
    }
  };

  const handleBulkImport = async () => {
    if (!firestore || !profile || !csvData.trim()) return;
    setIsSubmitting(true);
    try {
      const lines = csvData.trim().split('\n');
      const header = lines[0].toLowerCase().split(',').map(h => h.trim());
      
      let count = 0;
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const row = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        const rowData: any = {};
        header.forEach((h, idx) => { rowData[h] = row[idx]; });
        
        if (!rowData.name) continue;

        await addDoc(collection(firestore, 'inventory'), {
          name: rowData.name,
          category: rowData.category || 'Other',
          price: Number(rowData.price) || 0,
          costPrice: Number(rowData.costprice || rowData.cost) || 0,
          stockLevel: Number(rowData.stocklevel || rowData.stock) || 0,
          minStock: Number(rowData.minstock || rowData.min) || 5,
          barcode: rowData.barcode || null,
          unit: (rowData.unit?.toUpperCase() as BusinessUnit) || activeUnitTab,
          archived: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        count++;
      }

      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'BULK_STOCK_IMPORT',
        userId: profile.uid,
        details: `Bulk imported ${count} inventory records into ${activeUnitTab}`,
        timestamp: Date.now(),
        severity: 'INFO'
      });

      toast({ title: "Bulk Import Complete", description: `Added ${count} items to inventory catalog.` });
      closeWorkflow();
      setCsvData('');
    } catch (err: any) {
      toast({ variant: "destructive", title: "Import Failed", description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    if (!filteredInventory || filteredInventory.length === 0) {
      toast({ title: "No Data", description: "No items match current filters to export." });
      return;
    }

    const headers = ['ID', 'Name', 'Category', 'Unit', 'Barcode', 'Sale Price (KES)', 'Cost Price (KES)', 'Stock Level', 'Min Stock Alert', 'Stock Value (KES)', 'Status'];
    const rows = filteredInventory.map(item => {
      const isLow = item.unit !== 'CARWASH' && (item.stockLevel || 0) <= (item.minStock || 0);
      const isOut = item.unit !== 'CARWASH' && (item.stockLevel || 0) === 0;
      const statusStr = item.archived ? 'ARCHIVED' : (item.unit === 'CARWASH' ? 'SERVICE' : (isOut ? 'OUT OF STOCK' : (isLow ? 'LOW STOCK' : 'IN STOCK')));
      const itemVal = item.unit === 'CARWASH' ? 0 : (item.price * (item.stockLevel || 0));

      return [
        `"${item.id || ''}"`,
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.category}"`,
        `"${item.unit}"`,
        `"${item.barcode || ''}"`,
        item.price || 0,
        item.costPrice || 0,
        item.unit === 'CARWASH' ? 'UNLIMITED' : (item.stockLevel || 0),
        item.minStock || 0,
        itemVal,
        `"${statusStr}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Inventory_${activeUnitTab}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    if (link.parentNode) document.body.removeChild(link);
    toast({ title: "Export Complete", description: `Exported ${filteredInventory.length} inventory records.` });
  };

  const handleExecuteTransfer = async () => {
    if (!firestore || !profile || !transferItemId || !inventory) return;
    const qty = parseInt(transferQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast({ variant: "destructive", title: "Invalid Quantity", description: "Enter a positive transfer amount." });
      return;
    }

    const sourceItem = inventory.find(i => i.id === transferItemId);
    if (!sourceItem || !sourceItem.id) return;

    if ((sourceItem.stockLevel || 0) < qty) {
      toast({ variant: "destructive", title: "Insufficient Stock", description: `Only ${sourceItem.stockLevel} units available in ${sourceItem.unit}.` });
      return;
    }

    setIsSubmitting(true);
    try {
      const sourceRef = doc(firestore, 'inventory', sourceItem.id);
      const newSourceStock = sourceItem.stockLevel - qty;
      await updateDoc(sourceRef, { stockLevel: newSourceStock, updatedAt: Date.now() });

      const targetExisting = inventory.find(i => 
        i.unit === transferTargetUnit && 
        ((sourceItem.barcode && i.barcode === sourceItem.barcode) || i.name.toLowerCase() === sourceItem.name.toLowerCase())
      );

      if (targetExisting && targetExisting.id) {
        const targetRef = doc(firestore, 'inventory', targetExisting.id);
        await updateDoc(targetRef, {
          stockLevel: (targetExisting.stockLevel || 0) + qty,
          updatedAt: Date.now()
        });
      } else {
        await addDoc(collection(firestore, 'inventory'), {
          name: sourceItem.name,
          category: sourceItem.category,
          price: sourceItem.price,
          costPrice: sourceItem.costPrice || 0,
          stockLevel: qty,
          minStock: sourceItem.minStock || 5,
          barcode: sourceItem.barcode || null,
          unit: transferTargetUnit,
          image: sourceItem.image || null,
          archived: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }

      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'STOCK_TRANSFER',
        userId: profile.uid,
        details: `Transferred ${qty}x ${sourceItem.name} from ${sourceItem.unit} to ${transferTargetUnit}`,
        timestamp: Date.now(),
        severity: 'INFO'
      });

      toast({ 
        title: "Transfer Complete", 
        description: `Moved ${qty} units of ${sourceItem.name} to ${transferTargetUnit}.` 
      });

      closeWorkflow();
      setTransferItemId('');
      setTransferQuantity('1');
    } catch (err: any) {
      toast({ variant: "destructive", title: "Transfer Failed", description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInventory = useMemo(() => {
    if (!inventory) return [];
    
    return inventory.filter(item => {
      const matchesUnit = item.unit === activeUnitTab;

      if (stockStatusFilter === 'ARCHIVED') {
        if (!item.archived || !matchesUnit) return false;
      } else {
        if (item.archived) return false;
      }

      const matchesCategory = selectedCategoryFilter === 'All' || item.category === selectedCategoryFilter;
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.barcode && item.barcode.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchesStatus = true;
      if (stockStatusFilter === 'IN_STOCK') {
        matchesStatus = item.unit === 'CARWASH' || (item.stockLevel || 0) > (item.minStock || 0);
      } else if (stockStatusFilter === 'LOW') {
        matchesStatus = item.unit !== 'CARWASH' && (item.stockLevel || 0) <= (item.minStock || 0) && (item.stockLevel || 0) > 0;
      } else if (stockStatusFilter === 'OUT') {
        matchesStatus = item.unit !== 'CARWASH' && (item.stockLevel || 0) === 0;
      }

      return matchesUnit && matchesCategory && matchesSearch && matchesStatus;
    }).sort((a, b) => {
      switch (sortBy) {
        case 'name_asc': return a.name.localeCompare(b.name);
        case 'name_desc': return b.name.localeCompare(a.name);
        case 'price_desc': return b.price - a.price;
        case 'price_asc': return a.price - b.price;
        case 'stock_desc': return (b.stockLevel || 0) - (a.stockLevel || 0);
        case 'stock_asc': return (a.stockLevel || 0) - (b.stockLevel || 0);
        case 'value_desc': return (b.price * (b.stockLevel || 0)) - (a.price * (a.stockLevel || 0));
        default: return 0;
      }
    });
  }, [inventory, searchTerm, activeUnitTab, selectedCategoryFilter, stockStatusFilter, sortBy]);

  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
  const paginatedInventory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInventory.slice(start, start + itemsPerPage);
  }, [filteredInventory, currentPage]);

  const stats = useMemo(() => {
    if (!inventory) return { 
      total: 0, lowStock: 0, outOfStock: 0, archivedCount: 0,
      totalValue: 0, totalCost: 0, estProfit: 0, lowStockItems: [],
      outOfStockItems: [], categoryValues: {} as Record<string, number>
    };

    const unitInventory = inventory.filter(i => i.unit === activeUnitTab);
    const activeItems = unitInventory.filter(i => !i.archived);
    const archivedItems = unitInventory.filter(i => i.archived);
    
    const lowStockItems = activeItems.filter(i => i.unit !== 'CARWASH' && (i.stockLevel || 0) <= (i.minStock || 0) && (i.stockLevel || 0) > 0);
    const outOfStockItems = activeItems.filter(i => i.unit !== 'CARWASH' && (i.stockLevel || 0) === 0);

    let totalValue = 0;
    let totalCost = 0;
    const categoryValues: Record<string, number> = {};

    activeItems.forEach(item => {
      if (item.unit !== 'CARWASH') {
        const itemVal = (item.price || 0) * (item.stockLevel || 0);
        const itemCost = (item.costPrice || 0) * (item.stockLevel || 0);
        totalValue += itemVal;
        totalCost += itemCost;
        categoryValues[item.category] = (categoryValues[item.category] || 0) + itemVal;
      }
    });

    return {
      total: activeItems.length, lowStock: lowStockItems.length, outOfStock: outOfStockItems.length,
      archivedCount: archivedItems.length, totalValue, totalCost, estProfit: totalValue - totalCost,
      lowStockItems, outOfStockItems, categoryValues
    };
  }, [inventory, activeUnitTab]);

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !profile) return;
    
    setIsSubmitting(true);
    toast({ title: "Saving product", description: `Updating the inventory record for ${name}.` });
    
    const productData = { 
      name, 
      category, 
      price: Number(price), 
      costPrice: Number(costPrice) || 0,
      stockLevel: Number(stockLevel), 
      minStock: Number(minStock), 
      barcode: barcode || null, 
      unit: unit || activeUnitTab, 
      image: imageUrl || null, 
      updatedAt: Date.now() 
    };

    try {
      if (editingItem) { 
        await updateDoc(doc(firestore, 'inventory', editingItem.id!), productData); 
        toast({ title: "Handshake Complete", description: "Product SKU synchronized successfully." });
      } else { 
        await addDoc(collection(firestore, 'inventory'), { ...productData, archived: false, createdAt: Date.now() }); 
        toast({ title: "Handshake Complete", description: "New SKU added to master ledger." });
      }
      closeWorkflow();
      resetForms();
    } catch (err) { 
      toast({ variant: "destructive", title: "Product save failed", description: "Your form is still open. Please retry." }); 
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !profile) return;
    
    setIsSubmitting(true);
    toast({ title: "Saving service", description: `Updating detailing service: ${serviceName}` });

    const serviceData = { 
      name: serviceName, 
      category: serviceCat, 
      price: Number(servicePrice), 
      commission: Number(serviceCommission), 
      commissionNightShift: Number(serviceCommissionNight),
      stockLevel: 999999, 
      minStock: 0, 
      unit: 'CARWASH' as const, 
      image: serviceImageUrl || null, 
      updatedAt: Date.now() 
    };
    try {
      if (editingItem) { 
        await updateDoc(doc(firestore, 'inventory', editingItem.id!), serviceData); 
        toast({ title: "Node Updated", description: "Service configuration synchronized." }); 
      } else { 
        await addDoc(collection(firestore, 'inventory'), { ...serviceData, archived: false, createdAt: Date.now() }); 
        toast({ title: "Node Active", description: "New detailing service added." }); 
      }
      closeWorkflow();
      resetForms();
    } catch (err) { toast({ variant: "destructive", title: "Service save failed", description: "Your form is still open. Please retry." }); }
    finally { setIsSubmitting(false); }
  };

  const handlePrintLowStock = () => {
    if (stats.lowStockItems.length === 0) {
      toast({ title: "No Items Detected", description: "All active items are above reorder thresholds." });
      return;
    }
    const reportData = {
      type: 'SYSTEM-REPORT',
      reportType: 'LOW-STOCK-REPORT',
      displayTitle: 'LOW STOCK AUDIT',
      total: stats.lowStockItems.length,
      timestamp: Date.now(),
      items: stats.lowStockItems.map(i => ({ 
        name: i.name, 
        quantity: i.stockLevel, 
        price: i.minStock 
      }))
    };
    setPreviewReport(reportData);
    openWorkflow('report');
  };

  const handlePrintOutOfStock = () => {
    if (stats.outOfStockItems.length === 0) {
      toast({ title: "Inventory Full", description: "No items are currently out of stock." });
      return;
    }
    const reportData = {
      type: 'SYSTEM-REPORT',
      reportType: 'INVENTORY-REPORT',
      displayTitle: 'ZERO BALANCE AUDIT',
      total: stats.outOfStockItems.length,
      timestamp: Date.now(),
      items: stats.outOfStockItems.map(i => ({ 
        name: i.name, 
        quantity: 0, 
        price: i.price 
      }))
    };
    setPreviewReport(reportData);
    openWorkflow('report');
  };

  const openEdit = (item: Product) => {
    setEditingItem(item);
    if (item.unit === 'CARWASH') {
      setServiceName(item.name);
      setServicePrice(item.price.toString());
      setServiceCategory(item.category);
      setServiceCommission(item.commission?.toString() || '30');
      setServiceCommissionNight(item.commissionNightShift?.toString() || '30');
      setServiceImageUrl(item.image || '');
      openWorkflow('service', item.id);
    } else {
      setName(item.name);
      setCategory(item.category);
      setPrice(item.price.toString());
      setCostPrice(item.costPrice?.toString() || '');
      setStockLevel(item.stockLevel.toString());
      setMinStock(item.minStock.toString());
      setBarcode(item.barcode || '');
      setUnit(item.unit);
      setImageUrl(item.image || '');
      openWorkflow('product', item.id);
    }
  };

  const openDetails = (item: Product) => {
    setEditingItem(item);
    setProductAnalytics(null);
    openWorkflow('details', item.id);
  };

  const resetForms = () => { 
    setEditingItem(null); setName(''); setCategory(''); setPrice(''); setCostPrice('');
    setStockLevel(''); setMinStock(''); setBarcode(''); setUnit('STORE'); setImageUrl(''); 
    setServiceName(''); setServicePrice(''); setServiceCommission('30'); setServiceCommissionNight('30');
    setServiceImageUrl(''); setProductAnalytics(null);
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.length === paginatedInventory.length) setSelectedItemIds([]);
    else setSelectedItemIds(paginatedInventory.map(i => i.id!).filter(Boolean));
  };

  if (!mounted) return null;

  if (!activeWorkflow) {
    return (
    <div className="space-y-4 md:space-y-6 pb-12 max-w-[1600px] mx-auto px-1 md:px-0 ua-compact-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2 pt-2">
        <div>
          <PageHeader title="Inventory" breadcrumb={["Operations", "Inventory"]} className="mb-0" />
          <p className="text-zinc-500 mt-1 uppercase text-[10px] font-bold tracking-widest">Stock and Service Management</p>
        </div>
      </div>

      <Tabs value={activeUnitTab} onValueChange={(v: any) => { setActiveUnitTab(v); setSelectedCategoryFilter('All'); setSelectedItemIds([]); setCurrentPage(1); }} className="w-full px-2">
        <TabsList className="bg-white p-1.5 rounded-[1.5rem] h-16 mb-4 md:mb-8 shadow-sm border border-zinc-100 flex w-full overflow-x-auto no-scrollbar">
           <TabsTrigger value="STORE" className="flex-1 rounded-xl h-full uppercase font-black text-[10px] tracking-widest gap-2 md:gap-3 data-[state=active]:bg-zinc-900 data-[state=active]:text-white transition-all whitespace-nowrap">
             <ShoppingBag className="w-3.5 h-3.5 md:w-4 md:h-4" /> Retail Shop
           </TabsTrigger>
           <TabsTrigger value="LOUNGE" className="flex-1 rounded-xl h-full uppercase font-black text-[10px] tracking-widest gap-2 md:gap-3 data-[state=active]:bg-amber-600 data-[state=active]:text-white transition-all whitespace-nowrap">
             <Wine className="w-3.5 h-3.5 md:w-4 md:h-4" /> Lounge
           </TabsTrigger>
           <TabsTrigger value="CARWASH" className="flex-1 rounded-xl h-full uppercase font-black text-[10px] tracking-widest gap-2 md:gap-3 data-[state=active]:bg-primary data-[state=active]:text-white transition-all whitespace-nowrap">
             <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" /> Services
           </TabsTrigger>
        </TabsList>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8 ua-metric-strip">
           <MetricMiniCard title="Total Items" value={stats.total.toString()} sub={`${stats.archivedCount} Archived`} icon={Boxes} />
           <MetricMiniCard title="Stock Value" value={`KES ${stats.totalValue.toLocaleString()}`} sub="Retail Valuation" icon={DollarSign} color="text-emerald-600" />
           <MetricMiniCard title="Margin %" value={stats.totalValue > 0 ? `${Math.round((stats.estProfit / stats.totalValue) * 100)}%` : '0%'} sub={`Cost: KES ${stats.totalCost.toLocaleString()}`} icon={TrendingUp} />
           <MetricMiniCard 
             title="Low Stock" 
             value={stats.lowStock.toString()} 
             sub="Reorder Alert" 
             icon={AlertTriangle} 
             color={stats.lowStock > 0 ? "text-amber-500" : "text-green-500"} 
             onClick={handlePrintLowStock} 
           />
           <MetricMiniCard 
             title="Out of Stock" 
             value={stats.outOfStock.toString()} 
             sub="Zero Balance" 
             icon={PackageX} 
             color={stats.outOfStock > 0 ? "text-red-500" : "text-green-500"} 
             onClick={handlePrintOutOfStock} 
           />
        </div>

        <div className="ua-inventory-toolbar flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-[2rem] shadow-sm border border-zinc-100 mb-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 flex-1">
             <div className="relative w-full sm:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input placeholder={`Search ${activeUnitTab.toLowerCase()}...`} value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="pl-12 h-12 md:h-14 bg-zinc-50 border-none rounded-2xl font-bold w-full" />
             </div>

             <div className="flex gap-2 w-full sm:w-auto">
                <Select value={stockStatusFilter} onValueChange={(v: any) => { setStockStatusFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-12 md:h-14 bg-zinc-50 border-none rounded-2xl px-5 text-[9px] md:text-[10px] font-black uppercase flex-1 sm:w-44">
                    <div className="flex items-center gap-2"><Filter className="w-3.5 h-3.5 text-zinc-400" /><SelectValue /></div>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    <SelectItem value="ALL" className="text-[10px] font-black uppercase">All Statuses</SelectItem>
                    <SelectItem value="IN_STOCK" className="text-[10px] font-black uppercase text-green-600">In Stock</SelectItem>
                    <SelectItem value="LOW" className="text-[10px] font-black uppercase text-amber-600">Low Stock</SelectItem>
                    <SelectItem value="OUT" className="text-[10px] font-black uppercase text-red-600">Out of Stock</SelectItem>
                    <SelectItem value="ARCHIVED" className="text-[10px] font-black uppercase text-zinc-400">Archived</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(v: any) => { setSortBy(v); setCurrentPage(1); }}>
                  <SelectTrigger className="h-12 md:h-14 bg-zinc-50 border-none rounded-2xl px-5 text-[9px] md:text-[10px] font-black uppercase flex-1 sm:w-48">
                    <div className="flex items-center gap-2"><ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" /><SelectValue /></div>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl">
                    <SelectItem value="name_asc" className="text-[10px] font-black uppercase">Name (A-Z)</SelectItem>
                    <SelectItem value="price_desc" className="text-[10px] font-black uppercase">Price (High-Low)</SelectItem>
                    <SelectItem value="stock_desc" className="text-[10px] font-black uppercase">Stock (High-Low)</SelectItem>
                  </SelectContent>
                </Select>
             </div>
          </div>

          <div className="ua-inventory-actions flex flex-wrap items-center gap-2">
            {activeUnitTab !== 'CARWASH' && (
              <Button variant="outline" onClick={() => openWorkflow('transfer')} className="h-12 md:h-14 px-4 rounded-2xl border-zinc-100 text-[9px] font-black uppercase tracking-widest gap-2 bg-white flex-1 sm:flex-none">
                 <ArrowLeftRight className="w-4 h-4 text-blue-600" /> <span className="hidden sm:inline">Transfer</span>
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-12 md:h-14 px-4 rounded-2xl border-zinc-100 text-[9px] font-black uppercase tracking-widest gap-2 bg-white flex-1 sm:flex-none">
                  <Printer className="w-4 h-4 text-primary" /> <span className="hidden sm:inline">Print Stock Reports</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl border-none shadow-2xl p-2">
                 <DropdownMenuItem onClick={handlePrintLowStock} className="rounded-xl gap-3 py-3 cursor-pointer">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-[10px] font-black uppercase">Low Stock Report</span>
                 </DropdownMenuItem>
                 <DropdownMenuItem onClick={handlePrintOutOfStock} className="rounded-xl gap-3 py-3 cursor-pointer">
                    <PackageX className="w-4 h-4 text-red-500" />
                    <span className="text-[10px] font-black uppercase">Out of Stock Report</span>
                 </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" onClick={handleExportCSV} className="h-12 md:h-14 px-4 rounded-2xl border-zinc-100 text-[9px] font-black uppercase tracking-widest gap-2 bg-white flex-1 sm:flex-none">
               <FileDown className="w-4 h-4 text-emerald-600" /> <span className="hidden sm:inline">Export</span>
            </Button>
            <Button variant="outline" onClick={() => openWorkflow('import')} className="h-12 md:h-14 px-4 rounded-2xl border-zinc-100 text-[9px] font-black uppercase tracking-widest gap-2 bg-white flex-1 sm:flex-none">
               <Upload className="w-4 h-4 text-emerald-600" /> <span className="hidden sm:inline">Import</span>
            </Button>
            <Button onClick={() => { resetForms(); activeUnitTab === 'CARWASH' ? openWorkflow('service') : (setUnit(activeUnitTab), openWorkflow('product')); }} className="h-12 md:h-14 px-6 bg-zinc-900 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl gap-2 flex-1 sm:flex-none">
              <Plus className="w-4 h-4" /> Add {activeUnitTab === 'CARWASH' ? 'Service' : 'Item'}
            </Button>
          </div>
        </div>

        <Card className="ua-inventory-table border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white border border-zinc-100">
          <CardContent className="p-0 overflow-x-auto no-scrollbar">
            <Table className="min-w-[800px]">
              <TableHeader className="bg-zinc-50/50">
                <TableRow className="hover:bg-transparent border-zinc-100">
                  <TableHead className="pl-6 w-12 h-16">
                    <button onClick={toggleSelectAll} className="p-1 text-zinc-400">
                      {selectedItemIds.length > 0 && selectedItemIds.length === paginatedInventory.length ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                    </button>
                  </TableHead>
                  <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400">Description</TableHead>
                  <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400">Class</TableHead>
                  <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-right text-zinc-400">Price</TableHead>
                  <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-right text-zinc-400">Stock</TableHead>
                  <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-right text-zinc-400">Valuation</TableHead>
                  <TableHead className="pr-8 h-16 text-[10px] uppercase font-black tracking-widest text-right text-zinc-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryLoading || inventory === null ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-40 text-center">
                      <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 text-zinc-400">
                        <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-primary" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Loading inventory records…</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : inventoryError ? (
                  <TableRow><TableCell colSpan={7} className="h-32 text-center text-xs font-semibold text-red-600">Inventory could not be loaded. Check the database connection and reload.</TableCell></TableRow>
                ) : paginatedInventory.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-32 text-center text-xs font-semibold text-zinc-400">No inventory items match this view.</TableCell></TableRow>
                ) : paginatedInventory.map((item) => {
                  const isSelected = selectedItemIds.includes(item.id!);
                  const isLow = item.unit !== 'CARWASH' && (item.stockLevel || 0) <= (item.minStock || 0) && (item.stockLevel || 0) > 0;
                  const isOut = item.unit !== 'CARWASH' && (item.stockLevel || 0) === 0;

                  return (
                    <TableRow key={item.id} className={cn("border-zinc-50 transition-colors", isSelected && "bg-orange-50/40", item.archived && "opacity-60")}>
                      <TableCell className="pl-6 py-5">
                        <button onClick={() => toggleSelectItem(item.id!)} className="p-1 text-zinc-300 hover:text-primary">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                        </button>
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-[1rem] flex items-center justify-center border border-zinc-100 bg-zinc-50 overflow-hidden shrink-0 shadow-inner">
                            {item.image ? <img src={item.image} className="w-full h-full object-cover" alt="" /> : <Package className="w-5 h-5 text-zinc-200" />}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs md:text-sm font-black text-zinc-900 uppercase block truncate max-w-[200px]">{item.name}</span>
                            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{item.barcode || 'NO CODE'}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[7px] md:text-[8px] font-black uppercase border-zinc-200 px-2">{item.category}</Badge></TableCell>
                      <TableCell className="text-right"><span className="text-xs md:text-sm font-black text-zinc-900">KES {item.price.toLocaleString()}</span></TableCell>
                      <TableCell className="text-right">
                         <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.unit !== 'CARWASH' && (
                                <button onClick={() => handleQuickStockAdjust(item, -1)} className="w-6 h-6 rounded-md bg-zinc-100 text-zinc-500 flex items-center justify-center hover:bg-zinc-200"><Minus className="w-3 h-3" /></button>
                              )}
                              <span className={cn("text-xs md:text-sm font-black min-w-[24px] text-center", isOut ? "text-red-500" : isLow ? "text-amber-500" : "text-zinc-900")}>
                                {item.unit === 'CARWASH' ? 'INF' : item.stockLevel}
                              </span>
                              {item.unit !== 'CARWASH' && (
                                <button onClick={() => handleQuickStockAdjust(item, 1)} className="w-6 h-6 rounded-md bg-zinc-100 text-zinc-500 flex items-center justify-center hover:bg-zinc-200"><Plus className="w-3 h-3" /></button>
                              )}
                            </div>
                            {isOut && <Badge className="bg-red-500 text-white border-none text-[6px] font-black uppercase px-1 h-3 animate-pulse">Out of Stock</Badge>}
                         </div>
                      </TableCell>
                      <TableCell className="text-right font-black text-zinc-500 text-xs">KES {(item.price * (item.unit === 'CARWASH' ? 0 : item.stockLevel)).toLocaleString()}</TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex items-center justify-end gap-1">
                          <Button onClick={() => openDetails(item)} variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-primary"><Info className="w-4 h-4" /></Button>
                          <Button onClick={() => openEdit(item)} variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900"><Edit2 className="w-4 h-4" /></Button>
                          <Button onClick={() => handleToggleArchive(item)} variant="ghost" size="icon" className={cn("h-8 w-8", item.archived ? "text-emerald-500" : "text-zinc-200")}><Archive className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-8 py-4 bg-white border-t border-zinc-50">
                 <p className="text-[10px] font-black uppercase text-zinc-400">Page {currentPage} of {totalPages}</p>
                 <div className="flex gap-2">
                   <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="h-9 px-4 rounded-lg text-[9px] font-black uppercase tracking-widest"><ChevronLeft className="w-4 h-4 mr-1" /> Prev</Button>
                   <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="h-9 px-4 rounded-lg text-[9px] font-black uppercase tracking-widest">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
                 </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Tabs>

      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-white text-zinc-900">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="outline" onClick={cancelWorkflow} className="h-11 w-11 shrink-0 rounded-xl p-0" aria-label="Back to inventory">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">Inventory workspace</p>
            <h1 className="truncate text-lg font-black uppercase tracking-tight md:text-xl">
              {activeWorkflow === 'product' ? (editingItem ? 'Edit product' : 'Add product') :
               activeWorkflow === 'service' ? 'Service definition' :
               activeWorkflow === 'transfer' ? 'Stock transfer' :
               activeWorkflow === 'import' ? 'Bulk data import' :
               activeWorkflow === 'details' ? 'Product details' : 'Report preview'}
            </h1>
          </div>
        </div>
        <span className="hidden text-xs font-semibold text-zinc-400 md:block">Full-page workspace</span>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-5 pb-28 md:px-8 md:py-8">
        {activeWorkflow === 'product' && (
          <form onSubmit={handleSaveProduct} className="space-y-6">
            <section className="rounded-2xl border border-zinc-200 bg-white p-4 md:p-6">
              <div className="mb-5">
                <h2 className="text-base font-black uppercase">Product information</h2>
                <p className="mt-1 text-sm text-zinc-500">Add the item details and upload its product photograph.</p>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <ImageUpload onUploadComplete={setImageUrl} defaultValue={imageUrl} label="Product photography" category={activeUnitTab.toLowerCase()} />
                </div>
                <div className="space-y-2">
                  <Label>Product name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full product name" className="h-12" required />
                </div>
                <div className="space-y-2">
                  <Label>Retail category</Label>
                  <Select value={category} onValueChange={setCategory} required>
                    <SelectTrigger className="h-12"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Barcode / SKU</Label>
                  <Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Scan or enter code" className="h-12 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Business unit</Label>
                  <Select value={unit} onValueChange={(v: BusinessUnit) => setUnit(v)}>
                    <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STORE">Retail shop</SelectItem>
                      <SelectItem value="LOUNGE">Lounge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sale price (KES)</Label>
                  <Input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="h-12" required />
                </div>
                <div className="space-y-2">
                  <Label>Cost price (KES)</Label>
                  <Input type="number" min="0" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label>Opening stock</Label>
                  <Input type="number" min="0" value={stockLevel} onChange={e => setStockLevel(e.target.value)} className="h-12" required />
                </div>
                <div className="space-y-2">
                  <Label>Minimum stock threshold</Label>
                  <Input type="number" min="0" value={minStock} onChange={e => setMinStock(e.target.value)} className="h-12" required />
                </div>
              </div>
            </section>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={cancelWorkflow} className="h-12 sm:min-w-36">Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="h-12 bg-zinc-900 px-8 text-white sm:min-w-56">{isSubmitting ? 'Saving…' : editingItem ? 'Save product changes' : 'Create product'}</Button>
            </div>
          </form>
        )}

        {activeWorkflow === 'service' && (
          <form onSubmit={handleSaveService} className="space-y-6">
            <section className="rounded-2xl border border-zinc-200 p-4 md:p-6">
              <h2 className="mb-1 text-base font-black uppercase">Service configuration</h2>
              <p className="mb-5 text-sm text-zinc-500">Configure the service, price and commission settings.</p>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="md:col-span-2"><ImageUpload onUploadComplete={setServiceImageUrl} defaultValue={serviceImageUrl} label="Service illustration" category="carwash" /></div>
                <div className="space-y-2 md:col-span-2"><Label>Service name</Label><Input value={serviceName} onChange={e => setServiceName(e.target.value)} placeholder="e.g. Executive Interior Detailing" className="h-12" required /></div>
                <div className="space-y-2"><Label>Base price (KES)</Label><Input type="number" min="0" value={servicePrice} onChange={e => setServicePrice(e.target.value)} className="h-12" required /></div>
                <div className="space-y-2"><Label>Standard commission (%)</Label><Input type="number" min="0" max="100" value={serviceCommission} onChange={e => setServiceCommission(e.target.value)} className="h-12" required /></div>
                <div className="space-y-2"><Label>Night shift commission (%)</Label><Input type="number" min="0" max="100" value={serviceCommissionNight} onChange={e => setServiceCommissionNight(e.target.value)} className="h-12" required /></div>
              </div>
            </section>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={cancelWorkflow} className="h-12 sm:min-w-36">Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="h-12 bg-zinc-900 px-8 text-white sm:min-w-56">{isSubmitting ? 'Saving…' : 'Save service'}</Button>
            </div>
          </form>
        )}

        {activeWorkflow === 'transfer' && (
          <section className="space-y-6 rounded-2xl border border-zinc-200 p-4 md:p-6">
            <div><h2 className="text-base font-black uppercase">Move stock between units</h2><p className="mt-1 text-sm text-zinc-500">Select the source item, destination and quantity.</p></div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2"><Label>Product to transfer</Label><Select value={transferItemId} onValueChange={setTransferItemId}><SelectTrigger className="h-12"><SelectValue placeholder="Select product" /></SelectTrigger><SelectContent>{inventory?.filter(i => i.unit === activeUnitTab && i.stockLevel > 0).map(i => <SelectItem key={i.id} value={i.id!}>{i.name} ({i.stockLevel} available)</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Destination unit</Label><Select value={transferTargetUnit} onValueChange={(v: BusinessUnit) => setTransferTargetUnit(v)}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent>{(['STORE', 'LOUNGE'] as BusinessUnit[]).filter(u => u !== activeUnitTab).map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Quantity</Label><Input type="number" min="1" value={transferQuantity} onChange={e => setTransferQuantity(e.target.value)} className="h-12" /></div>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="outline" onClick={cancelWorkflow} className="h-12 sm:min-w-36">Cancel</Button><Button onClick={handleExecuteTransfer} disabled={isSubmitting || !transferItemId} className="h-12 bg-zinc-900 px-8 text-white sm:min-w-56">Execute transfer</Button></div>
          </section>
        )}

        {activeWorkflow === 'import' && (
          <section className="space-y-6 rounded-2xl border border-zinc-200 p-4 md:p-6">
            <div><h2 className="text-base font-black uppercase">Import inventory records</h2><p className="mt-1 text-sm text-zinc-500">Paste comma-separated values with a header row. Existing inventory records are not overwritten.</p></div>
            <div className="space-y-2"><Label>CSV data (Name, Category, Price, Stock)</Label><Textarea value={csvData} onChange={e => setCsvData(e.target.value)} placeholder="name,category,price,stockLevel,minStock,barcode" className="min-h-[280px] font-mono text-sm" /><p className="text-xs text-zinc-500">Include a header row. Supported fields: name, category, price, costPrice, stockLevel, minStock, barcode and unit.</p></div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="outline" onClick={cancelWorkflow} className="h-12 sm:min-w-36">Cancel</Button><Button onClick={handleBulkImport} disabled={isSubmitting || !csvData.trim()} className="h-12 bg-zinc-900 px-8 text-white sm:min-w-56">{isSubmitting ? 'Importing…' : 'Import records'}</Button></div>
          </section>
        )}

        {activeWorkflow === 'details' && editingItem && (
          <section className="space-y-6 rounded-2xl border border-zinc-200 p-4 md:p-6">
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                {editingItem.image ? <img src={editingItem.image} alt={editingItem.name} className="h-full w-full object-contain p-2" /> : <Package className="h-10 w-10 text-zinc-300" />}
              </div>
              <div className="min-w-0"><h2 className="text-xl font-black uppercase">{editingItem.name}</h2><p className="mt-1 text-sm text-zinc-500">{editingItem.category} · {editingItem.unit}</p><p className="mt-4 text-2xl font-black">KES {editingItem.price.toLocaleString()}</p><p className="mt-1 text-xs text-zinc-500">Barcode: {editingItem.barcode || 'Not set'}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-zinc-50 p-4"><p className="text-xs text-zinc-500">Stock on hand</p><p className="mt-1 text-xl font-black">{editingItem.unit === 'CARWASH' ? 'Unlimited' : editingItem.stockLevel}</p></div>
              <div className="rounded-xl bg-zinc-50 p-4"><p className="text-xs text-zinc-500">Minimum stock</p><p className="mt-1 text-xl font-black">{editingItem.minStock}</p></div>
              <div className="rounded-xl bg-zinc-50 p-4"><p className="text-xs text-zinc-500">Units sold</p><p className="mt-1 text-xl font-black">{isFetchingAnalytics ? '…' : productAnalytics?.totalSold ?? 0}</p></div>
              <div className="rounded-xl bg-zinc-50 p-4"><p className="text-xs text-zinc-500">Sales revenue</p><p className="mt-1 text-xl font-black">KES {(productAnalytics?.totalRevenue ?? 0).toLocaleString()}</p></div>
            </div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="outline" onClick={cancelWorkflow} className="h-12 sm:min-w-36">Back to inventory</Button><Button onClick={() => openEdit(editingItem)} className="h-12 bg-zinc-900 px-8 text-white sm:min-w-40">Edit item</Button></div>
          </section>
        )}

        {activeWorkflow === 'report' && (
          <div className="mx-auto w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-3 md:p-6">
            <ReceiptPreview data={previewReport} onClose={cancelWorkflow} className="w-full" />
          </div>
        )}
      </main>
    </div>
  );
}

function MetricMiniCard({ title, value, sub, icon: Icon, color = "text-zinc-900", onClick }: any) {
  return (
    <Card onClick={onClick} className={cn("border-none shadow-sm rounded-[2rem] bg-white p-5 md:p-6 border border-zinc-100 group hover:bg-zinc-50 transition-colors text-left", onClick && "cursor-pointer active:scale-[0.98]")}>
      <div className="flex items-center justify-between mb-3">
         <div className="flex items-center gap-3">
            <Icon className={cn("w-4 h-4 md:w-5 md:h-5", color)} />
            <p className="text-[9px] md:text-[10px] font-black text-zinc-400 uppercase tracking-widest">{title}</p>
         </div>
         {onClick && <ChevronRight className="w-3.5 h-3.5 text-zinc-200 group-hover:text-primary transition-all" />}
      </div>
      <h3 className="text-2xl md:text-3xl font-black font-headline tracking-tighter truncate">{value}</h3>
      <p className="text-[8px] md:text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1 truncate">{sub}</p>
    </Card>
  );
}
