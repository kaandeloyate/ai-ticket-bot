import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ticketApi } from '../api';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-green-400',
  medium: 'text-yellow-400',
  high: 'text-red-400',
  critical: 'text-purple-400',
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'text-green-400',
  neutral: 'text-gray-400',
  negative: 'text-yellow-400',
  toxic: 'text-red-400',
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    ticketApi.get(id).then((res) => {
      setData(res.data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="text-center py-16 text-gray-400">Yükleniyor...</div>;
  if (!data) return <div className="text-center py-16 text-gray-400">Ticket bulunamadı.</div>;

  const { ticket, userHistory } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white transition">
          ← Geri
        </button>
        <h1 className="text-xl font-bold text-white font-mono">{ticket.ticketId}</h1>
        <span className={`text-sm font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
          [{ticket.priority}]
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Mesajlar */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-white border-b border-gray-800 pb-2">
            💬 Konuşma ({ticket.messages.length} mesaj)
          </h2>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {ticket.messages.map((msg: any, i: number) => (
              <div
                key={i}
                className={`rounded-lg p-3 ${msg.isAI ? 'bg-blue-950 border border-blue-800' : 'bg-gray-800'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium ${msg.isAI ? 'text-blue-400' : 'text-gray-300'}`}>
                    {msg.isAI ? '🤖 AI Asistan' : msg.authorTag}
                  </span>
                  <span className="text-xs text-gray-600">
                    {new Date(msg.timestamp).toLocaleString('tr-TR')}
                  </span>
                </div>
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Detaylar */}
        <div className="space-y-4">
          {/* Ticket bilgileri */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <h2 className="font-semibold text-white border-b border-gray-800 pb-2">📋 Detaylar</h2>
            {[
              ['Konu', ticket.subject],
              ['Kullanıcı', ticket.userTag],
              ['Kategori', ticket.category],
              ['Durum', ticket.status],
              ['Öncelik', ticket.priority],
              ['SLA İhlali', ticket.slaBreached ? '⚠️ Evet' : '✅ Hayır'],
              ['Açılış', new Date(ticket.createdAt).toLocaleString('tr-TR')],
              ...(ticket.closedAt ? [['Kapanış', new Date(ticket.closedAt).toLocaleString('tr-TR')]] : []),
              ...(ticket.closedBy ? [['Kapatan', ticket.closedBy]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-gray-400">{label}</span>
                <span className="text-gray-200 text-right max-w-40 truncate">{String(value)}</span>
              </div>
            ))}
          </div>

          {/* AI Analizi */}
          {ticket.aiAnalysis && (
            <div className="bg-gray-900 border border-indigo-900 rounded-xl p-4 space-y-3">
              <h2 className="font-semibold text-white border-b border-gray-800 pb-2">🤖 AI Analizi</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Özet</span>
                </div>
                <p className="text-gray-200 text-xs bg-gray-800 rounded p-2">{ticket.aiAnalysis.summary}</p>
                <div className="flex justify-between">
                  <span className="text-gray-400">Duygu</span>
                  <span className={`font-medium ${SENTIMENT_COLORS[ticket.aiAnalysis.sentiment]}`}>
                    {ticket.aiAnalysis.sentiment}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Güven</span>
                  <span className="text-gray-200">%{Math.round(ticket.aiAnalysis.confidence * 100)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Spam/Toksik</span>
                  <span className={ticket.aiAnalysis.isSpam || ticket.aiAnalysis.isToxic ? 'text-red-400' : 'text-green-400'}>
                    {ticket.aiAnalysis.isSpam || ticket.aiAnalysis.isToxic ? '⚠️ Evet' : '✅ Hayır'}
                  </span>
                </div>
                {ticket.aiAnalysis.tags?.length > 0 && (
                  <div>
                    <span className="text-gray-400 text-xs">Etiketler</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ticket.aiAnalysis.tags.map((tag: string) => (
                        <span key={tag} className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Kullanıcı Geçmişi */}
          {userHistory && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <h2 className="font-semibold text-white border-b border-gray-800 pb-2">
                👤 Kullanıcı Geçmişi
              </h2>
              <div className="space-y-2 text-sm">
                {[
                  ['Toplam Ticket', userHistory.ticketCount],
                  ['Kapalı Ticket', userHistory.closedTicketCount],
                  ['Uyarı Sayısı', userHistory.warnings?.length || 0],
                  ['Yasaklı', userHistory.isBanned ? '🔴 Evet' : '🟢 Hayır'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-gray-200">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
