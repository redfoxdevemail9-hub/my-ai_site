// ============================================================
// script.js
// - مفتاح الـ API الخاص بكل زائر يُحفظ في sessionStorage فقط
//   (يزول تلقائياً عند إغلاق التبويب/المتصفح) — لا يُرسل لأي
//   مكان غير "/api/chat" الخاص بموقعنا مباشرة مع كل طلب.
// - يعرض الأكواد داخل صناديق منسّقة مع زر نسخ واسم اللغة.
// - يحاكي الكتابة الحرفية السريعة أثناء استقبال الرد.
// ============================================================

const messagesEl = document.getElementById('messages');
const emptyState = document.getElementById('emptyState');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const keyBtn = document.getElementById('keyBtn');

const keyModal = document.getElementById('keyModal');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const keyError = document.getElementById('keyError');

const SESSION_KEY_NAME = 'redfoxiq_api_key';
const HISTORY_KEY_NAME = 'redfoxiq_history';

let history = JSON.parse(sessionStorage.getItem(HISTORY_KEY_NAME) || '[]');

// ---------- إدارة مفتاح API (بالذاكرة المؤقتة فقط) ----------
function getApiKey() {
  return sessionStorage.getItem(SESSION_KEY_NAME) || '';
}

function setApiKey(key) {
  sessionStorage.setItem(SESSION_KEY_NAME, key);
}

function openKeyModal() {
  apiKeyInput.value = getApiKey();
  keyError.textContent = '';
  keyModal.classList.add('visible');
  setTimeout(() => apiKeyInput.focus(), 50);
}

function closeKeyModal() {
  keyModal.classList.remove('visible');
}

saveKeyBtn.addEventListener('click', () => {
  const value = apiKeyInput.value.trim();
  if (!value) {
    keyError.textContent = 'الرجاء إدخال مفتاح صالح.';
    return;
  }
  setApiKey(value);
  closeKeyModal();
});

keyBtn.addEventListener('click', openKeyModal);

// أول زيارة بدون مفتاح؟ اعرض النافذة تلقائياً
if (!getApiKey()) {
  openKeyModal();
}

// ---------- عرض الرسائل ----------
function hideEmptyState() {
  if (emptyState) emptyState.style.display = 'none';
}

function renderHistory() {
  history.forEach((msg) => {
    const row = createMessageRow(msg.role);
    row.querySelector('.bubble').innerHTML = formatContent(msg.content);
    messagesEl.appendChild(row);
  });
  scrollToBottom();
}

