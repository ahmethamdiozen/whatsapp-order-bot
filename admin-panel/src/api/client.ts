import axios from 'axios';
import type {
  Stats,
  Order,
  OrderStatus,
  Location,
  MenuItem,
  MenuItemFormData,
} from '../types';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const apiClient = axios.create({ baseURL });

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers['x-admin-token'] = token;
  }
  return config;
});

// Stats
export const fetchStats = (): Promise<Stats> =>
  apiClient.get<Stats>('/admin/stats').then((r) => r.data);

// Orders
export const fetchOrders = (): Promise<Order[]> =>
  apiClient.get<Order[]>('/admin/orders').then((r) => r.data);

export const updateOrderStatus = (
  id: number,
  status: OrderStatus,
): Promise<{ id: number; status: OrderStatus }> =>
  apiClient
    .patch<{ id: number; status: OrderStatus }>(`/admin/orders/${id}/status`, { status })
    .then((r) => r.data);

// Locations
export const fetchLocations = (): Promise<Location[]> =>
  apiClient.get<Location[]>('/admin/locations').then((r) => r.data);

// Menu items
export const fetchMenuItems = (locationId: number): Promise<MenuItem[]> =>
  apiClient
    .get<MenuItem[]>('/admin/menu-items', { params: { locationId } })
    .then((r) => r.data);

export const createMenuItem = (data: MenuItemFormData): Promise<MenuItem> =>
  apiClient.post<MenuItem>('/admin/menu-items', data).then((r) => r.data);

export const updateMenuItem = (
  id: number,
  data: Omit<MenuItemFormData, 'locationId'>,
): Promise<MenuItem> =>
  apiClient.put<MenuItem>(`/admin/menu-items/${id}`, data).then((r) => r.data);

export const deleteMenuItem = (id: number): Promise<void> =>
  apiClient.delete(`/admin/menu-items/${id}`).then(() => undefined);

export const toggleMenuItemAvailability = (
  id: number,
  isAvailable: boolean,
): Promise<MenuItem> =>
  apiClient
    .patch<MenuItem>(`/admin/menu-items/${id}/availability`, { isAvailable })
    .then((r) => r.data);
