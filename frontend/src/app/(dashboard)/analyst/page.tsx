"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Send,
  Code2,
  Database,
  Layers,
  ArrowRight,
  Bot,
  User,
  Zap,
  Play,
  CheckCircle2,
  Copy,
  Check,
} from "lucide-react";
import { executeQuery, fetchDatasets } from "@/lib/api";
import { DatasetItem, QueryResult } from "@/lib/types";

interface ChatMessage {
  id: string;
  sender: "user" | "analyst";
  text: string;
  sql?: string;
  queryResult?: QueryResult;
  timestamp: string;
}

export default function AnalystPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-xs text-[#8C827A]">Loading analyst context...</div>}>
      <AnalystContent />
    </React.Suspense>
  );
}

function AnalystContent() {
  const searchParams = useSearchParams();
  const targetDatasetParam = searchParams.get("dataset");
  const initialQuestion = searchParams.get("question") || "";

  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>(targetDatasetParam || "");
  const [selectedView, setSelectedView] = useState<string>("");
  const [inputValue, setInputValue] = useState<string>(initialQuestion);
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  useEffect(() => {
    fetchDatasets()
      .then((data) => {
        setDatasets(data);
        if (data.length > 0) {
          const match = targetDatasetParam
            ? data.find(
                (d) =>
                  d.filename.toLowerCase() === targetDatasetParam.toLowerCase() ||
                  d.name.toLowerCase() === targetDatasetParam.toLowerCase() ||
                  d.id.toLowerCase() === targetDatasetParam.toLowerCase()
              )
            : data[0];

          const active = match || data[0];
          setSelectedDataset(active.filename);
          const view = active.view_name || `view_${active.id}`;
          setSelectedView(view);

          setMessages([
            {
              id: "welcome-msg",
              sender: "analyst",
              text: `Hello! I'm your AI Data Analyst grounded in DuckDB. I can translate your natural language queries into verified, deterministic SQL execution over "${active.filename}" (${(active.total_rows || 0).toLocaleString()} rows). What would you like to investigate?`,
              timestamp: "Just now",
            },
          ]);
        } else {
          setMessages([
            {
              id: "empty-msg",
              sender: "analyst",
              text: "No datasets have been registered yet. Please upload a dataset in the Ingestion Studio to begin analyzing.",
              timestamp: "Just now",
            },
          ]);
        }
      })
      .catch((err) => console.error(err));
  }, [targetDatasetParam]);

  const handleDatasetChange = (filename: string) => {
    setSelectedDataset(filename);
    const match = datasets.find((d) => d.filename === filename);
    if (match) {
      const view = match.view_name || `view_${match.id}`;
      setSelectedView(view);
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          sender: "analyst",
          text: `Context switched to **${filename}** (DuckDB view: \`${view}\`). You can ask questions about its columns, distributions, or metrics.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const question = textToSend || inputValue;
    if (!question.trim() || isThinking) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: "user",
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsThinking(true);

    try {
      // Use executeQuery with natural_language_question
      const res = await executeQuery(selectedView, undefined, question);

      const analystMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: "analyst",
        text:
          res.explanation ||
          `I analyzed \`${selectedView}\` and generated the following query to answer your question:`,
        sql: res.executed_sql,
        queryResult: res,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, analystMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: "analyst",
          text: `I ran into an issue analyzing the dataset: ${err.message || "Unknown error"}. Please check your target view or try rephrasing.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const promptStarters = [
    `Show the first 10 records from ${selectedDataset || "this dataset"}`,
    `Calculate total rows and summarize distinct counts`,
    `What are the most frequent values and key metrics?`,
    `Are there any missing or null values in ${selectedDataset || "this table"}?`,
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F7F5F2] overflow-hidden">
      {/* Top Bar */}
      <div className="border-b border-[#E8E4DF] bg-white px-6 py-3 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#0061FE]/10 text-[#0061FE]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-[#1E1915]">
              Conversational AI Analyst
            </h1>
            <p className="text-xs text-[#8C827A]">
              Deterministic data reasoning grounded in DuckDB SQL execution.
            </p>
          </div>
        </div>

        {/* Dataset Context Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#736B63] font-medium hidden sm:inline">Active Context:</span>
          <select
            value={selectedDataset}
            onChange={(e) => handleDatasetChange(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-[#E8E4DF] bg-[#FAF8F5] text-xs font-semibold text-[#1E1915] outline-none cursor-pointer"
          >
            {datasets.map((d) => (
              <option key={d.id} value={d.filename}>
                {d.filename} ({d.format.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Chat Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl w-full mx-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.sender === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                msg.sender === "user"
                  ? "bg-[#1E1915] text-white"
                  : "bg-[#0061FE] text-white shadow-sm shadow-[#0061FE]/30"
              }`}
            >
              {msg.sender === "user" ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>

            {/* Message Bubble */}
            <div
              className={`max-w-2xl space-y-3 p-4 rounded-2xl text-xs leading-relaxed ${
                msg.sender === "user"
                  ? "bg-[#1E1915] text-white"
                  : "bg-white border border-[#E8E4DF] text-[#1E1915] shadow-2xs"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.text}</div>

              {/* Generated SQL Code Block (If Analyst message has SQL) */}
              {msg.sql && (
                <div className="rounded-xl overflow-hidden border border-[#E8E4DF] bg-[#FAF8F5] space-y-2 mt-2">
                  <div className="px-3 py-1.5 bg-[#EFECE6]/50 border-b border-[#E8E4DF] flex items-center justify-between text-[11px] font-mono text-[#736B63]">
                    <div className="flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5 text-[#0061FE]" />
                      <span>Generated DuckDB SQL</span>
                    </div>
                    <Link
                      href={`/query?view=${selectedView}&sql=${encodeURIComponent(msg.sql)}`}
                      className="text-[#0061FE] hover:underline flex items-center gap-1"
                    >
                      <span>Open in SQL Studio</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                  <pre className="p-3 text-[11px] font-mono text-[#1E1915] overflow-x-auto">
                    {msg.sql}
                  </pre>
                </div>
              )}

              {/* Embedded Result Preview Table */}
              {msg.queryResult && msg.queryResult.data && msg.queryResult.data.length > 0 && (
                <div className="rounded-xl border border-[#E8E4DF] overflow-x-auto bg-white mt-2">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-[#FAF8F5] border-b border-[#E8E4DF] text-[10px] font-mono uppercase text-[#8C827A]">
                      <tr>
                        {msg.queryResult.columns.map((c) => (
                          <th key={c} className="py-1.5 px-2.5 font-semibold">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8E4DF] font-mono">
                      {msg.queryResult.data.slice(0, 5).map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-[#FAF8F5]/60">
                          {msg.queryResult!.columns.map((c) => (
                            <td key={c} className="py-1.5 px-2.5 truncate max-w-[200px]">
                              {String(row[c])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {msg.queryResult.data.length > 5 && (
                    <div className="px-3 py-1 bg-[#FAF8F5] text-[10px] font-mono text-[#8C827A] border-t border-[#E8E4DF]">
                      Showing 5 of {msg.queryResult.row_count} rows
                    </div>
                  )}
                </div>
              )}

              <div
                className={`text-[10px] font-mono mt-1 ${
                  msg.sender === "user" ? "text-white/60 text-right" : "text-[#8C827A]"
                }`}
              >
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}

        {/* Thinking Indicator */}
        {isThinking && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#0061FE] text-white flex items-center justify-center shrink-0 shadow-sm shadow-[#0061FE]/30 animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl bg-white border border-[#E8E4DF] shadow-2xs space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#1E1915]">
                <div className="w-2 h-2 rounded-full bg-[#0061FE] animate-ping" />
                <span>Translating natural language into SQL & executing on DuckDB...</span>
              </div>
              <p className="text-[11px] text-[#8C827A]">
                Grounding against schema of <code className="font-mono">{selectedView}</code>
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area & Prompt Starters */}
      <div className="border-t border-[#E8E4DF] bg-white p-4 shrink-0 max-w-4xl w-full mx-auto space-y-3">
        {/* Quick Starters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[10px] font-mono uppercase text-[#8C827A] shrink-0">Try:</span>
          {promptStarters.map((starter) => (
            <button
              key={starter}
              onClick={() => handleSendMessage(starter)}
              className="px-2.5 py-1 rounded-lg bg-[#FAF8F5] hover:bg-[#EFECE6] border border-[#E8E4DF] text-[#5C554D] hover:text-[#1E1915] shrink-0 text-[11px] transition-colors"
            >
              {starter}
            </button>
          ))}
        </div>

        {/* Text Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Ask a question about ${selectedDataset}... (e.g. "What is the average monthly charge?")`}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8E4DF] focus:border-[#0061FE] focus:bg-white text-xs text-[#1E1915] placeholder-[#8C827A] outline-none transition-all"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isThinking}
            className="p-2.5 rounded-xl bg-[#0061FE] hover:bg-[#0052D4] text-white disabled:opacity-40 transition-all cursor-pointer shadow-sm shadow-[#0061FE]/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
