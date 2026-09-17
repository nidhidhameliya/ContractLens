"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import {
  Send, Sparkles, Bot, User, Loader2 } from
"lucide-react";
import ReactMarkdown from "react-markdown";
import Button from "@/components/ui/Button";









const SUGGESTED_QUESTIONS = [
"Which of our contracts have the highest risk this quarter?",
"What's the total potential savings across all pending approvals?",
"Are there any contracts auto-renewing in the next 60 days?",
"Which vendor has the worst price escalation clause?",
"What happened with our last renegotiation?"];


export default function ChatPage() {
  const [messages, setMessages] = useState([
  {
    id: "welcome",
    role: "assistant",
    content:
    "👋 Hi! I'm **ContractLens AI**, your procurement intelligence assistant.\n\nI can answer questions about your contracts, risks, savings opportunities, and past decisions. Ask me anything — like *'Which contracts are up for renewal?'* or *'What's our biggest risk right now?'*",
    timestamp: new Date()
  }]
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    const userMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      content: msg,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.chat({ message: msg });
      const botMsg = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: res.reply,
        context: res.context_used,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e) {
      setMessages((prev) => [
      ...prev,
      {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `⚠️ Sorry, I encountered an error: ${e.message}. Please ensure the backend is running.`,
        timestamp: new Date()
      }]
      );
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex items-center gap-4 px-8 py-5 shrink-0 border-b border-slate-200 bg-white shadow-sm z-10">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
          <Sparkles size={20} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            ContractLens AI Chat
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Ask questions about your contracts, risks, and savings
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 scroll-smooth">
        <div className="w-full max-w-4xl mx-auto space-y-8">
          {messages.map((msg) =>
          <div
            key={msg.id}
            className={`flex gap-4 animate-slide-up ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            
              {/* Avatar */}
              <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm border ${
              msg.role === "assistant" ?
              "bg-blue-50 border-blue-200 text-blue-600" :
              "bg-white border-slate-200 text-slate-500"}`
              }>
              
                {msg.role === "assistant" ? <Bot size={16} /> : <User size={16} />}
              </div>

              {/* Bubble */}
              <div className={`flex flex-col gap-2 max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                className={`px-6 py-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                msg.role === "user" ?
                "bg-blue-600 text-white rounded-tr-sm" :
                "bg-white text-slate-700 border border-slate-200 rounded-tl-sm"}`
                }>
                
                  <ReactMarkdown
                  components={{
                    p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                    a: ({ node, ...props }) => <a className="underline underline-offset-2 font-medium" {...props} />,
                    strong: ({ node, ...props }) => <strong className="font-bold text-slate-900" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
                    li: ({ node, ...props }) => <li className="mb-1" {...props} />
                  }}>
                  
                    {msg.content}
                  </ReactMarkdown>
                </div>

                {/* Context pills */}
                {msg.context && msg.context.length > 0 &&
              <div className="flex flex-wrap gap-2 mt-1">
                    {msg.context.map((c) =>
                <span
                  key={c}
                  className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                  
                        {c.replace(/_/g, " ")}
                      </span>
                )}
                  </div>
              }

                <span className="text-xs font-medium text-slate-400">
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {loading &&
          <div className="flex gap-4 animate-slide-up">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-blue-50 border border-blue-200 text-blue-600 shadow-sm">
                <Bot size={16} />
              </div>
              <div className="px-5 py-4 rounded-2xl rounded-tl-sm bg-white border border-slate-200 shadow-sm flex items-center gap-3">
                <Loader2 size={16} className="animate-spin text-blue-600" />
                <span className="text-sm font-medium text-slate-500">
                  Thinking…
                </span>
              </div>
            </div>
          }

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Suggested questions — show only at start */}
      {messages.length === 1 &&
      <div className="px-6 pb-4 max-w-4xl mx-auto w-full">
          <div className="w-full">
            <p className="text-xs mb-3 font-bold uppercase tracking-wider text-slate-500">
              Try asking:
            </p>
            <div className="flex flex-wrap gap-2.5">
              {SUGGESTED_QUESTIONS.map((q) =>
            <Button
              key={q}
              onClick={() => sendMessage(q)}
              className="text-sm px-4 py-2.5 rounded-lg transition-colors font-medium bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 shadow-sm text-left">
              
                  {q}
                </Button>
            )}
            </div>
          </div>
        </div>
      }

      {/* Input area */}
      <div className="px-6 pb-8 pt-4 shrink-0 border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="w-full max-w-4xl mx-auto">
          <div className="flex items-end gap-3 rounded-xl px-5 py-4 bg-slate-50 border border-slate-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all shadow-inner">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your contracts, risks, or savings…"
              className="flex-1 resize-none bg-transparent text-sm outline-none text-slate-900 placeholder-slate-400 py-1"
              style={{
                minHeight: "28px",
                maxHeight: "160px"
              }} />
            
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${
              input.trim() && !loading ?
              "bg-blue-600 text-white hover:bg-blue-700 shadow-sm" :
              "bg-slate-200 text-slate-400"}`
              }>
              
              <Send size={18} className={input.trim() && !loading ? "translate-x-0.5" : ""} />
            </Button>
          </div>
          <p className="text-xs font-medium text-center mt-3 text-slate-400">
            Press Enter to send · Shift+Enter for new line · Powered by Groq + ChromaDB RAG
          </p>
        </div>
      </div>
    </div>);

}
