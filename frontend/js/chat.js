/* ════════════════════════════════════════
   FLOATING CHATBOT
════════════════════════════════════════ */
let chatOpen = false;
let chatMode = 'study';
let chatHistory = [];
let chatSessionId = null;
let chatSubject = '선형대수학';
let chatStreaming = false;
let chatUnread = 1;

function chatToggle() {
  chatOpen = !chatOpen;
  const win = document.getElementById('chatWindow');
  const fab = document.getElementById('chatFab');
  win.classList.toggle('open', chatOpen);
  fab.classList.toggle('open', chatOpen);

  if (chatOpen) {
    chatUnread = 0;
    document.getElementById('chatFabBadge').classList.add('hidden');
    setTimeout(() => document.getElementById('chatInput').focus(), 250);
  }
}

function chatSetMode(mode) {
  chatMode = mode;
  document.getElementById('modeStudy').classList.toggle('active', mode === 'study');
  document.getElementById('modeTest').classList.toggle('active', mode === 'test');
  document.getElementById('chatScoreBar').style.display = 'none';
  document.getElementById('chatChips').style.display = mode === 'study' ? 'flex' : 'none';

  chatHistory = [];
  chatSessionId = null;

  if (mode === 'test') {
    chatAddMsg('ai', '테스트 모드예요! 아무 말이나 입력하면 첫 문제를 드릴게요.');
  } else {
    chatAddMsg('ai', '학습 모드예요. 궁금한 개념을 자유롭게 질문해보세요!');
  }
}

async function chatInitSession() {
  try {
    const params = new URLSearchParams({ mode: chatMode, subject: chatSubject });
    const res = await fetch(`/api/v1/chat/sessions?${params}`, { method: 'POST' });
    const data = await res.json();
    chatSessionId = data.session_id;
  } catch (e) {
    console.warn('Session init failed', e);
  }
}

async function chatSaveHistory() {
  if (!chatSessionId) return;
  try {
    await fetch(`/api/v1/chat/sessions/${chatSessionId}/messages`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatHistory),
    });
  } catch (e) {
    console.warn('History save failed', e);
  }
}

function chatAddMsgStreaming(role) {
  const wrap = document.getElementById('chatMessages');
  const el = document.createElement('div');
  el.className = `chat-msg ${role}`;
  const av = document.createElement('div');
  av.className = 'chat-msg-av';
  av.textContent = role === 'ai' ? 'AI' : '나';
  const body = document.createElement('div');
  body.className = 'chat-msg-body';
  el.appendChild(av);
  el.appendChild(body);
  wrap.appendChild(el);
  wrap.scrollTop = wrap.scrollHeight;

  if (!chatOpen && role === 'ai') {
    chatUnread++;
    const badge = document.getElementById('chatFabBadge');
    badge.textContent = chatUnread;
    badge.classList.remove('hidden');
  }
  return body;
}

async function chatCallStream(text) {
  if (chatStreaming) return;
  chatStreaming = true;

  if (!chatSessionId) {
    await chatInitSession();
  }

  chatHistory.push({ role: 'user', content: text });
  chatShowTyping();

  try {
    const resp = await fetch('/api/v1/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: chatSessionId,
        mode: chatMode,
        subject: chatSubject,
        message: text,
        history: chatHistory.slice(0, -1),
      }),
    });

    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    chatRemoveTyping();
    const bodyEl = chatAddMsgStreaming('ai');
    const wrap = document.getElementById('chatMessages');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') break;
        try {
          const { text: chunk } = JSON.parse(payload);
          fullText += chunk;
          bodyEl.innerHTML = fullText.replace(/\n/g, '<br>');
          wrap.scrollTop = wrap.scrollHeight;
        } catch {}
      }
    }

    if (fullText) {
      chatHistory.push({ role: 'assistant', content: fullText });
      chatSaveHistory();
    }
  } catch (e) {
    chatRemoveTyping();
    chatAddMsg('ai', '연결 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
    console.error('Chat stream error:', e);
    chatHistory.pop();
  } finally {
    chatStreaming = false;
  }
}

function chatSend() {
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text || chatStreaming) return;

  chatAddMsg('user', text);
  input.value = '';
  document.getElementById('chatFabBadge').classList.add('hidden');

  chatCallStream(text);
}

function chatSuggest(text) {
  document.getElementById('chatInput').value = text;
  chatSend();
}

function chatAddMsg(role, html) {
  const wrap = document.getElementById('chatMessages');
  const el = document.createElement('div');
  el.className = `chat-msg ${role}`;
  el.innerHTML = `
    <div class="chat-msg-av">${role === 'ai' ? 'AI' : '나'}</div>
    <div class="chat-msg-body">${html.replace(/\n/g,'<br>')}</div>`;
  wrap.appendChild(el);
  wrap.scrollTop = wrap.scrollHeight;

  if (!chatOpen && role === 'ai') {
    chatUnread++;
    const badge = document.getElementById('chatFabBadge');
    badge.textContent = chatUnread;
    badge.classList.remove('hidden');
  }
}

function chatShowTyping() {
  const wrap = document.getElementById('chatMessages');
  const el = document.createElement('div');
  el.className = 'chat-msg ai chat-typing';
  el.id = 'chatTyping';
  el.innerHTML = `
    <div class="chat-msg-av">AI</div>
    <div class="chat-msg-body">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;
  wrap.appendChild(el);
  wrap.scrollTop = wrap.scrollHeight;
}

function chatRemoveTyping() {
  const el = document.getElementById('chatTyping');
  if (el) el.remove();
}

function chatClear() {
  document.getElementById('chatMessages').innerHTML = `
    <div class="chat-msg ai">
      <div class="chat-msg-av">AI</div>
      <div class="chat-msg-body">대화가 초기화됐어요. 다시 시작해볼까요?</div>
    </div>`;
  chatHistory = [];
  chatSessionId = null;
}

// ESC로 닫기
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('courseDetailModal')?.style.display === 'flex') cdClose();
    else if (chatOpen) chatToggle();
  }
});
