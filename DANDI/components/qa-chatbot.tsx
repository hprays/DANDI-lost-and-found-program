"use client";

import { useMemo, useState } from "react";
import { Bot, Loader2, SendHorizonal, Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type QAChatbotProps = {
  tips?: string[];
};

const defaultAnswers: Record<string, string> = {
  "어디로 가야 하나요?": "지도 페이지에서 현재 위치 기준 가장 가까운 관리실을 확인할 수 있어요.",
  "학생증이 꼭 필요한가요?": "네, 대부분의 수령 건은 학생증 또는 신분증으로 본인 확인이 필요합니다.",
  "운영시간이 언제인가요?": "관리실 기본 운영시간은 평일 09:00~18:00이며 건물마다 다를 수 있어요.",
  "대리 수령이 가능한가요?": "가능한 경우가 있으나, 위임 확인 절차가 필요할 수 있어요.",
};

export function QAChatbot({ tips }: QAChatbotProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "bot"; text: string }>>([
    { role: "bot", text: "안녕하세요. 단디 Q&A 챗봇입니다. 분실물 수령/위치/서류를 물어보세요." },
  ]);

  const quickTips = useMemo(() => tips ?? Object.keys(defaultAnswers), [tips]);

  const ask = async (text: string) => {
    if (!text.trim()) return;
    const baseUserMessage = { role: "user" as const, text };
    setMessages((prev) => [...prev, baseUserMessage]);
    setQuestion("");

    try {
      setLoading(true);
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-8),
        }),
      });

      if (!response.ok) {
        throw new Error("chat api failed");
      }
      const data = (await response.json()) as { answer: string };
      setMessages((prev) => [...prev, { role: "bot", text: data.answer }]);
    } catch {
      const fallback = defaultAnswers[text] ?? "요청한 내용은 관리자 또는 지도 페이지에서 추가로 확인할 수 있어요.";
      setMessages((prev) => [...prev, { role: "bot", text: fallback }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="챗봇 열기"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-sky-500 shadow-[0_12px_28px_rgba(37,99,235,0.45)] transition active:scale-95 md:bottom-24"
      >
        <div className="relative">
          <Bot className="h-6 w-6 text-white" />
          <Sparkles className="absolute -right-2 -top-2 h-3.5 w-3.5 text-yellow-200" />
        </div>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-[calc(9.5rem+env(safe-area-inset-bottom))] right-4 z-40 w-[92vw] max-w-sm md:bottom-28"
          >
            <Card className="border-primary/30 shadow-xl">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="h-4 w-4 text-primary" />
                  단디 AI 챗봇
                </CardTitle>
                <Button size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="챗봇 닫기">
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="max-h-48 space-y-2 overflow-auto rounded-lg bg-slate-50 p-2">
                  {messages.map((m, idx) => (
                    <div
                      key={`${m.role}-${idx}`}
                      className={`rounded-md px-3 py-2 text-sm ${m.role === "bot" ? "bg-white text-slate-700" : "bg-primary/10 text-slate-900"}`}
                    >
                      {m.text}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {quickTips.slice(0, 4).map((tip) => (
                    <button key={tip} type="button" onClick={() => ask(tip)} className="rounded-full border px-3 py-1 text-xs hover:bg-accent">
                      {tip}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="질문을 입력하세요" />
                  <Button size="icon" onClick={() => ask(question)} aria-label="전송" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
