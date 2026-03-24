import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { fetchStats } from '../api/client';
import type { OrderStatus } from '../types';

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: '#EAB308',
  CONFIRMED: '#3B82F6',
  PREPARING: '#F97316',
  READY: '#22C55E',
  DELIVERED: '#6B7280',
  CANCELLED: '#EF4444',
};

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
}

function StatCard({ title, value, subtitle }: StatCardProps) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
    </div>
  );
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Dashboard() {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-red-500">Failed to load stats. Check your connection.</p>
      </div>
    );
  }

  const pieData = Object.entries(stats.orders.byStatus)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({ name: status, value: count }));

  const last7Days = stats.dailyRevenue.slice(-7);

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stat Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.revenue.total)}
          subtitle="All time"
        />
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(stats.revenue.today)}
          subtitle="Since midnight"
        />
        <StatCard
          title="Total Orders"
          value={stats.orders.total.toString()}
          subtitle="All time"
        />
        <StatCard
          title="Today's Orders"
          value={stats.orders.today.toString()}
          subtitle="Since midnight"
        />
      </div>

      {/* Charts */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Daily Revenue Bar Chart */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            Daily Revenue (Last 7 Days)
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={last7Days} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => `$${v}`}
                tick={{ fontSize: 11, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                labelFormatter={formatDate}
                contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
              />
              <Bar dataKey="revenue" fill="#1F2937" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Orders by Status Pie Chart */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-800">Orders by Status</h2>
          {pieData.length === 0 ? (
            <div className="flex h-60 items-center justify-center text-gray-400">
              No orders yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={STATUS_COLORS[entry.name as OrderStatus] ?? '#9CA3AF'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span style={{ fontSize: 12, color: '#374151' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Popular Items */}
      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-800">Popular Items</h2>
        </div>
        {stats.popularItems.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">No order data yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left font-medium text-gray-500">Rank</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Item</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">
                  Units Sold
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.popularItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-500">#{idx + 1}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-6 py-3 text-right text-gray-700">
                    {item.totalQuantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
