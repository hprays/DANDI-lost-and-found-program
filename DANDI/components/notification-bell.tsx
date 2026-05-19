"use client";

import { useMemo, useState } from "react";
import { Bell, ChevronLeft, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getMockNotificationsWithReadState,
  markMockNotificationRead,
  type MockNotification,
} from "@/lib/mock-notifications";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<MockNotification | null>(null);
  const [items, setItems] = useState<MockNotification[]>(() => getMockNotificationsWithReadState());

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const refreshItems = () => setItems(getMockNotificationsWithReadState());

  const onOpen = () => {
    setSelected(null);
    refreshItems();
    setOpen(true);
  };

  const onClose = () => {
    setOpen(false);
    setSelected(null);
  };

  const onSelect = (notice: MockNotification) => {
    if (!notice.read) {
      markMockNotificationRead(notice.id);
      setItems((prev) => prev.map((n) => (n.id === notice.id ? { ...n, read: true } : n)));
    }
    setSelected(notice);
  };

  const typeLabel = (type: MockNotification["type"]) => {
    switch (type) {
      case "report":
        return "신고";
      case "pickup":
        return "수령";
      case "match":
        return "매칭";
      default:
        return "안내";
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`알림 (미읽음 ${unreadCount}건)`}
        className="relative"
        onClick={onOpen}
      >
        <Bell className="h-5 w-5 text-slate-600" />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </Button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="알림 닫기"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/30"
              onClick={onClose}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="fixed left-1/2 top-[calc(4.5rem+env(safe-area-inset-top))] z-50 w-[min(92vw,24rem)] -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0"
            >
              <Card className="max-h-[70vh] overflow-hidden shadow-xl">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    {selected ? (
                      <Button type="button" size="icon" variant="ghost" onClick={() => setSelected(null)} aria-label="목록으로">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <CardTitle className="text-base">{selected ? "알림 상세" : "알림"}</CardTitle>
                  </div>
                  <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="닫기">
                    <X className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="max-h-[calc(70vh-4rem)] overflow-y-auto">
                  {selected ? (
                    <motion.div
                      key={selected.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{typeLabel(selected.type)}</Badge>
                        <span className="text-xs text-muted-foreground">{selected.createdAt}</span>
                      </div>
                      <p className="text-sm font-semibold">{selected.title}</p>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{selected.detail}</p>
                      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        실제 알림은 백엔드 GET /api/notices 연동 후 마이페이지 알림함과 동기화됩니다.
                      </p>
                    </motion.div>
                  ) : (
                    <ul className="space-y-2">
                      {items.map((notice) => (
                        <li key={notice.id}>
                          <button
                            type="button"
                            onClick={() => onSelect(notice)}
                            className={`w-full rounded-xl border p-3 text-left transition hover:border-primary/40 ${
                              notice.read ? "bg-white" : "border-primary/30 bg-primary/5"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{notice.title}</p>
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">{notice.summary}</p>
                              </div>
                              {!notice.read ? (
                                <Badge className="shrink-0 bg-red-500 text-[10px]">NEW</Badge>
                              ) : null}
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">{notice.createdAt}</p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
