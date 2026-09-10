// ============================================================
//  api/chat.js
//  هذا الملف يشتغل فقط على سيرفر Vercel (خلف الكواليس).
//  كل زائر يرسل مفتاحه الخاص عبر الهيدر X-User-Api-Key، ونستخدمه
//  فقط لتمرير الطلب إلى Ollama لحظياً — لا يُخزَّن هنا ولا في أي
//  قاعدة بيانات أو ملف؛ يعيش فقط طوال مدة هذا الطلب بالذاكرة.
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, history } = req.body;
    const apiKey = req.headers['x-user-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(401).json({ error: 'API key is missing' });
    }

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt parameter is missing' });
    }

    const targetModel = 'gemma4:31b';
    const systemPrompt = 'اسمك هو RedFoxiq';

    const messages = [{ role: 'system', content: systemPrompt }];

    if (Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role !== 'system') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    messages.push({ role: 'user', content: prompt });

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

    if (ollamaResponse.status === 401 || ollamaResponse.status === 403) {
      return res.status(401).json({ error: 'Invalid or expired API key' });
    }

    if (!ollamaResponse.ok || !ollamaResponse.body) {
      const errText = await ollamaResponse.text();
      return res.status(502).json({ error: 'Upstream error', details: errText });
    }

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
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const json = JSON.parse(trimmed);
          const text = json?.message?.content;
          if (text) {
            res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
          }
        } catch (e) {
          // تجاهل الأسطر غير الصالحة
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
