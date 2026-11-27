export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'CASHIER' | 'STOREKEEPER' | 'ATTENDANT' | 'KITCHEN' | 'CLIENT';
export type BusinessUnit = 'LOUNGE' | 'STORE' | 'CARWASH';

export interface BusinessBranch {
  id: string;
  businessId: 'urban-address';
  name: string;
  code: string;
  status: 'ACTIVE' | 'INACTIVE';
  isPrimary: boolean;
  location: {
    address: string;
    town: string;
    county: string;
    country: string;
    postalCode?: string;
    landmark?: string;
    latitude?: number | null;
    longitude?: number | null;
    mapsUrl?: string;
  };
  phone?: string;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  updatedBy: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  role: UserRole;
  assignedUnits?: BusinessUnit[] | null;
  /** Branch access for multi-branch operations. Empty/omitted remains legacy until staff are assigned. */
  branchIds?: string[] | null;
  activeBranchId?: string | null;
  createdAt: number;
  photoURL?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  deliveryLocation?: { latitude: number; longitude: number } | null;
  mpesaNumber?: string | null; // Dedicated M-Pesa Payout Destination
  paystackRecipientCode?: string | null;
  mustChangePassword?: boolean;
  isSuperAdmin?: boolean;
  disabled?: boolean;
  status?: 'active' | 'suspended' | 'deleted';
  suspendedAt?: string;
  suspendedBy?: string;
  suspendedReason?: string;
  deletedAt?: string;
  hasPin?: boolean;
  accountType?: 'STAFF' | 'CLIENT';
  pin?: string; // 4-digit security code
  baseSalary?: number;
  loyaltyPoints?: number;
  totalSpent?: number;
  loyaltyReconciledAt?: number;
  loyaltyReconciliationId?: string;
  masterKey?: string;
  seenVersions?: string[]; // Tracking which briefings the user has acknowledged
}

export interface POSTerminal {
  id: string;
  name: string;
  unit: BusinessUnit;
  status: 'OPEN' | 'CLOSED';
  currentCashierId: string | null;
  currentRegisterSessionId: string | null;
  lastActive: number;
}

export interface RegisterSession {
  id?: string;
  terminalId: string;
  openedAt: number;
  closedAt?: number | null;
  openingCash: number;
  closingCash?: number | null;
  status: 'OPEN' | 'CLOSED';
  managerId: string;
}

export interface CashierSession {
  id?: string;
  terminalId: string;
  cashierId: string;
  cashierName: string;
  registerSessionId: string;
  startedAt: number;
  endedAt?: number | null;
  status: 'ACTIVE' | 'CLOSED';
}

export interface Review {
  id?: string;
  userId: string;
  userName: string;
  userPhoto?: string | null;
  rating: number;
  comment: string;
  timestamp: number;
}

export interface Product {
  id?: string;
  name: string;
  original_name?: string;
  category: string;
  subcategory?: string;
  description?: string;
  price: number;
  stockLevel: number;
  minStock: number;
  barcode?: string;
  unit: BusinessUnit;
  image?: string;
  image_url?: string;
  image_asset_key?: string;
  size?: number | string;
  sizeUnit?: string;
  commission?: number;
  commissionNightShift?: number;
  track_stock?: boolean;
  is_active?: boolean;
  needs_review?: boolean;
  review_notes?: string;
  source_ref?: string;
  // Stock Take Fields
  lastCountedStock?: number | null;
  lastCountedAt?: number | null;
  lastCountedBy?: string | null;
  // Costing & Archival
  costPrice?: number;
  archived?: boolean;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  notes?: string;
  status: 'DRAFT' | 'COMMITTED';
  commission?: number;
}

export interface Order {
  id?: string;
  type: 'LOUNGE' | 'STORE' | 'CARWASH' | 'SYSTEM-REPORT';
  jobType?: 'VEHICLE' | 'CARPET';
  status: 'PENDING' | 'PAID' | 'VOIDED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'CANCELLED';
  prepStatus?: 'NEW' | 'PREPARING' | 'READY' | 'SERVED';
  total: number;
  discount?: number;
  tip?: number;
  tax?: number;
  paymentMethod?: string;
  cashierId?: string;
  cashierName?: string;
  terminalId?: string;
  terminalName?: string;
  registerSessionId?: string;
  commission?: number;
  customerId?: string;
  customerName?: string;
  customerPhone?: string | null;
  fulfilment?: 'DELIVERY' | 'PICKUP';
  deliveryAddress?: string | null;
  deliveryLocation?: { latitude: number; longitude: number } | null;
  branchId?: string | null;
  branchName?: string | null;
  paymentStatus?: 'AWAITING_PAYMENT' | 'PAID' | 'FAILED';
  paymentProvider?: 'MPESA' | 'AIRTEL_MONEY';
  paymentRef?: string | null;
  paymentReceipt?: string | null;
  providerTransactionId?: string | null;
  paymentPhone?: string | null;
  paidPhone?: string | null;
  paymentAmount?: number;
  amountCurrency?: 'KES';
  checkoutRequestId?: string | null;
  merchantRequestId?: string | null;
  airtelTransactionId?: string | null;
  paymentInitiatedAt?: number;
  paymentFailureReason?: string | null;
  paymentFailedAt?: number;
  gatewayResponse?: string | null;
  inventorySynced?: boolean;
  paidAt?: number;
  cashTendered?: number | null;
  changeDue?: number | null;
  timestamp: number;
  servedAt?: number;
  items?: OrderItem[];
  plateNumber?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  tableNumber?: string;
  attendantId?: string;
  attendantName?: string;
  carpetDimensions?: string;
}

export interface CarwashJob {
  id?: string;
  orderId?: string;
  jobType?: 'VEHICLE' | 'CARPET';
  plateNumber: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  service: string;
  status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  attendantId: string;
  attendantName: string;
  price: number;
  tip?: number;
  commission: number;
  timestamp: number;
  customerId?: string;
  valetService?: string;
  address?: string;
  carpetDimensions?: string;
}

export interface AuditLog {
  id?: string;
  action: string;
  userId: string;
  terminalId?: string;
  details: string;
  timestamp: number;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface Reconciliation {
  id?: string;
  userId: string;
  timestamp: number;
  expectedCash: number;
  actualCash: number;
  variance: number;
  status: 'STABLE' | 'DISCREPANCY';
  notes?: string;
}

export interface Supplier {
  id?: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  category: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface PettyCashRequest {
  id?: string;
  amount: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  requesterId: string;
  requesterName: string;
  timestamp: number;
  approvedBy?: string;
  approvedAt?: number;
  deniedBy?: string;
  deniedAt?: number;
  denialReason?: string;
}

export interface AIChatMessage {
  id?: string;
  role: 'user' | 'ai';
  content: string | any;
  timestamp: number;
}
