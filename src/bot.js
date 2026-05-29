/**
 * بوت تليجرام - الذكاء الاصطناعي
 * الملف الرئيسي
 */

import 'dotenv/config';
import express from 'express';
import { createRequire } from 'module';
import { getAIResponse, generateImage } from './ai.js';

// استيراد node-telegram-bot-api مع دعم ESM
const require = createRequire(import.meta.url);
const TelegramBot = require('node-telegram-bot-api');

// ==========================================
// التهيئة
// ==========================================

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_MODE = process.env.BOT_MODE || 'polling';
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const WELCOME_MESSAGE = process.env.WELCOME_MESSAGE || 'مرحباً! أنا بوت ذكاء اصطناعي 🤖\nاسألني أي سؤال!';
const MAX_MESSAGE_LENGTH = parseInt(process.env.MAX_MESSAGE_LENGTH) || 4096;

if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
  console.error('❌ لم يتم تعيين TELEGRAM_BOT_TOKEN في ملف .env');
  process.exit(1);
}

// ==========================================
// دوال مساعدة
// ==========================================

/**
 * تنظيف النص من عناصر HTML غير المدعومة
 * تليجرام يدعم فقط: b, i, u, s, code, pre, a, spoiler, blockquote
 * أي شيء بين < > ليس من هذه العلامات سيُسبب خطأ
 */
function escapeHTML(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * إرسال رسالة آمنة - تحاول HTML أولاً، وإذا فشلت ترسل بدون تنسيق
 */
async function safeSendMessage(chatId, text, options = {}) {
  // محاولة الإرسال بـ HTML
  try {
    return await bot.sendMessage(chatId, text, { ...options, parse_mode: 'HTML' });
  } catch (err) {
    // إذا فشل HTML، أرسل بدون تنسيق
    console.warn('⚠️ فشل HTML، إرسال بنص عادي:', err.message);
    const cleanText = text
      .replace(/<b>/g, '').replace(/<\/b>/g, '')
      .replace(/<i>/g, '').replace(/<\/i>/g, '')
      .replace(/<u>/g, '').replace(/<\/u>/g, '')
      .replace(/<s>/g, '').replace(/<\/s>/g, '')
      .replace(/<code>/g, '').replace(/<\/code>/g, '')
      .replace(/<pre>/g, '').replace(/<\/pre>/g, '')
      .replace(/<a[^>]*>/g, '').replace(/<\/a>/g, '')
      .replace(/<spoiler>/g, '').replace(/<\/spoiler>/g, '')
      .replace(/<blockquote>/g, '').replace(/<\/blockquote>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    return await bot.sendMessage(chatId, cleanText, { ...options, parse_mode: undefined });
  }
}

// ==========================================
// إنشاء البوت
// ==========================================

let bot;

if (BOT_MODE === 'webhook') {
  bot = new TelegramBot(TELEGRAM_TOKEN, { webHook: true });
  bot.setWebHook(`${WEBHOOK_URL}/bot${TELEGRAM_TOKEN}`);
  console.log(`✅ Webhook تم تعيينه: ${WEBHOOK_URL}/bot...`);
} else {
  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  console.log('✅ البوت يعمل بوضع Polling...');
}

// ==========================================
// خادم Express (للـ Webhook + Health Check)
// ==========================================

const app = express();
app.use(express.json());

// نقطة فحص الصحة - مهمة لـ Render
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    bot: 'running',
    mode: BOT_MODE,
    timestamp: new Date().toISOString()
  });
});

