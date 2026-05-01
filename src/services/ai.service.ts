import OpenAI from 'openai';
import { config, TICKET_CONFIG } from '../config';
import { logger } from '../utils/logger';
import {
  AIAnalysis,
  TicketCategory,
  TicketPriority,
  MessageSentiment,
  TicketMessage,
} from '../types';

const SYSTEM_PROMPTS = {
  ANALYSIS: `Sen bir Discord sunucu destek sistemi için çalışan AI asistanısın. 
Görevin kullanıcıların destek taleplerini analiz etmek ve yapılandırılmış JSON çıktısı üretmek.

Her analiz için şu bilgileri döndür:
- category: "bug" | "support" | "suggestion" | "other"
- priority: "low" | "medium" | "high" | "critical"
- sentiment: "positive" | "neutral" | "negative" | "toxic"
- summary: Kısa özet (max 150 karakter)
- suggestedResponse: Kullanıcıya verilecek ilk yanıt önerisi (Türkçe veya İngilizce, kullanıcının diline göre)
- isSpam: boolean
- isToxic: boolean
- tags: string[] (ilgili anahtar kelimeler, max 5)
- language: "tr" | "en" | "other"
- confidence: 0-1 arası güven skoru

SADECE geçerli JSON döndür, markdown veya açıklama ekleme.`,

  RESPONSE: `Sen bir Discord sunucu destek ekibinin AI asistanısın.
Kullanıcıların sorunlarını profesyonelce, samimi ve çözüm odaklı yaklaş.
Cevaplarını kullanıcının diline göre ver (Türkçe ise Türkçe, İngilizce ise İngilizce).
Eğer sorunu çözebilirsen adım adım açıkla.
Eğer yetersiz bilgin varsa, destek ekibinin yakında yardım edeceğini belirt.
Emoji kullanabilirsin ama abartma.
Maksimum 500 kelime.`,

  TOXIC_CHECK: `Verilen mesajın zararlı, küfürlü, tehdit içeren veya kötüye kullanım amaçlı olup olmadığını kontrol et.
SADECE JSON döndür: { "isToxic": boolean, "reason": string | null, "severity": "low" | "medium" | "high" }`,

  SPAM_CHECK: `Bu konuşma geçmişine bakarak spam veya kötüye kullanım var mı belirle.
SADECE JSON döndür: { "isSpam": boolean, "pattern": string | null }`,

  SUMMARY: `Aşağıdaki ticket konuşmasını analiz et ve yönetici için özet çıkar.
SADECE JSON döndür:
{
  "summary": "kısa özet",
  "resolution": "çözüm durumu",
  "userSatisfaction": "satisfied" | "unsatisfied" | "neutral",
  "actionRequired": boolean,
  "actionDescription": string | null,
  "keyPoints": string[]
}`,
};

export class AIService {
  private client: OpenAI;
  private model: string;
  private requestCache: Map<string, { response: unknown; timestamp: number }>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 dakika

  constructor() {
    this.client = new OpenAI({ apiKey: config.openaiApiKey });
    this.model = config.openaiModel;
    this.requestCache = new Map();
  }

  // ─── Ticket Analizi ───────────────────────────────────────────────────────
  async analyzeTicket(
    subject: string,
    initialMessage: string,
    userId: string,
    userHistory?: { ticketCount: number; hasWarnings: boolean },
  ): Promise<AIAnalysis> {
    const cacheKey = `analyze:${Buffer.from(initialMessage).toString('base64').slice(0, 32)}`;
    const cached = this.getFromCache<AIAnalysis>(cacheKey);
    if (cached) return cached;

    try {
      const userContext = userHistory
        ? `\nKullanıcı geçmişi: ${userHistory.ticketCount} ticket, uyarı: ${userHistory.hasWarnings}`
        : '';

      const prompt = `Ticket Konusu: "${subject}"\nMesaj: "${initialMessage}"${userContext}`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS.ANALYSIS },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0]?.message?.content;
      if (!raw) throw new Error('OpenAI boş yanıt döndürdü');

