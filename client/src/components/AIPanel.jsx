import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Loader2, Trash2, Sparkles } from 'lucide-react';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
const QUICK_ACTIONS = [
  { label: 'Low stock advice', prompt: 'Analyze our current low stock situation and give me prioritized reorder advice.' },
  { label: 'Preorder summary', prompt: 'Give me a summary of our open preorders and what needs attention.' },
  { label: "Today's sales insight", prompt: "Give me insights on today's sales performance and any recommendations." },
  { label: 'Margin analysis', prompt: 'Analyze our product margins by category and suggest where we can improve profitability.' },
  { label: 'VAT reminder', prompt: 'Remind me of the key VAT compliance tasks for this period under Bangladesh NBR rules.' },
  { label: 'Draft payment reminder', prompt: 'Draft a polite but firm payment reminder message for overdue corporate customers.' },
];

function generateSessionId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

export default function AIPanel({ context = null, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm your AI business assistant for Industrial 3D Solution. Ask me about inventory, sales, margins, preorders, or any business question. You can also use the quick actions below." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => generateSessionId());
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const res = await api.post('/ai/chat', { message: msg, session_id: sessionId, context });
      setMessages(prev => [...prev, { role: 'assistant', content: res.response }]);
    } catch (err) {
      toast.error(err.message || 'AI request failed. Check your API key in Settings.');
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ ' + (err.message || 'Failed to get response. Please check AI settings.') }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const clearHistory = () => {
    setMessages([{ role: 'assistant', content: "Chat cleared. How can I help you?" }]);
  };

  return (
    <div className="flex flex-col h-full bg-surface-900 border-l border-surface-800">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-800 flex-shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-brand-600 flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">AI Assistant</div>
          <div className="text-xs text-surface-500">Business insights & advice</div>
        </div>
        <div className="flex gap-1">
          <button onClick={clearHistory} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-500 hover:text-surface-300 transition-colors" title="Clear chat">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-500 hover:text-surface-300 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-3 py-2 border-b border-surface-800 flex-shrink-0">
        <div className="text-xs text-surface-500 mb-2 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Quick Actions</div>
        <div className="flex flex-wrap gap-1">
          {QUICK_ACTIONS.map(a => (
            <button
              key={a.label}
              onClick={() => sendMessage(a.prompt)}
              disabled={loading}
              className="text-xs px-2 py-1 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white border border-surface-700 transition-colors disabled:opacity-50"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-brand-600 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                <Bot className="w-3 h-3 text-white" />
              </div>
            )}
            <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
              <div className="whitespace-pre-wrap text-xs leading-relaxed">{msg.content}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-brand-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <div className="bg-surface-800 border border-surface-700 rounded-2xl rounded-bl-sm px-4 py-2.5">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 bg-surface-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-surface-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-surface-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-surface-800 flex-shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            className="input-field flex-1 text-xs"
            placeholder="Ask anything about your business..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="btn-primary btn-icon flex-shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
