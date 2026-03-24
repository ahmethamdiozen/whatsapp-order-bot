import type { OrderStatus, PaymentStatus } from '../types';

const ORDER_STATUS_CLASSES: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PREPARING: 'bg-orange-100 text-orange-800',
  READY: 'bg-green-100 text-green-800',
  DELIVERED: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-800',
};

const PAYMENT_STATUS_CLASSES: Record<PaymentStatus, string> = {
  UNPAID: 'bg-red-100 text-red-800',
  PAID: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
};

interface OrderStatusBadgeProps {
  status: OrderStatus;
}

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_CLASSES[status]}`}
    >
      {status}
    </span>
  );
}

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PAYMENT_STATUS_CLASSES[status]}`}
    >
      {status}
    </span>
  );
}
