import * as fs from 'fs';
import * as path from 'path';
import { ITicket } from '../models/Ticket';
import { TICKET_CONFIG } from '../config';
import { logger } from './logger';

export async function generateTranscript(ticket: ITicket): Promise<string> {
  const dir = TICKET_CONFIG.TRANSCRIPT_DIR;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = `${ticket.ticketId}-${Date.now()}.html`;
  const filepath = path.join(dir, filename);

  const html = buildTranscriptHTML(ticket);

  try {
    fs.writeFileSync(filepath, html, 'utf-8');
    logger.info('Transcript oluşturuldu', { ticketId: ticket.ticketId, filepath });
    return filepath;
  } catch (error) {
    logger.error('Transcript oluşturma hatası', { error, ticketId: ticket.ticketId });
    throw error;
  }
}

function buildTranscriptHTML(ticket: ITicket): string {
  const messages = ticket.messages
    .map((msg) => {
      const time = new Date(msg.timestamp).toLocaleString('tr-TR');
      const authorClass = msg.isAI ? 'ai' : 'user';
      const badge = msg.isAI ? '🤖 AI Asistan' : msg.authorTag;
      const attachments = msg.attachments?.length
        ? `<div class="attachments">${msg.attachments.map((a) => `<a href="${a}" target="_blank">📎 Ek</a>`).join('')}</div>`
        : '';

      return `
      <div class="message ${authorClass}">
        <div class="message-header">
          <span class="author">${escapeHtml(badge)}</span>
          <span class="time">${time}</span>
        </div>
        <div class="message-content">${escapeHtml(msg.content)}</div>
        ${attachments}
      </div>`;
    })
    .join('\n');

  const aiSummary = ticket.aiAnalysis
    ? `
    <div class="ai-summary">
      <h3>🤖 AI Analizi</h3>
      <div class="summary-grid">
        <div><strong>Kategori:</strong> ${ticket.aiAnalysis.category}</div>
        <div><strong>Öncelik:</strong> ${ticket.aiAnalysis.priority}</div>
        <div><strong>Duygu:</strong> ${ticket.aiAnalysis.sentiment}</div>
        <div><strong>Dil:</strong> ${ticket.aiAnalysis.language}</div>
        <div class="full-width"><strong>Özet:</strong> ${escapeHtml(ticket.aiAnalysis.summary)}</div>
        ${ticket.aiAnalysis.tags.length ? `<div class="full-width"><strong>Etiketler:</strong> ${ticket.aiAnalysis.tags.join(', ')}</div>` : ''}
      </div>
    </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ticket Transcript - ${ticket.ticketId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; background: #1e2124; color: #dcddde; padding: 20px; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { background: #2f3136; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #5865f2; }
    .header h1 { color: #5865f2; font-size: 1.5rem; margin-bottom: 10px; }
    .header-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 12px; }
    .header-item { background: #36393f; padding: 8px 12px; border-radius: 4px; font-size: 0.85rem; }
    .header-item strong { color: #b9bbbe; display: block; font-size: 0.75rem; text-transform: uppercase; margin-bottom: 2px; }
    .ai-summary { background: #1a1d3a; border: 1px solid #5865f2; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
    .ai-summary h3 { color: #5865f2; margin-bottom: 12px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
    .summary-grid div { background: #2f3136; padding: 8px; border-radius: 4px; font-size: 0.85rem; }
    .summary-grid .full-width { grid-column: 1 / -1; }
    .messages { display: flex; flex-direction: column; gap: 8px; }
    .message { padding: 12px 16px; border-radius: 8px; }
    .message.user { background: #36393f; }
    .message.ai { background: #1a1d3a; border: 1px solid #5865f230; }
    .message-header { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
    .author { font-weight: 600; color: #ffffff; }
    .message.ai .author { color: #00b0f4; }
    .time { font-size: 0.75rem; color: #72767d; }
    .message-content { line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
    .attachments { margin-top: 8px; }
    .attachments a { color: #00b0f4; font-size: 0.85rem; margin-right: 8px; }
    .footer { text-align: center; color: #72767d; font-size: 0.8rem; padding: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎫 Ticket Transcript</h1>
      <div class="header-grid">
        <div class="header-item"><strong>Ticket ID</strong>${ticket.ticketId}</div>
        <div class="header-item"><strong>Kullanıcı</strong>${escapeHtml(ticket.userTag)}</div>
        <div class="header-item"><strong>Kategori</strong>${ticket.category}</div>
        <div class="header-item"><strong>Öncelik</strong>${ticket.priority}</div>
        <div class="header-item"><strong>Durum</strong>${ticket.status}</div>
        <div class="header-item"><strong>Açılış</strong>${new Date(ticket.createdAt).toLocaleString('tr-TR')}</div>
        ${ticket.closedAt ? `<div class="header-item"><strong>Kapanış</strong>${new Date(ticket.closedAt).toLocaleString('tr-TR')}</div>` : ''}
        ${ticket.closedBy ? `<div class="header-item"><strong>Kapatan</strong>${escapeHtml(ticket.closedBy)}</div>` : ''}
        <div class="header-item" style="grid-column: 1 / -1"><strong>Konu</strong>${escapeHtml(ticket.subject)}</div>
      </div>
    </div>
    ${aiSummary}
    <div class="messages">
      ${messages}
    </div>
    <div class="footer">
      <p>Toplam ${ticket.messages.length} mesaj • ${new Date().toLocaleString('tr-TR')} tarihinde oluşturuldu</p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
