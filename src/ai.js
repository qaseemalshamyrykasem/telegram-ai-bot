/**
 * وحدة الذكاء الاصطناعي
 * تتصل بـ z-ai-web-dev-sdk لإنتاج الردود
 */

import ZAI from 'z-ai-web-dev-sdk';

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

    // رسائل خطأ مخصصة
    if (error.message?.includes('rate limit') || error.message?.includes('429')) {
      return '⏳ تم تجاوز حد الطلبات. انتظر قليلاً وحاول مرة أخرى.';
    }
    if (error.message?.includes('timeout')) {
      return '⏱️ انتهت مهلة الاتصال. حاول مرة أخرى.';
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
