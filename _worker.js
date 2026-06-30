// index.js – Cloudflare Worker with built-in chat UI

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
  <title>GLM Chat</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #1e1e2f;
      color: #e4e4e7;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 1rem;
    }
    .chat-container {
      max-width: 800px;
      width: 100%;
      background: #2a2a3c;
      border-radius: 24px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      height: 90vh;
      max-height: 700px;
    }
    .header {
      padding: 1.2rem 1.5rem;
      background: #3b3b55;
      border-bottom: 1px solid #4a4a66;
      font-weight: 600;
      font-size: 1.2rem;
      letter-spacing: 0.3px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header span {
      background: #6c6c8a;
      padding: 4px 12px;
      border-radius: 40px;
      font-size: 0.7rem;
      font-weight: 400;
      color: #d0d0e0;
    }
    .messages {
      flex: 1;
      padding: 1.5rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      background: #232338;
    }
    .message {
      max-width: 85%;
      padding: 0.8rem 1.2rem;
      border-radius: 18px;
      line-height: 1.5;
      word-wrap: break-word;
      animation: fadeIn 0.25s ease;
    }
    .message.user {
      align-self: flex-end;
      background: #6c5ce7;
      color: white;
      border-bottom-right-radius: 6px;
    }
    .message.assistant {
      align-self: flex-start;
      background: #3b3b55;
      border-bottom-left-radius: 6px;
    }
    .message .loader {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255,255,255,0.2);
      border-top: 3px solid #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

    .input-area {
      padding: 1rem 1.5rem 1.5rem;
      background: #2a2a3c;
      border-top: 1px solid #3b3b55;
      display: flex;
      gap: 0.8rem;
    }
    .input-area textarea {
      flex: 1;
      padding: 0.8rem 1rem;
      border: 1px solid #4a4a66;
      border-radius: 40px;
      background: #1e1e2f;
      color: #e4e4e7;
      font-size: 0.95rem;
      resize: none;
      outline: none;
      transition: border 0.2s;
      font-family: inherit;
      min-height: 50px;
      max-height: 120px;
    }
    .input-area textarea:focus {
      border-color: #6c5ce7;
    }
    .input-area button {
      background: #6c5ce7;
      border: none;
      color: white;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      font-size: 1.8rem;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .input-area button:hover { background: #7d6ff0; }
    .input-area button:active { transform: scale(0.94); }
    .input-area button:disabled {
      opacity: 0.5;
      pointer-events: none;
    }
    .footer {
      text-align: center;
      font-size: 0.7rem;
      color: #6a6a88;
      padding: 0.4rem 0 0.8rem;
    }
  </style>
</head>
<body>
<div class="chat-container">
  <div class="header">
    💬 GLM‑4.7‑Flash
    <span>AI</span>
  </div>
  <div class="messages" id="messageContainer"></div>
  <div class="input-area">
    <textarea id="userInput" rows="1" placeholder="Ask something…"></textarea>
    <button id="sendBtn" aria-label="Send">➤</button>
  </div>
  <div class="footer">Streaming responses • powered by Workers AI</div>
</div>

<script>
  (function() {
    const messageContainer = document.getElementById('messageContainer');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');

    let isWaiting = false;

    // ----- Append a message to the UI -----
    function appendMessage(role, content, isPartial = false) {
      const div = document.createElement('div');
      div.className = \`message \${role}\`;
      if (isPartial) {
        div.id = 'partial-message';
      }
      div.textContent = content;
      messageContainer.appendChild(div);
      messageContainer.scrollTop = messageContainer.scrollHeight;
      return div;
    }

    // ----- Update partial message (streaming) -----
    function updatePartial(content) {
      let partial = document.getElementById('partial-message');
      if (!partial) {
        // If no partial exists, create one (edge case)
        partial = appendMessage('assistant', '', true);
      }
      partial.textContent = content;
      messageContainer.scrollTop = messageContainer.scrollHeight;
    }

    // ----- Remove partial message after stream ends -----
    function finalizePartial() {
      const partial = document.getElementById('partial-message');
      if (partial) {
        partial.id = ''; // remove the id so it's no longer considered partial
      }
    }

    // ----- Add a loading spinner (non‑streaming fallback) -----
    function showLoading() {
      const div = appendMessage('assistant', '⏳', false);
      div.classList.add('loading');
      return div;
    }
    function removeLoading(loadingElement) {
      if (loadingElement && loadingElement.parentNode) {
        loadingElement.remove();
      }
    }

    // ----- Send a message to the Worker -----
    async function sendMessage() {
      const text = userInput.value.trim();
      if (!text || isWaiting) return;

      // Display user message
      appendMessage('user', text);
      userInput.value = '';
      userInput.style.height = 'auto';
      sendBtn.disabled = true;
      isWaiting = true;

      // Build conversation history from the UI
      // We'll gather all messages (excluding the partial/loading ones)
      const messageElements = document.querySelectorAll('.message:not(.loading)');
      const messages = [];
      messageElements.forEach(el => {
        // Determine role from class
        const role = el.classList.contains('user') ? 'user' : 'assistant';
        // Skip if it's the loading spinner (already excluded by .loading)
        messages.push({ role, content: el.textContent.trim() });
      });

      try {
        // ----- Call the Worker's /chat endpoint with streaming -----
        const response = await fetch('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, stream: true })
        });

        if (!response.ok) {
          throw new Error(\`HTTP error \${response.status}\`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let partialText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          // The Worker sends SSE-like data: "data: {...}\n\n"
          const lines = chunk.split('\\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const json = JSON.parse(line.slice(6));
                if (json.response) {
                  partialText += json.response;
                  updatePartial(partialText);
                }
                if (json.done) {
                  // Stream finished
                  finalizePartial();
                }
              } catch (e) {
                // ignore parse errors
              }
            }
          }
        }
        // Ensure partial is finalized if not already
        finalizePartial();

      } catch (error) {
        console.error('Chat error:', error);
        // Show error message
        const errorDiv = appendMessage('assistant', '⚠️ Error: ' + error.message);
        // Remove any leftover partial
        const partial = document.getElementById('partial-message');
        if (partial) partial.remove();
      } finally {
        sendBtn.disabled = false;
        isWaiting = false;
        userInput.focus();
        // Remove any lingering loading spinners
        document.querySelectorAll('.loading').forEach(el => el.remove());
      }
    }

    // ----- Event listeners -----
    sendBtn.addEventListener('click', sendMessage);

    userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-resize textarea
    userInput.addEventListener('input', () => {
      userInput.style.height = 'auto';
      userInput.style.height = userInput.scrollHeight + 'px';
    });

    // Focus on load
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

        // Validate messages
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return new Response(JSON.stringify({ error: "Invalid messages" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // If streaming is requested
        if (stream) {
          // Use the streaming API: we'll produce a ReadableStream
          const encoder = new TextEncoder();
          const readableStream = new ReadableStream({
            async start(controller) {
              try {
                const response = await env.AI.run(
                  "@cf/zai-org/glm-4.7-flash",
                  {
                    messages,
                    stream: true,  // Enable server-side streaming
                    max_tokens: 1024,
                    temperature: 0.7,
                  }
                );

                // The AI.run() with stream:true returns an AsyncIterable
                for await (const chunk of response) {
                  // chunk is { response: string } for each token
                  const data = JSON.stringify({ response: chunk.response });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
                // Signal end
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                controller.close();
              } catch (err) {
                controller.error(err);
              }
            }
          });

          return new Response(readableStream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            },
          });
        } else {
          // Non-streaming: one-shot response
          const result = await env.AI.run("@cf/zai-org/glm-4.7-flash", {
            messages,
            max_tokens: 1024,
            temperature: 0.7,
          });
          // result is { response: string } (or may include other fields)
          return new Response(JSON.stringify({ response: result.response }), {
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch (error) {
        console.error("AI error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // ----- 404 for other routes -----
    return new Response("Not Found", { status: 404 });
  },
};
