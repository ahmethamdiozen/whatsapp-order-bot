export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus = 'UNPAID' | 'PAID' | 'FAILED';

export interface Location {
  id: number;
  name: string;
  address: string;
}

export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  isAvailable: boolean;
  locationId: number;
}

export interface OrderItem {
  quantity: number;
  menuItem: {
    name: string;
  };
}

export interface Order {
  id: number;
  customerPhone: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalPrice: number;
  createdAt: string;
  location: {
    name: string;
  };
  items: OrderItem[];
}

export interface DailyRevenue {
  date: string;
  revenue: number;
}

export interface PopularItem {
  name: string;
  totalQuantity: number;
}

export interface Stats {
  revenue: {
    total: number;
    today: number;
    thisWeek: number;
  };
  orders: {
    total: number;
    today: number;
    byStatus: Record<OrderStatus, number>;
  };
  popularItems: PopularItem[];
  dailyRevenue: DailyRevenue[];
}

export interface MenuItemFormData {
  name: string;
  description: string;
  price: number;
  category: string;
  locationId?: number;
}
