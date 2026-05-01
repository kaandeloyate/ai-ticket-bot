import { useEffect, useState } from 'react';
import { ticketApi } from '../api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface Stats {
  totalTickets: number;
  openTickets: number;
  closedTickets: number;
  pendingTickets: number;
  slaBreached: number;
  avgResponseTimeMs: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  recentActivity: any[];
}

const PIE_COLORS = ['#6366f1', '#22c55e', '#eab308', '#ef4444', '#8b5cf6'];

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4`}>
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-gray-400 text-sm">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ticketApi.stats().then((res) => {
      setStats(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Yükleniyor...
      </div>
    );
  }

  if (!stats) return null;

  const categoryData = Object.entries(stats.byCategory).map(([name, value]) => ({
    name,
    value,
  }));

  const priorityData = Object.entries(stats.byPriority).map(([name, value]) => ({
    name,
    value,
  }));

  const avgMinutes = Math.round(stats.avgResponseTimeMs / 60000);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">📊 Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Toplam Ticket" value={stats.totalTickets} icon="🎫" color="text-white" />
        <StatCard label="Açık" value={stats.openTickets} icon="🟢" color="text-green-400" />
        <StatCard label="Kapalı" value={stats.closedTickets} icon="🔒" color="text-gray-400" />
        <StatCard label="Bekleyen" value={stats.pendingTickets} icon="⏳" color="text-yellow-400" />
        <StatCard label="SLA İhlali" value={stats.slaBreached} icon="⚠️" color="text-red-400" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Ort. Yanıt Süresi"
          value={avgMinutes ? `${avgMinutes} dk` : 'N/A'}
          icon="⏱️"
          color="text-indigo-400"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kategori dağılımı */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">📂 Kategori Dağılımı</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {categoryData.map((_entry, index) => (
                  <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Öncelik dağılımı */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">⚡ Öncelik Dağılımı</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={priorityData}>
              <XAxis dataKey="name" tick={{ fill: '#9ca3af' }} />
              <YAxis tick={{ fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Son aktivite */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">🕐 Son Aktivite</h2>
        <div className="space-y-2">
          {stats.recentActivity.length === 0 && (
            <p className="text-gray-500 text-sm">Aktivite yok</p>
          )}
          {stats.recentActivity.map((activity: any, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-2 h-2 rounded-full ${activity.status === 'open' ? 'bg-green-400' : 'bg-gray-500'}`}
                />
                <span className="text-sm text-gray-300">{activity.ticketId}</span>
                <span className="text-xs text-gray-500">{activity.userTag}</span>
              </div>
              <span className="text-xs text-gray-500">
                {new Date(activity.lastActivityAt).toLocaleString('tr-TR')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
