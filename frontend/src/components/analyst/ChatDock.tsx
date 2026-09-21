"use client";

import React, { useState } from "react";
import { Send, Bot, Sparkles, Terminal } from "lucide-react";
import { executeQuery } from "@/lib/api";
import { QueryResult } from "@/lib/types";

interface ChatDockProps {
  viewName: string;
  onQueryComplete?: (result: QueryResult) => void;
}

export function ChatDock({ viewName, onQueryComplete }: ChatDockProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ role: "user" | "assistant"; text: string; sql?: string }[]>([
    {
      role: "assistant",
      text: "Hello! I am your AI Data Analyst. Ask me anything about this dataset or ask me to compute specific metrics.",
    },
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    const userQ = question;
    setQuestion("");
    setHistory((prev) => [...prev, { role: "user", text: userQ }]);
    setLoading(true);

    try {
      const res = await executeQuery(viewName, undefined, userQ);
      setHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          text: res.explanation || `Query returned ${res.row_count} rows.`,
          sql: res.executed_sql,
        },
      ]);
      if (onQueryComplete) {
        onQueryComplete(res);
      }
    } catch (err: any) {
      setHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Error executing analysis: ${err.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[520px] rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-950/80">
        <Sparkles className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-semibold text-slate-100">Conversational Data Analyst</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
        {history.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-indigo-600/30 flex items-center justify-center text-indigo-400 shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}
            <div
              className={`rounded-lg px-3 py-2 max-w-[85%] ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800/80 text-slate-200 border border-slate-700/60"
              }`}
            >
              <p>{msg.text}</p>
              {msg.sql && (
                <div className="mt-2 pt-2 border-t border-slate-700/60 font-mono text-[11px] text-slate-300">
                  <div className="flex items-center gap-1 text-slate-400 mb-1">
                    <Terminal className="w-3 h-3" /> Executed DuckDB SQL:
                  </div>
                  <pre className="bg-slate-950 p-2 rounded text-emerald-400 overflow-x-auto">{msg.sql}</pre>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs italic">
            <Bot className="w-4 h-4 animate-spin" /> Thinking and verifying code...
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-800 bg-slate-950/80 flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question (e.g. 'Show average sales by region')..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg px-3 py-2 transition-colors flex items-center justify-center"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
