import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ticketApi } from '../api';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-900 text-green-300',
  pending: 'bg-yellow-900 text-yellow-300',
  closed: 'bg-gray-800 text-gray-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-red-400',
  critical: 'text-purple-400',
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', category: '', priority: '', search: '' });
  const [page, setPage] = useState(1);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (filters.status) params.status = filters.status;
      if (filters.category) params.category = filters.category;
      if (filters.priority) params.priority = filters.priority;
      if (filters.search) params.search = filters.search;

      const res = await ticketApi.list(params);
      setTickets(res.data.tickets);
      setPagination(res.data.pagination);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">🎫 Ticketlar</h1>
        <span className="text-gray-400 text-sm">Toplam: {pagination.total}</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-gray-900 border border-gray-800 rounded-xl p-4">
        <input
          type="text"
          placeholder="🔍 Ara..."
          value={filters.search}
          onChange={(e) => handleFilter('search', e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 flex-1 min-w-40"
        />
        {['status', 'category', 'priority'].map((filterKey) => (
          <select
            key={filterKey}
            value={(filters as any)[filterKey]}
            onChange={(e) => handleFilter(filterKey, e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">{filterKey.charAt(0).toUpperCase() + filterKey.slice(1)}</option>
            {filterKey === 'status' && ['open', 'pending', 'closed'].map((v) => <option key={v} value={v}>{v}</option>)}
            {filterKey === 'category' && ['bug', 'support', 'suggestion', 'other'].map((v) => <option key={v} value={v}>{v}</option>)}
            {filterKey === 'priority' && ['low', 'medium', 'high', 'critical'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['Ticket ID', 'Kullanıcı', 'Konu', 'Kategori', 'Öncelik', 'Durum', 'Tarih'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500">Yükleniyor...</td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500">Ticket bulunamadı</td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket._id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                  <td className="px-4 py-3">
                    <Link to={`/tickets/${ticket.ticketId}`} className="text-indigo-400 hover:text-indigo-300 font-mono text-xs">
                      {ticket.ticketId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{ticket.userTag}</td>
                  <td className="px-4 py-3 text-gray-300 max-w-48 truncate">{ticket.subject}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{ticket.category}</td>
                  <td className={`px-4 py-3 font-medium text-xs ${PRIORITY_COLORS[ticket.priority]}`}>
                    {ticket.priority}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status]}`}>
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(ticket.createdAt).toLocaleDateString('tr-TR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <span className="text-xs text-gray-500">
              Sayfa {pagination.page} / {pagination.pages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs bg-gray-800 text-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-700 transition"
              >
                ← Önceki
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="px-3 py-1 text-xs bg-gray-800 text-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-700 transition"
              >
                Sonraki →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