      const parsed = JSON.parse(raw);
      const analysis: AIAnalysis = {
        category: this.validateEnum(parsed.category, TicketCategory, TicketCategory.SUPPORT),
        priority: this.validateEnum(parsed.priority, TicketPriority, TicketPriority.MEDIUM),
        sentiment: this.validateEnum(
          parsed.sentiment,
          MessageSentiment,
          MessageSentiment.NEUTRAL,
        ),
        summary: String(parsed.summary || '').slice(0, 150),
        suggestedResponse: String(parsed.suggestedResponse || ''),
        isSpam: Boolean(parsed.isSpam),
        isToxic: Boolean(parsed.isToxic),
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
        language: ['tr', 'en'].includes(parsed.language) ? parsed.language : 'tr',
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.7)),
      };

      // Yüksek öncelik tetikleyicileri
      if (
        /acil|urgent|kritik|critical|çalışmıyor|down|crash/i.test(initialMessage)
      ) {
        if (analysis.priority === TicketPriority.LOW) {
          analysis.priority = TicketPriority.HIGH;
        }
      }

      this.setCache(cacheKey, analysis);
      logger.debug('AI analizi tamamlandı', { userId, category: analysis.category });
      return analysis;
    } catch (error) {
      logger.error('AI analiz hatası', { error });
      return this.getFallbackAnalysis(initialMessage);
    }
  }

  // ─── İlk AI Yanıtı ───────────────────────────────────────────────────────
  async generateInitialResponse(
    subject: string,
    message: string,
    category: TicketCategory,
    language: 'tr' | 'en' | 'other',
  ): Promise<string> {
    try {
      const langHint =
        language === 'tr'
          ? 'Türkçe cevap ver.'
          : language === 'en'
          ? 'Reply in English.'
          : '';

      const prompt = `Kategori: ${category}\nKonu: ${subject}\nMesaj: ${message}\n\n${langHint}`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS.RESPONSE },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 600,
      });

      return response.choices[0]?.message?.content?.trim() || this.getFallbackResponse(language);
    } catch (error) {
      logger.error('AI yanıt oluşturma hatası', { error });
      return this.getFallbackResponse(language);
    }
  }

  // ─── Mesaj Yanıtı ────────────────────────────────────────────────────────
  async generateContextualResponse(
    messages: TicketMessage[],
    category: TicketCategory,
    language: 'tr' | 'en' | 'other',
  ): Promise<string> {
    try {
      const history = messages
        .slice(-TICKET_CONFIG.MAX_MESSAGE_HISTORY)
        .map((m) => ({
          role: m.isAI ? 'assistant' : 'user',
          content: `${m.authorTag}: ${m.content}`,
        })) as OpenAI.Chat.ChatCompletionMessageParam[];

      const langHint =
        language === 'tr'
          ? 'Türkçe cevap ver.'
          : language === 'en'
          ? 'Reply in English.'
          : '';

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `${SYSTEM_PROMPTS.RESPONSE}\nKategori: ${category}\n${langHint}`,
          },
          ...history,
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      return response.choices[0]?.message?.content?.trim() || this.getFallbackResponse(language);
    } catch (error) {
      logger.error('AI bağlamsal yanıt hatası', { error });
      return this.getFallbackResponse(language);
    }
  }

  // ─── Toxic Kontrol ───────────────────────────────────────────────────────
  async checkToxicity(
    message: string,
  ): Promise<{ isToxic: boolean; reason: string | null; severity: 'low' | 'medium' | 'high' }> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS.TOXIC_CHECK },
          { role: 'user', content: message.slice(0, 1000) },
        ],
        temperature: 0.1,
        max_tokens: 100,
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0]?.message?.content;
      if (!raw) return { isToxic: false, reason: null, severity: 'low' };

      const parsed = JSON.parse(raw);
      return {
        isToxic: Boolean(parsed.isToxic),
        reason: parsed.reason || null,
        severity: ['low', 'medium', 'high'].includes(parsed.severity)
          ? parsed.severity
          : 'low',
      };
    } catch {
      return { isToxic: false, reason: null, severity: 'low' };
    }
  }

  // ─── Ticket Özeti ────────────────────────────────────────────────────────
  async generateTicketSummary(messages: TicketMessage[]): Promise<{
    summary: string;
    resolution: string;
    userSatisfaction: 'satisfied' | 'unsatisfied' | 'neutral';
    actionRequired: boolean;
    actionDescription: string | null;
    keyPoints: string[];
  }> {
    try {
      const conversation = messages
        .slice(-30)
        .map((m) => `[${m.isAI ? 'AI' : m.authorTag}]: ${m.content}`)
        .join('\n');

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS.SUMMARY },
          { role: 'user', content: conversation },
        ],
        temperature: 0.3,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0]?.message?.content;
      if (!raw)
        return {
          summary: 'Özet oluşturulamadı',
          resolution: 'Bilinmiyor',
          userSatisfaction: 'neutral',
          actionRequired: false,
          actionDescription: null,
          keyPoints: [],
        };

      return JSON.parse(raw);
    } catch {
      return {
        summary: 'Özet oluşturulamadı',
        resolution: 'Bilinmiyor',
        userSatisfaction: 'neutral',
        actionRequired: false,
        actionDescription: null,
        keyPoints: [],
      };
    }
  }

  // ─── Önceki Çözüm Önerisi ────────────────────────────────────────────────
  async findSimilarSolution(
    subject: string,
    message: string,
    previousSummaries: string[],
  ): Promise<string | null> {
    if (!previousSummaries.length) return null;

    try {
      const prompt = `Yeni sorun: "${subject} - ${message}"
      
Önceki çözümler:
${previousSummaries.slice(0, 5).map((s, i) => `${i + 1}. ${s}`).join('\n')}

Bu sorun önceki çözümlerden biriyle çözülebilir mi? Evet ise ilgili çözümü açıkla. Hayır ise sadece "null" döndür.
SADECE JSON: { "found": boolean, "solution": string | null }`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
      return parsed.found ? parsed.solution : null;
    } catch {
      return null;
    }
  }

  // ─── Yardımcı Metotlar ───────────────────────────────────────────────────
  private validateEnum<T extends object>(
    value: unknown,
    enumObj: T,
    fallback: T[keyof T],
  ): T[keyof T] {
    if (Object.values(enumObj).includes(value)) return value as T[keyof T];
    return fallback;
  }

  private getFallbackAnalysis(message: string): AIAnalysis {
    const isBug = /hata|bug|çalışmıyor|error|crash/i.test(message);
    const isUrgent = /acil|urgent|kritik/i.test(message);

    return {
      category: isBug ? TicketCategory.BUG : TicketCategory.SUPPORT,
      priority: isUrgent ? TicketPriority.HIGH : TicketPriority.MEDIUM,
      sentiment: MessageSentiment.NEUTRAL,
      summary: message.slice(0, 100),
      suggestedResponse:
        'Merhaba! Talebiniz alındı. Destek ekibimiz en kısa sürede yardımcı olacak.',
      isSpam: false,
      isToxic: false,
      tags: [],
      language: 'tr',
      confidence: 0.3,
    };
  }

  private getFallbackResponse(language: 'tr' | 'en' | 'other'): string {
    if (language === 'en') {
      return 'Hello! Your request has been received. Our support team will assist you shortly. Please provide more details about your issue.';
    }
    return 'Merhaba! Talebiniz alındı. Destek ekibimiz en kısa sürede size yardımcı olacak. Lütfen sorununuzla ilgili daha fazla detay paylaşın.';
  }

  private getFromCache<T>(key: string): T | null {
    const item = this.requestCache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > this.CACHE_TTL) {
      this.requestCache.delete(key);
      return null;
    }
    return item.response as T;
  }

  private setCache(key: string, response: unknown): void {
    this.requestCache.set(key, { response, timestamp: Date.now() });
    // Cache boyutunu sınırla
    if (this.requestCache.size > 200) {
      const firstKey = this.requestCache.keys().next().value;
      if (firstKey) this.requestCache.delete(firstKey);
    }
  }
}

export const aiService = new AIService();
