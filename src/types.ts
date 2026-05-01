export interface Arena {
  id: string;
  name: string;
  sports: string[];
}

export interface Court {
  id: string;
  arenaId: string;
  name: string;
  sport: string;
  pricePerHour: number;
}

export interface Booking {
  id: string;
  courtId: string;
  clientId?: string;
  customerName: string;
  customerPhone?: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  actualStartTime?: string; // ISO string
  actualEndTime?: string; // ISO string
  status: 'confirmed' | 'pending' | 'cancelled';
  type?: 'single' | 'recurring';
  totalPrice: number;
  paidAmount: number;
  payments: Payment[];
  courtFinalized?: boolean; // true after PDV court payment is finalized
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  createdAt: string;
  totalBookings: number;
  totalSpent: number;
  balance: number;
}

export interface Payment {
  id: string;
  amount: number;
  timestamp: string;
  playerName?: string;
  methodId?: string; // Reference to PaymentMethod
  method: 'cash' | 'card' | 'pix' | 'credit' | string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'cash' | 'card_debit' | 'card_credit' | 'pix' | 'account' | 'other';
  isActive: boolean;
  isSystem?: boolean; // Protect "Conta-corrente"
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  categoryId?: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  description?: string;
  expiryDate?: string;
  imageUrl?: string;
  taxInvoiceInfo?: {
    ncm: string;
    cfop: string;
    taxRate: number;
  };
}

export interface Category {
  id: string;
  name: string;
  type: 'product' | 'transaction';
}

export interface InventoryLog {
  id: string;
  productId: string;
  type: 'entry' | 'exit' | 'loss' | 'reversal';
  quantity: number;
  reason?: string;
  timestamp: string;
  invoiceNumber?: string;
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  dayOfMonth: number;
  categoryId?: string;
}

export interface RecurringBooking {
  id: string;
  courtId: string;
  clientId: string;
  dayOfWeek: number; // 0-6
  startTime: string; // HH:mm
  duration: number; // minutes
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  isFixed?: boolean;
  amount: number;
  description: string;
  timestamp: string;
  categoryId?: string;
  status?: 'paid' | 'pending';
  dueDate?: string;
}

export interface BusinessHours {
  open: string; // HH:mm
  close: string; // HH:mm
  isOpen: boolean;
}

export interface Settings {
  companyName: string;
  cnpj?: string;
  address?: string;
  logo?: string;
  googleMapsUrl?: string;
  googleRating?: number;
  fiscalConfig?: any;
  printerConfig?: any;
  businessHours?: Record<string, BusinessHours>;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OpenTab {
  id: string;
  label: string; // "Mesa 01" or Client Name
  clientId?: string;
  items: CartItem[];
  openedAt: string;
  status: 'open' | 'closed';
  linkedBookingId?: string; // Links tab to a court booking (for dedup)
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  creditLimit: number;
  balance: number; // Negative means debt
}

export interface SiteConfig {
  id: string;
  name: string;
  subdomain?: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  hero: {
    title: string;
    description: string;
    backgroundImage?: string;
    overlayOpacity?: number;
    ctaText: string;
  };
  sections: {
    about: {
      enabled: boolean;
      title: string;
      description?: string;
      content: string;
      ctaText?: string;
    };
    events: {
      enabled: boolean;
      title: string;
      description?: string;
      ctaText?: string;
    };
    booking: {
      enabled: boolean;
      title: string;
      description?: string;
      ctaText?: string;
    };
    ecommerce: {
      enabled: boolean;
      title: string;
      description?: string;
      ctaText?: string;
      featuredProductIds?: string[];
    };
    blog: {
      enabled: boolean;
      title: string;
      description?: string;
      ctaText?: string;
    };
  };
  contact: {
    address: string;
    phone: string;
    email: string;
    instagram?: string;
    facebook?: string;
  };
}
