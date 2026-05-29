/**
 * وحدة الذكاء الاصطناعي
 * تتصل بـ z-ai-web-dev-sdk لإنتاج الردود
 */

import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ==========================================
// إنشاء ملف الإعدادات تلقائياً من متغيرات البيئة
// ==========================================

function ensureConfig() {
  const possiblePaths = [
    path.join(process.cwd(), '.z-ai-config'),
    path.join(os.homedir(), '.z-ai-config'),
    '/etc/.z-ai-config'
  ];

  // تحقق إذا كان ملف الإعدادات موجود مسبقاً
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`✅ ملف إعدادات z-ai موجود: ${p}`);
      return;
    }
  }

  // أنشئ الملف من متغيرات البيئة
  const baseUrl = process.env.ZAI_BASE_URL;
  const apiKey = process.env.ZAI_API_KEY;
  const chatId = process.env.ZAI_CHAT_ID;
  const token = process.env.ZAI_TOKEN;
  const userId = process.env.ZAI_USER_ID;

  if (baseUrl && apiKey && token) {
    const config = {
      baseUrl,
      apiKey,
      chatId: chatId || '',
      token,
      userId: userId || ''
    };

    const configPath = path.join(process.cwd(), '.z-ai-config');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`✅ تم إنشاء ملف إعدادات z-ai: ${configPath}`);
  } else {
    console.warn('⚠️ متغيرات بيئة z-ai غير مكتملة. البوت سيعمل لكن الذكاء الاصطناعي لن يتصل.');
    console.warn('⚠️ تأكد من تعيين: ZAI_BASE_URL, ZAI_API_KEY, ZAI_TOKEN');
  }
}

// إنشاء الإعدادات قبل تهيئة SDK
ensureConfig();

// إنشاء نسخة واحدة من الـ SDK (Singleton)
let zaiInstance = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

/**
 * إرسال رسالة للذكاء الاصطناعي والحصول على رد
 * @param {string} userMessage - رسالة المستخدم
 * @param {string} userName - اسم المستخدم (اختياري)
 * @returns {Promise<string>} رد الذكاء الاصطناعي
 */
export async function getAIResponse(userMessage, userName = '') {
  try {
    const zai = await getZAI();

    const systemPrompt = `أنت مساعد ذكي ومفيد. تجيب باللغة التي يكتب بها المستخدم.
كن مختصراً وواضحاً في إجاباتك. إذا سأل المستخدم بالعربية، أجب بالعربية.
إذا سأل بالإنجليزية، أجب بالإنجليزية. كن ودوداً ومهنيّاً.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    const completion = await zai.chat.completions.create({
      messages: messages,
      temperature: 0.7,
      max_tokens: 2048
    });

    const reply = completion.choices?.[0]?.message?.content;

    if (!reply) {
      return 'عذراً، لم أتمكن من إنتاج رد. حاول مرة أخرى.';
    }

    return reply;

  } catch (error) {
    console.error('❌ خطأ في الاتصال بالذكاء الاصطناعي:', error.message);

    if (error.message?.includes('rate limit') || error.message?.includes('429')) {
      return '⏳ تم تجاوز حد الطلبات. انتظر قليلاً وحاول مرة أخرى.';
    }
    if (error.message?.includes('timeout')) {
      return '⏱️ انتهت مهلة الاتصال. حاول مرة أخرى.';
    }
    if (error.message?.includes('Configuration file not found')) {
      return '⚠️ إعدادات الذكاء الاصطناعي غير مكتملة. تواصل مع مطور البوت.';
    }

    return '⚠️ حدث خطأ تقني. حاول مرة أخرى لاحقاً.';
  }
}

/**
 * توليد صورة من وصف نصي
 * @param {string} prompt - وصف الصورة
 * @returns {Promise<Buffer|null>} بيانات الصورة
 */
export async function generateImage(prompt) {
  try {
    const zai = await getZAI();

    const response = await zai.images.generations.create({
      prompt: prompt,
      size: '1024x1024'
    });

    const imageBase64 = response.data?.[0]?.base64;
    if (!imageBase64) return null;

    return Buffer.from(imageBase64, 'base64');

  } catch (error) {
    console.error('❌ خطأ في توليد الصورة:', error.message);
    return null;
  }
}