// نقطة نهاية الـ Webhook
if (BOT_MODE === 'webhook') {
  app.post(`/bot${TELEGRAM_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
}

app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
});

// ==========================================
// معالجة الأوامر
// ==========================================

// أمر /start - الترحيب
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'صديقي';

  const welcome = `مرحباً ${escapeHTML(name)}! 🤖✨\n\n${WELCOME_MESSAGE}\n\n📋 الأوامر المتاحة:\n/start - الترحيب\n/help - المساعدة\n/img [وصف] - توليد صورة\n/clear - مسح المحادثة\n\n💡 فقط اكتب رسالتك وسأجيبك!`;

  bot.sendMessage(chatId, welcome, {
    reply_markup: {
      keyboard: [['💬 سؤال', '🖼️ صورة'], ['/help']],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  });
});

// أمر /help - المساعدة
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;

  const help = `📖 دليل الاستخدام\n\n`
    + `💬 محادثة عادية: فقط اكتب رسالتك وسأجيبك\n`
    + `🖼️ توليد صورة: /img وصف الصورة\n`
    + `   مثال: /img قطة لطيفة في حديقة\n`
    + `🧹 مسح المحادثة: /clear\n`
    + `📊 حالة البوت: /status\n\n`
    + `البوت يجيب بنفس لغة سؤالك!`;

  bot.sendMessage(chatId, help);
});

// أمر /status - حالة البوت
bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  bot.sendMessage(chatId,
    `📊 حالة البوت\n\n`
    + `✅ يعمل بشكل طبيعي\n`
    + `⏱️ مدة التشغيل: ${hours}س ${minutes}د\n`
    + `🔧 الوضع: ${BOT_MODE}\n`
    + `📡 المنفذ: ${PORT}`
  );
});

// أمر /img - توليد صورة
bot.onText(/\/img\s+(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const prompt = match[1];

  const waitMsg = await bot.sendMessage(chatId, '🎨 جاري توليد الصورة...');

  try {
    const imageBuffer = await generateImage(prompt);

    if (imageBuffer) {
      await bot.sendPhoto(chatId, imageBuffer, {
        caption: `🖼️ الصورة المطلوبة: "${prompt}"`
      });
    } else {
      await bot.sendMessage(chatId, '❌ لم أتمكن من توليد الصورة. حاول مرة أخرى.');
    }
  } catch (error) {
    console.error('خطأ في توليد الصورة:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ أثناء توليد الصورة.');
  }

  try {
    await bot.deleteMessage(chatId, waitMsg.message_id);
  } catch (e) { /* ignore */ }
});

// أمر /clear - مسح المحادثة
bot.onText(/\/clear/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '🧹 تم مسح سياق المحادثة!\nابدأ سؤالاً جديداً 🚀');
});

// ==========================================
// معالجة الرسائل العادية
// ==========================================

bot.on('message', async (msg) => {
  // تجاهل الأوامر
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const userText = msg.text;
  const userName = msg.from.first_name || '';

  // إرسال مؤشر الكتابة
  bot.sendChatAction(chatId, 'typing');

  try {
    // الحصول على رد الذكاء الاصطناعي
    const reply = await getAIResponse(userText, userName);

    // تنسيق الرد: تنظيف HTML من رد AI ثم لف الكود بـ pre/code
    const safeReply = formatAIResponse(reply);

    // تقسيم الرسالة إذا كانت طويلة جداً
    if (safeReply.length <= MAX_MESSAGE_LENGTH) {
      await safeSendMessage(chatId, safeReply);
    } else {
      const chunks = splitMessage(safeReply, MAX_MESSAGE_LENGTH);
      for (const chunk of chunks) {
        await safeSendMessage(chatId, chunk);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

  } catch (error) {
    console.error('❌ خطأ في معالجة الرسالة:', error);
    await bot.sendMessage(chatId, '⚠️ حدث خطأ تقني. حاول مرة أخرى لاحقاً.');
  }
});

// ==========================================
// معالجة الصور المرسلة من المستخدم
// ==========================================

bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const caption = msg.caption || 'ما هذه الصورة؟';

  bot.sendChatAction(chatId, 'typing');

  try {
    const reply = await getAIResponse(
      `المستخدم أرسل صورة وقال: "${caption}". أخبره أنك حالياً لا تستطيع رؤية الصور، لكن يمكنك مساعدته نصياً.`
    );
    const safeReply = formatAIResponse(reply);
    await safeSendMessage(chatId, safeReply);
  } catch (error) {
    await bot.sendMessage(chatId, '⚠️ حدث خطأ في معالجة الصورة.');
  }
});

// ==========================================
// دوال تنسيق الرد
// ==========================================

/**
 * تنسيق رد الذكاء الاصطناعي ليتوافق مع HTML تليجرام
 * - يهرب أي HTML غير مدعوم
 * - يحافظ على كود blocks بـ <pre><code>
 * - يحافظ على bold بـ <b>
 */
function formatAIResponse(text) {
  // حفظ code blocks مؤقتاً
  const codeBlocks = [];
  let processed = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    const index = codeBlocks.length;
    codeBlocks.push(`<pre><code>${escapeHTML(code.trim())}</code></pre>`);
    return `%%CODEBLOCK_${index}%%`;
  });

  // حفظ inline code
  const inlineCodes = [];
  processed = processed.replace(/`([^`]+)`/g, (match, code) => {
    const index = inlineCodes.length;
    inlineCodes.push(`<code>${escapeHTML(code)}</code>`);
    return `%%INLINE_${index}%%`;
  });

  // حفظ bold markdown **text**
  processed = processed.replace(/\*\*([^*]+)\*\*/g, (match, text) => {
    return `<b>${escapeHTML(text)}</b>`;
  });

  // حفظ italic markdown *text*
  processed = processed.replace(/\*([^*]+)\*/g, (match, text) => {
    return `<i>${escapeHTML(text)}</i>`;
  });

  // الآن تهريب باقي HTML في النص العادي
  // لكن لا نهرب ما أضفناه من علامات
  const parts = processed.split(/(%%(?:CODEBLOCK|INLINE)_\d+%%)/);
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i].match(/%%(?:CODEBLOCK|INLINE)_\d+%%/) && !parts[i].includes('<b>') && !parts[i].includes('<i>')) {
      parts[i] = escapeHTML(parts[i]);
    }
  }
  processed = parts.join('');

  // إرجاع code blocks
  for (let i = 0; i < codeBlocks.length; i++) {
    processed = processed.replace(`%%CODEBLOCK_${i}%%`, codeBlocks[i]);
  }

  // إرجاع inline code
  for (let i = 0; i < inlineCodes.length; i++) {
    processed = processed.replace(`%%INLINE_${i}%%`, inlineCodes[i]);
  }

  return processed;
}

/**
 * تقسيم رسالة طويلة إلى أجزاء
 */
function splitMessage(text, maxLength) {
  const chunks = [];
  let current = '';

  const lines = text.split('\n');

  for (const line of lines) {
    if (current.length + line.length + 1 > maxLength) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = current ? current + '\n' + line : line;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

// ==========================================
// معالجة الأخطاء العامة
// ==========================================

bot.on('polling_error', (error) => {
  console.error('⚠️ خطأ Polling:', error.message);
});

bot.on('webhook_error', (error) => {
  console.error('⚠️ خطأ Webhook:', error.message);
});

process.on('uncaughtException', (error) => {
  console.error('🔴 خطأ غير معالج:', error.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('🔴 رفض غير معالج:', reason);
});

console.log('🤖 بوت تليجرام الذكاء الاصطناعي جاهز!');
