'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Edit2,
  Loader2,
  Plus,
  Power,
  PowerOff,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  CAR_WASH_CATEGORIES,
  CarWashCategory,
  CarWashPricingType,
  CarWashService,
  CarWashServiceTier,
  formatKes,
  formatServicePrice,
} from '@/data/carWashServices';
import { validateCarWashServiceInput } from '@/lib/carwash-services';
import { useUser } from '@/lib/data';
import { useProfile } from '@/hooks/use-profile';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FormState {
  name: string;
  category: CarWashCategory;
  pricingType: CarWashPricingType;
  price: string;
  priceFrom: string;
  priceTo: string;
  tiers: Array<{ label: string; price: string }>;
  standardPrice: string;
  suvPrice: string;
  sortOrder: string;
  commission: string;
  note: string;
  isActive: boolean;
}

const INITIAL_FORM: FormState = {
  name: '',
  category: 'Wash',
  pricingType: 'fixed',
  price: '',
  priceFrom: '',
  priceTo: '',
  tiers: [
    { label: 'Option 1', price: '' },
    { label: 'Option 2', price: '' },
  ],
  standardPrice: '',
  suvPrice: '',
  sortOrder: '100',
  commission: '30',
  note: '',
  isActive: true,
};

export default function AdminCarWashServicesPage() {
  const { user } = useUser();
  const { role, isSuperAdmin, loading: profileLoading } = useProfile();

  const [services, setServices] = useState<CarWashService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<CarWashService | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = isSuperAdmin || String(role || '').toUpperCase() === 'ADMIN';

  const getAuthHeaders = useCallback(async () => {
    const token = typeof user?.getIdToken === 'function' ? await user.getIdToken() : '';
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [user]);

  const loadServices = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/carwash-services', { headers });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to load car wash services.');
      }
      setServices(Array.isArray(payload.services) ? payload.services : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services.');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, isAdmin]);

  useEffect(() => {
    if (!profileLoading && isAdmin) {
      loadServices();
    } else if (!profileLoading && !isAdmin) {
      setLoading(false);
    }
  }, [profileLoading, isAdmin, loadServices]);

  const filteredByCategory = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return CAR_WASH_CATEGORIES.map((category) => {
      const items = services
        .filter((s) => s.category === category)
        .filter((s) => {
          if (statusFilter === 'ACTIVE') return s.isActive;
          if (statusFilter === 'INACTIVE') return !s.isActive;
          return true;
        })
        .filter((s) => !query || s.name.toLowerCase().includes(query) || s.category.toLowerCase().includes(query))
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
      return { category, items };
    }).filter((group) => group.items.length > 0);
  }, [services, searchTerm, statusFilter]);

  const openAddDialog = () => {
    setEditingService(null);
    setForm({
      ...INITIAL_FORM,
      sortOrder: String((services.length + 1) * 10),
    });
    setFormErrors([]);
    setIsDialogOpen(true);
  };

  const openEditDialog = (service: CarWashService) => {
    setEditingService(service);
    setForm({
      name: service.name,
      category: service.category,
      pricingType: service.pricingType,
      price: service.price !== undefined ? String(service.price) : '',
      priceFrom: service.priceFrom !== undefined ? String(service.priceFrom) : '',
      priceTo: service.priceTo !== undefined ? String(service.priceTo) : '',
      tiers:
        service.tiers && service.tiers.length > 0
          ? service.tiers.map((t) => ({ label: t.label, price: String(t.price) }))
          : [
              { label: 'Option 1', price: '' },
              { label: 'Option 2', price: '' },
            ],
      standardPrice: service.vehicleSizePricing?.standard !== undefined ? String(service.vehicleSizePricing.standard) : '',
      suvPrice: service.vehicleSizePricing?.suv !== undefined ? String(service.vehicleSizePricing.suv) : '',
      sortOrder: String(service.sortOrder ?? 0),
      commission: String(service.commission ?? 30),
      note: service.note || '',
      isActive: service.isActive !== false,
    });
    setFormErrors([]);
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const tiersPayload: CarWashServiceTier[] | undefined =
      form.pricingType === 'tiers'
        ? form.tiers.map((t) => ({ label: t.label.trim(), price: Number(t.price) }))
        : undefined;

    const hasVehicleSizes = form.standardPrice.trim() !== '' || form.suvPrice.trim() !== '';
    const vehicleSizePricing = hasVehicleSizes
      ? {
          ...(form.standardPrice.trim() !== '' ? { standard: Number(form.standardPrice) } : {}),
          ...(form.suvPrice.trim() !== '' ? { suv: Number(form.suvPrice) } : {}),
        }
      : null;

    const payload = {
      name: form.name.trim(),
      category: form.category,
      pricingType: form.pricingType,
      price: form.pricingType === 'fixed' ? Number(form.price) : null,
      priceFrom: form.pricingType === 'range' ? Number(form.priceFrom) : null,
      priceTo: form.pricingType === 'range' ? Number(form.priceTo) : null,
      tiers: tiersPayload ?? null,
      vehicleSizePricing,
      sortOrder: Number(form.sortOrder || 0),
      commission: Number(form.commission || 30),
      note: form.note.trim() || null,
      isActive: form.isActive,
    };

    const validation = validateCarWashServiceInput(payload);
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }

    setFormErrors([]);
    setIsSaving(true);
    try {
      const headers = await getAuthHeaders();
      const url = editingService
        ? `/api/admin/carwash-services/${encodeURIComponent(editingService.id)}`
        : '/api/admin/carwash-services';
      const method = editingService ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormErrors(Array.isArray(result.errors) ? result.errors : [result.error || 'Failed to save service.']);
        return;
      }

      toast({
        title: editingService ? 'Service updated' : 'Service added',
        description: `${payload.name} is now synced across the catalog and Carwash POS.`,
      });
      setIsDialogOpen(false);
      await loadServices();
    } catch (err) {
      setFormErrors([err instanceof Error ? err.message : 'Network error while saving.']);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (service: CarWashService) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/carwash-services/${encodeURIComponent(service.id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isActive: !service.isActive }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.error || 'Failed to update status.');
      }
      toast({
        title: service.isActive ? 'Service deactivated' : 'Service reactivated',
        description: service.isActive
          ? `${service.name} is hidden from POS and public catalog while preserving past sales.`
          : `${service.name} is now active on POS and public catalog.`,
      });
      await loadServices();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Action failed',
        description: err instanceof Error ? err.message : 'Unable to update service status.',
      });
    }
  };

  const handleMove = async (categoryItems: CarWashService[], index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categoryItems.length) return;

    const current = categoryItems[index];
    const swapWith = categoryItems[targetIndex];
    const reorder = [
      { id: current.id, sortOrder: swapWith.sortOrder },
      { id: swapWith.id, sortOrder: current.sortOrder === swapWith.sortOrder ? current.sortOrder + direction : current.sortOrder },
    ];

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/admin/carwash-services', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ reorder }),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.error || 'Reorder failed.');
      }
      await loadServices();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Reorder failed',
        description: err instanceof Error ? err.message : 'Could not update sort order.',
      });
    }
  };

  const handleDelete = async (service: CarWashService) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/admin/carwash-services/${encodeURIComponent(service.id)}`, {
        method: 'DELETE',
        headers,
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(result.error || 'Failed to remove service.');
      }
      toast({
        title: result.deactivated ? 'Service deactivated' : 'Service deleted',
        description: result.message || `${service.name} removed.`,
      });
      await loadServices();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Unable to remove service.',
      });
    }
  };

  if (profileLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="mx-auto mt-10 max-w-lg border-red-100">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <ShieldAlert className="h-10 w-10 text-red-500" />
          <h2 className="text-lg font-black uppercase tracking-tight text-zinc-900">Admin Privileges Required</h2>
          <p className="text-sm text-zinc-500">
            Only administrators can manage car wash services and pricing.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-20 max-w-[1400px] mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Car Wash Services"
          breadcrumb={['Inventory & Service', 'Car Wash Services']}
          className="mb-0"
        />
        <Button onClick={openAddDialog} className="h-11 rounded-xl bg-primary px-5 font-black uppercase text-xs tracking-wider text-white">
          <Plus className="mr-2 h-4 w-4" />
          Add Service
        </Button>
      </div>

      <Card className="border-zinc-100">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search car wash services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 pl-10 bg-zinc-50 border-zinc-200"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((status) => (
              <Button
                key={status}
                type="button"
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'h-10 px-4 text-xs font-black uppercase tracking-wider',
                  statusFilter === status && 'bg-zinc-900 text-white'
                )}
              >
                {status}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : filteredByCategory.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500">
          No car wash services match the current filter.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredByCategory.map(({ category, items }) => (
            <Card key={category} className="border-zinc-100 overflow-hidden">
              <CardHeader className="border-b border-zinc-100 bg-zinc-50/70 py-3.5 px-5 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-black uppercase tracking-wider text-zinc-900">
                    {category}
                  </CardTitle>
                </div>
                <Badge variant="secondary" className="text-[10px] font-bold uppercase">
                  {items.length} {items.length === 1 ? 'service' : 'services'}
                </Badge>
              </CardHeader>
              <CardContent className="divide-y divide-zinc-100 p-0">
                {items.map((service, idx) => (
                  <div
                    key={service.id}
                    className={cn(
                      'flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between',
                      !service.isActive && 'bg-zinc-50/80 opacity-70'
                    )}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-zinc-900">{service.name}</span>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold">
                          {service.pricingType}
                        </Badge>
                        {!service.isActive && (
                          <Badge className="bg-zinc-200 text-zinc-700 text-[10px] uppercase font-bold border-none">
                            Inactive
                          </Badge>
                        )}
                        {service.vehicleSizePricing && (
                          <Badge className="bg-primary/10 text-primary text-[10px] font-bold border-none">
                            Std: {formatKes(service.vehicleSizePricing.standard ?? service.price ?? 0)} / SUV: {formatKes(service.vehicleSizePricing.suv ?? service.price ?? 0)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                        <span className="font-extrabold text-primary">{formatServicePrice(service)}</span>
                        {service.tiers && service.tiers.length > 0 && (
                          <span>
                            {service.tiers.map((t) => `${t.label}: ${formatKes(t.price)}`).join(' · ')}
                          </span>
                        )}
                        {service.note && <span className="italic">{service.note}</span>}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`Move ${service.name} up`}
                        disabled={idx === 0}
                        onClick={() => handleMove(items, idx, -1)}
                        className="h-9 w-9"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`Move ${service.name} down`}
                        disabled={idx === items.length - 1}
                        onClick={() => handleMove(items, idx, 1)}
                        className="h-9 w-9"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(service)}
                        className="h-9 px-3 text-xs font-bold"
                      >
                        <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(service)}
                        className={cn(
                          'h-9 px-3 text-xs font-bold',
                          service.isActive ? 'text-amber-700 border-amber-200' : 'text-emerald-700 border-emerald-200'
                        )}
                      >
                        {service.isActive ? (
                          <>
                            <PowerOff className="mr-1.5 h-3.5 w-3.5" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <Power className="mr-1.5 h-3.5 w-3.5" />
                            Reactivate
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${service.name}`}
                        onClick={() => handleDelete(service)}
                        className="h-9 w-9 text-zinc-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">
              {editingService ? `Edit ${editingService.name}` : 'Add Car Wash Service'}
            </DialogTitle>
            <DialogDescription>
              Changes apply to the public catalog and Carwash POS without altering past sales.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} noValidate className="space-y-4">
            {formErrors.length > 0 && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 space-y-1">
                {formErrors.map((errMsg, i) => (
                  <p key={i}>{errMsg}</p>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cw-name">Service Name</Label>
              <Input
                id="cw-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Normal Wash"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(val) => setForm((f) => ({ ...f, category: val as CarWashCategory }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAR_WASH_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Pricing Type</Label>
                <Select
                  value={form.pricingType}
                  onValueChange={(val) => setForm((f) => ({ ...f, pricingType: val as CarWashPricingType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="range">Range</SelectItem>
                    <SelectItem value="tiers">Tiers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.pricingType === 'fixed' && (
              <div className="space-y-1.5">
                <Label htmlFor="cw-price">Price (KES)</Label>
                <Input
                  id="cw-price"
                  type="number"
                  min={1}
                  step="1"
                  required
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="300"
                />
              </div>
            )}

            {form.pricingType === 'range' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cw-price-from">Price From (KES)</Label>
                  <Input
                    id="cw-price-from"
                    type="number"
                    min={1}
                    step="1"
                    required
                    value={form.priceFrom}
                    onChange={(e) => setForm((f) => ({ ...f, priceFrom: e.target.value }))}
                    placeholder="1000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cw-price-to">Price To (KES)</Label>
                  <Input
                    id="cw-price-to"
                    type="number"
                    min={1}
                    step="1"
                    required
                    value={form.priceTo}
                    onChange={(e) => setForm((f) => ({ ...f, priceTo: e.target.value }))}
                    placeholder="1500"
                  />
                </div>
              </div>
            )}

            {form.pricingType === 'tiers' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Pricing Tiers</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        tiers: [...f.tiers, { label: `Option ${f.tiers.length + 1}`, price: '' }],
                      }))
                    }
                  >
                    Add Tier
                  </Button>
                </div>
                {form.tiers.map((tier, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="Tier label"
                      value={tier.label}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          tiers: f.tiers.map((t, i) => (i === idx ? { ...t, label: e.target.value } : t)),
                        }))
                      }
                    />
                    <Input
                      type="number"
                      min={1}
                      placeholder="KES"
                      value={tier.price}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          tiers: f.tiers.map((t, i) => (i === idx ? { ...t, price: e.target.value } : t)),
                        }))
                      }
                    />
                    {form.tiers.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            tiers: f.tiers.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4 text-zinc-400" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cw-std-price">Standard Size Override (optional)</Label>
                <Input
                  id="cw-std-price"
                  type="number"
                  min={1}
                  value={form.standardPrice}
                  onChange={(e) => setForm((f) => ({ ...f, standardPrice: e.target.value }))}
                  placeholder="e.g. 300"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cw-suv-price">SUV Size Override (optional)</Label>
                <Input
                  id="cw-suv-price"
                  type="number"
                  min={1}
                  value={form.suvPrice}
                  onChange={(e) => setForm((f) => ({ ...f, suvPrice: e.target.value }))}
                  placeholder="e.g. 400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cw-sort">Sort Order</Label>
                <Input
                  id="cw-sort"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cw-commission">Commission (%)</Label>
                <Input
                  id="cw-commission"
                  type="number"
                  min={0}
                  max={100}
                  value={form.commission}
                  onChange={(e) => setForm((f) => ({ ...f, commission: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cw-note">Optional Note</Label>
              <Textarea
                id="cw-note"
                rows={2}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Final price depends on vehicle size and condition."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-primary text-white">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingService ? 'Save Changes' : 'Create Service'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
