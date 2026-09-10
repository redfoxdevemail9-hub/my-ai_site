// ============================================================
// هذا الملف يتواصل فقط مع "/api/chat" الخاص بموقعنا.
// لا يوجد هنا أي رابط لـ ollama.com ولا أي مفتاح API إطلاقاً.
// أي شخص يفتح Network Tab بالمتصفح يشوف فقط طلبات لـ /api/chat
// ============================================================

const messagesEl = document.getElementById('messages');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');

let history = JSON.parse(localStorage.getItem('chatHistory') || '[]');

// عرض الرسائل المحفوظة سابقاً عند فتح الصفحة
history.forEach((msg) => addMessage(msg.role, msg.content, false));

function addMessage(role, content, save = true) {
  const div = document.createElement('div');
  div.className = `msg ${role === 'user' ? 'user' : 'bot'}`;
  div.textContent = content;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  if (save) {
    history.push({ role: role === 'user' ? 'user' : 'assistant', content });
    localStorage.setItem('chatHistory', JSON.stringify(history));
  }
  return div;
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const prompt = userInput.value.trim();
  if (!prompt) return;

  addMessage('user', prompt);
  userInput.value = '';
  sendBtn.disabled = true;

  const botDiv = addMessage('bot', '', false);
  let fullText = '';

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, history }),
    });

    if (!response.ok || !response.body) {
      botDiv.textContent = 'حدث خطأ، حاول مرة أخرى.';
      sendBtn.disabled = false;
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const json = JSON.parse(line.slice(6));
          if (json.content) {
            fullText += json.content;
            botDiv.textContent = fullText;
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        } catch (err) {
          // تجاهل أي سطر غير صالح
        }
      }
    }

    // حفظ رد البوت الكامل في السجل بعد انتهاء الـ stream
    history.push({ role: 'assistant', content: fullText });
    localStorage.setItem('chatHistory', JSON.stringify(history));
  } catch (err) {
    botDiv.textContent = 'تعذر الاتصال بالخادم.';
  } finally {
    sendBtn.disabled = false;
  }
});

clearBtn.addEventListener('click', () => {
  history = [];
  localStorage.removeItem('chatHistory');
  messagesEl.innerHTML = '';
});
