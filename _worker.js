// _worker.js – GLM Chat with correct streaming (return ReadableStream directly)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ----- Serve the HTML chat interface -----
    if (url.pathname === "/" && request.method === "GET") {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>🧠 GLM Chat</title>
  <style>
    /* ----- RESET & BASE ----- */
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: radial-gradient(circle at 10% 20%, #1a1a2e, #0f0f1a);
      color: #eaeaea;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 1rem;
      margin: 0;
    }

    /* ----- CHAT CONTAINER ----- */
    .chat-wrapper {
      width: 100%;
      max-width: 880px;
      height: 92vh;
      max-height: 780px;
      background: rgba(30, 30, 48, 0.75);
      backdrop-filter: blur(12px);
      border-radius: 32px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.04);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: all 0.2s;
    }

    /* ----- HEADER ----- */
    .chat-header {
      padding: 1.2rem 1.8rem;
      background: rgba(45, 45, 70, 0.6);
      backdrop-filter: blur(4px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: center;
      gap: 0.8rem;
      flex-shrink: 0;
    }
    .chat-header h1 {
      font-size: 1.3rem;
      font-weight: 600;
      letter-spacing: 0.2px;
      background: linear-gradient(135deg, #b4a5ff, #7d6ff0);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .chat-header .badge {
      background: rgba(108, 92, 231, 0.25);
      padding: 0.2rem 0.9rem;
      border-radius: 40px;
      font-size: 0.7rem;
      font-weight: 500;
      letter-spacing: 0.4px;
      color: #c4b5ff;
      border: 1px solid rgba(108, 92, 231, 0.2);
      margin-left: auto;
    }
    .status-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #4ade80;
      margin-right: 6px;
      animation: pulse-dot 2s infinite;
    }
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.8); }
    }

    /* ----- MESSAGE AREA ----- */
    .messages {
      flex: 1;
      padding: 1.5rem 1.8rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      background: rgba(0, 0, 0, 0.15);
      scroll-behavior: smooth;
    }
    .messages::-webkit-scrollbar {
      width: 5px;
    }
    .messages::-webkit-scrollbar-track {
      background: transparent;
    }
    .messages::-webkit-scrollbar-thumb {
      background: rgba(108, 92, 231, 0.4);
      border-radius: 20px;
    }

    /* ----- MESSAGE BUBBLES ----- */
    .message {
      max-width: 80%;
      padding: 0.8rem 1.3rem;
      border-radius: 20px;
      line-height: 1.6;
      word-wrap: break-word;
      animation: fadeSlide 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      font-size: 0.95rem;
      position: relative;
    }
    .message.user {
      align-self: flex-end;
      background: linear-gradient(135deg, #6c5ce7, #a78bfa);
      color: white;
      border-bottom-right-radius: 6px;
    }
    .message.assistant {
      align-self: flex-start;
      background: rgba(55, 55, 80, 0.8);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255,255,255,0.05);
      border-bottom-left-radius: 6px;
      color: #e8e8f0;
    }
    .message.assistant .loader {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2.5px solid rgba(255,255,255,0.15);
      border-top: 2.5px solid #a78bfa;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeSlide {
      from { opacity:0; transform: translateY(10px) scale(0.96); }
      to { opacity:1; transform: translateY(0) scale(1); }
    }

    /* Partial (streaming) message gets a subtle pulse */
    .message.partial {
      border-left: 3px solid #a78bfa;
    }

    /* ----- INPUT AREA ----- */
    .input-area {
      padding: 1rem 1.8rem 1.5rem;
      background: rgba(20, 20, 35, 0.7);
      backdrop-filter: blur(4px);
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      gap: 0.8rem;
      align-items: flex-end;
      flex-shrink: 0;
    }
    .input-area textarea {
      flex: 1;
      padding: 0.8rem 1.2rem;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 28px;
      background: rgba(255, 255, 255, 0.04);
      color: #eaeaea;
      font-size: 0.95rem;
      resize: none;
      outline: none;
      transition: border 0.25s, background 0.2s;
      font-family: inherit;
      min-height: 52px;
      max-height: 140px;
      line-height: 1.5;
    }
    .input-area textarea:focus {
      border-color: #6c5ce7;
      background: rgba(255, 255, 255, 0.07);
    }
    .input-area textarea::placeholder {
      color: #6a6a88;
    }
    .input-area button {
      background: linear-gradient(135deg, #6c5ce7, #8b7bf7);
      border: none;
      color: white;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      font-size: 1.5rem;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 4px 14px rgba(108, 92, 231, 0.3);
    }
    .input-area button:hover:not(:disabled) {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(108, 92, 231, 0.5);
    }
    .input-area button:active:not(:disabled) {
      transform: scale(0.92);
    }
    .input-area button:disabled {
      opacity: 0.4;
      pointer-events: none;
      filter: grayscale(0.5);
    }

    /* ----- FOOTER ----- */
    .chat-footer {
      padding: 0.5rem 1.8rem 0.9rem;
      text-align: center;
      font-size: 0.7rem;
      color: #4a4a66;
      border-top: 1px solid rgba(255,255,255,0.02);
      letter-spacing: 0.3px;
      flex-shrink: 0;
    }
    .chat-footer a {
      color: #6c5ce7;
      text-decoration: none;
    }

    @media (max-width: 600px) {
      .chat-wrapper { border-radius: 20px; height: 95vh; max-height: none; }
      .messages { padding: 1rem; }
      .input-area { padding: 0.8rem 1rem 1.2rem; flex-wrap: wrap; }
      .input-area textarea { min-height: 44px; }
      .input-area button { width: 46px; height: 46px; font-size: 1.2rem; }
      .message { max-width: 90%; font-size: 0.9rem; }
    }
  </style>
</head>
<body>
<div class="chat-wrapper">
  <div class="chat-header">
    <h1>🧠 GLM‑4.7‑Flash</h1>
    <span class="badge"><span class="status-dot"></span> online</span>
  </div>
  <div class="messages" id="messageContainer"></div>
  <div class="input-area">
    <textarea id="userInput" rows="1" placeholder="Type your message…"></textarea>
    <button id="sendBtn" aria-label="Send">➤</button>
  </div>
  <div class="chat-footer">
    Streaming responses · <a href="https://developers.cloudflare.com/workers-ai/" target="_blank">Workers AI</a>
  </div>
</div>

<script>
  (function() {
    const messageContainer = document.getElementById('messageContainer');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');

    let isWaiting = false;

    function appendMessage(role, content, isPartial = false) {
      const div = document.createElement('div');
      div.className = \`message \${role}\`;
      if (isPartial) {
        div.classList.add('partial');
        div.id = 'partial-message';
      }
      div.textContent = content;
      messageContainer.appendChild(div);
      messageContainer.scrollTop = messageContainer.scrollHeight;
      return div;
    }

    function updatePartial(content) {
      let partial = document.getElementById('partial-message');
      if (!partial) partial = appendMessage('assistant', '', true);
      partial.textContent = content;
      messageContainer.scrollTop = messageContainer.scrollHeight;
    }

    function finalizePartial() {
      const partial = document.getElementById('partial-message');
      if (partial) {
        partial.classList.remove('partial');
        partial.id = '';
      }
    }

    async function sendMessage() {
      const text = userInput.value.trim();
      if (!text || isWaiting) return;

      appendMessage('user', text);
      userInput.value = '';
      userInput.style.height = 'auto';
      sendBtn.disabled = true;
      isWaiting = true;

      // Build conversation history from UI (excluding partial)
      const messageElements = document.querySelectorAll('.message:not(.loading)');
      const messages = [];
      messageElements.forEach(el => {
        const role = el.classList.contains('user') ? 'user' : 'assistant';
        if (el.id === 'partial-message') return;
        const content = el.textContent.trim();
        if (content) messages.push({ role, content });
      });

      try {
        const response = await fetch('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, stream: true })
        });

        if (!response.ok) throw new Error(\`HTTP error \${response.status}\`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let partialText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const json = JSON.parse(line.slice(6));
                // 🔥 FIX: GLM uses delta.reasoning for content
                if (json.choices && json.choices[0] && json.choices[0].delta) {
                  const content = json.choices[0].delta.reasoning || json.choices[0].delta.content || "";
                  if (content) {
                    partialText += content;
                    updatePartial(partialText);
                  }
                }
                if (json.done) {
                  finalizePartial();
                }
              } catch (e) { /* ignore */ }
            }
          }
        }
        finalizePartial();

      } catch (error) {
        console.error('Chat error:', error);
        const partial = document.getElementById('partial-message');
        if (partial) partial.remove();
        appendMessage('assistant', \`⚠️ Error: \${error.message}\`);
      } finally {
        sendBtn.disabled = false;
        isWaiting = false;
        userInput.focus();
      }
    }

    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    userInput.addEventListener('input', () => {
      userInput.style.height = 'auto';
      userInput.style.height = userInput.scrollHeight + 'px';
    });
    userInput.focus();
  })();
</script>
</body>
</html>`;
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // ----- Handle chat requests (POST /chat) -----
    if (url.pathname === "/chat" && request.method === "POST") {
      try {
        const body = await request.json();
        const { messages, stream = false } = body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return new Response(JSON.stringify({ error: "Invalid messages" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (stream) {
          // ✅ CORRECT: `env.AI.run()` with `stream: true` returns a ReadableStream directly.
          const aiStream = await env.AI.run("@cf/zai-org/glm-4.7-flash", {
            messages,
            stream: true,
            max_tokens: 1024,
            temperature: 0.7,
          });

          // Return the stream as SSE – the client will parse it.
          return new Response(aiStream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            },
          });
        } else {
          // Non-streaming: extract from `choices[0].message.content`
          const result = await env.AI.run("@cf/zai-org/glm-4.7-flash", {
            messages,
            max_tokens: 1024,
            temperature: 0.7,
          });
          const content = result.choices?.[0]?.message?.content || "";
          return new Response(JSON.stringify({ response: content }), {
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch (error) {
        console.error('AI error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