function createMessageRow(role) {
  const row = document.createElement('div');
  row.className = `msg-row ${role === 'user' ? 'user' : 'bot'}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  row.appendChild(bubble);
  return row;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ---------- تنسيق المحتوى: تحويل ```lang ... ``` إلى صناديق كود ----------
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

let codeBlockCounter = 0;

function formatContent(text) {
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let result = '';
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const plain = text.slice(lastIndex, match.index);
    if (plain) result += `<span class="plain-text">${escapeHtml(plain)}</span>`;

    const lang = (match[1] || 'text').trim();
    const code = match[2].replace(/\n$/, '');
    const id = `code-${Date.now()}-${codeBlockCounter++}`;

    result += `
      <div class="code-block">
        <div class="code-header">
          <span class="code-lang">${escapeHtml(lang || 'text')}</span>
          <button class="copy-btn" data-target="${id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>نسخ</span>
          </button>
        </div>
        <pre><code id="${id}">${escapeHtml(code)}</code></pre>
      </div>
    `;
    lastIndex = codeBlockRegex.lastIndex;
  }

  const remaining = text.slice(lastIndex);
  if (remaining) result += `<span class="plain-text">${escapeHtml(remaining)}</span>`;

  return result || escapeHtml(text);
}

// تفويض النقر على أزرار النسخ (تعمل حتى للعناصر المضافة لاحقاً)
messagesEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.copy-btn');
  if (!btn) return;

  const targetId = btn.getAttribute('data-target');
  const codeEl = document.getElementById(targetId);
  if (!codeEl) return;

  navigator.clipboard.writeText(codeEl.textContent).then(() => {
    btn.classList.add('copied');
    const label = btn.querySelector('span:last-child');
    const original = label.textContent;
    label.textContent = 'تم النسخ';
    setTimeout(() => {
      btn.classList.remove('copied');
      label.textContent = original;
    }, 1500);
  });
});

// ---------- إرسال الرسائل ----------
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const prompt = userInput.value.trim();
  if (!prompt) return;

  const apiKey = getApiKey();
  if (!apiKey) {
    openKeyModal();
    return;
  }

  hideEmptyState();

  // عرض رسالة المستخدم
  const userRow = createMessageRow('user');
  userRow.querySelector('.bubble').textContent = prompt;
  messagesEl.appendChild(userRow);
  scrollToBottom();

  history.push({ role: 'user', content: prompt });
  sessionStorage.setItem(HISTORY_KEY_NAME, JSON.stringify(history));

  userInput.value = '';
  autoResize();
  sendBtn.disabled = true;

  // فقاعة "جاري الكتابة"
  const botRow = createMessageRow('bot');
  const botBubble = botRow.querySelector('.bubble');
  botBubble.classList.add('thinking');
  botBubble.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
  messagesEl.appendChild(botRow);
  scrollToBottom();

  let rawText = '';
  let displayedText = '';
  let typingQueue = Promise.resolve();

  function enqueueTyping(newChunk) {
    typingQueue = typingQueue.then(() => typeChunk(newChunk));
  }

  function typeChunk(chunk) {
    return new Promise((resolve) => {
      let i = 0;
      function step() {
        if (i >= chunk.length) return resolve();
        displayedText += chunk[i];
        botBubble.innerHTML = formatContent(displayedText);
        scrollToBottom();
        i++;
        setTimeout(step, 8); // سرعة الكتابة الحرفية
      }
      step();
    });
  }

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Api-Key': apiKey,
      },
      body: JSON.stringify({ prompt, history: history.slice(0, -1) }),
    });

    if (response.status === 401 || response.status === 403) {
      botBubble.classList.remove('thinking');
      botBubble.textContent = 'مفتاح API غير صالح أو منتهي. حاول تحديثه من زر المفتاح بالأعلى.';
      sendBtn.disabled = false;
      return;
    }

    if (!response.ok || !response.body) {
      botBubble.classList.remove('thinking');
      botBubble.textContent = 'حدث خطأ أثناء الاتصال، حاول مرة أخرى.';
      sendBtn.disabled = false;
      return;
    }

    botBubble.classList.remove('thinking');
    botBubble.innerHTML = '';

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
            rawText += json.content;
            enqueueTyping(json.content);
          }
          if (json.error) {
            botBubble.textContent = 'حدث خطأ: ' + json.error;
          }
        } catch (err) {
          // تجاهل أسطر غير صالحة
        }
      }
    }

    await typingQueue;

    history.push({ role: 'assistant', content: rawText });
    sessionStorage.setItem(HISTORY_KEY_NAME, JSON.stringify(history));
  } catch (err) {
    botBubble.classList.remove('thinking');
    botBubble.textContent = 'تعذر الاتصال بالخادم.';
  } finally {
    sendBtn.disabled = false;
  }
});

// ---------- مسح المحادثة ----------
clearBtn.addEventListener('click', () => {
  history = [];
  sessionStorage.removeItem(HISTORY_KEY_NAME);
  messagesEl.innerHTML = '';
  const fresh = document.createElement('div');
  fresh.className = 'empty-state';
  fresh.id = 'emptyState';
  fresh.innerHTML = '<div class="empty-mark">RF</div><p>ابدأ محادثة جديدة مع RedFoxiq</p>';
  messagesEl.appendChild(fresh);
});

// ---------- تكبير مربع الكتابة تلقائياً ----------
function autoResize() {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 140) + 'px';
}

userInput.addEventListener('input', autoResize);

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

// عرض المحادثة المحفوظة بهذه الجلسة (إن وجدت) عند فتح الصفحة
if (history.length > 0) {
  hideEmptyState();
  renderHistory();
}
