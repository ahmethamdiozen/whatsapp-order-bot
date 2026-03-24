import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchOrders, updateOrderStatus } from '../api/client';
import { OrderStatusBadge, PaymentStatusBadge } from '../components/StatusBadge';
import type { OrderStatus } from '../types';

const ALL_STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'DELIVERED',
  'CANCELLED',
];

const STATUS_TABS: Array<{ label: string; value: OrderStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Preparing', value: 'PREPARING' },
  { label: 'Ready', value: 'READY' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Orders() {
  const [activeTab, setActiveTab] = useState<OrderStatus | 'ALL'>('ALL');
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading, isError } = useQuery({
    queryKey: ['orders'],
    queryFn: fetchOrders,
    refetchInterval: 15_000,
  });

  const { mutate: changeStatus, variables: pendingVars } = useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) =>
      updateOrderStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const filtered =
    activeTab === 'ALL' ? orders : orders.filter((o) => o.status === activeTab);

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Orders</h1>

      {/* Status Filter Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1">
        {STATUS_TABS.map(({ label, value }) => {
          const count =
            value === 'ALL'
              ? orders.length
              : orders.filter((o) => o.status === value).length;
          return (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs ${
                  activeTab === value
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="flex h-48 items-center justify-center">
          <p className="text-gray-500">Loading orders...</p>
        </div>
      )}

      {isError && (
        <div className="flex h-48 items-center justify-center">
          <p className="text-red-500">Failed to load orders.</p>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Items</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Total</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Payment</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((order) => {
                    const isPending =
                      pendingVars?.id === order.id;
                    return (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          #{order.id}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{order.customerPhone}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {order.location?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <ul className="space-y-0.5">
                            {order.items.map((item, idx) => (
                              <li key={idx} className="text-xs">
                                {item.quantity}x {item.menuItem.name}
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          ${order.totalPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <PaymentStatusBadge status={order.paymentStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <OrderStatusBadge status={order.status} />
                            <select
                              disabled={isPending}
                              value={order.status}
                              onChange={(e) =>
                                changeStatus({
                                  id: order.id,
                                  status: e.target.value as OrderStatus,
                                })
                              }
                              className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:opacity-50"
                            >
                              {ALL_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {formatDate(order.createdAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
