// ============================================================
//  api/chat.js
//  هذا الملف يشتغل فقط على سيرفر Vercel (خلف الكواليس)
//  المستخدم أو أي زائر لا يقدر يشوف محتواه أو المفتاح إطلاقاً
// ============================================================

export default async function handler(req, res) {
  // نسمح فقط بطلبات POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, history } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt parameter is missing' });
    }

    // المفتاح يُقرأ من Environment Variables في Vercel
    // لا يظهر أبداً في الكود أو في الشبكة (Network tab)
    const apiKey = process.env.OLLAMA_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Server misconfiguration: missing API key' });
    }

    const targetModel = 'gemma4:31b';
    const systemPrompt = 'اسمك هو RedFoxiq'; // غيّره لاسم موقعك

    // بناء الرسائل: system + التاريخ السابق (إن وجد) + الرسالة الجديدة
    const messages = [{ role: 'system', content: systemPrompt }];

    if (Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role !== 'system') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    messages.push({ role: 'user', content: prompt });

    // إرسال الطلب الحقيقي إلى Ollama من طرف السيرفر (مخفي تماماً عن المستخدم)
    const ollamaResponse = await fetch('https://ollama.com/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: targetModel,
        messages,
        stream: true,
      }),
    });

    if (!ollamaResponse.ok || !ollamaResponse.body) {
      const errText = await ollamaResponse.text();
      return res.status(502).json({ error: 'Upstream error', details: errText });
    }

    // إعداد الاستجابة كـ Stream (SSE) للموقع
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = ollamaResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // نحتفظ بالسطر غير المكتمل

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const json = JSON.parse(trimmed);
          const text = json?.message?.content;
          if (text) {
            // نرسل فقط النص للواجهة، بدون أي تفاصيل عن Ollama أو المفتاح
            res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
          }
        } catch (e) {
          // تجاهل الأسطر غير الصالحة JSON
        }
      }
    }

    res.end();
  } catch (error) {
    console.error('Server error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.end();
    }
  }
}

