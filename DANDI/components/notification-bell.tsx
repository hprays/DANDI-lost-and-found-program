"use client";

import { useMemo, useState } from "react";
import { Bell, ChevronLeft, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeLabel } from "@/lib/format-display";
import { useDandiState } from "@/lib/dandi-state";

export function NotificationBell() {
  const { notices, noticesLoading, refreshNotices, markNoticeRead, deleteNotice, deleteAllNotices } = useDandiState();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const unreadCount = useMemo(() => notices.filter((n) => !n.read).length, [notices]);
  const selected = useMemo(
    () => notices.find((notice) => notice.id === selectedId) ?? null,
    [notices, selectedId]
  );

  const onOpen = () => {
    setSelectedId(null);
    void refreshNotices();
    setOpen(true);
  };

  const onClose = () => {
    setOpen(false);
    setSelectedId(null);
  };

  const onSelect = async (noticeId: string) => {
    const target = notices.find((notice) => notice.id === noticeId);
    if (!target) return;
    if (!target.read) {
      await markNoticeRead(noticeId);
    }
    setSelectedId(noticeId);
  };

  const onDelete = async (noticeId: string) => {
    setBusyId(noticeId);
    try {
      await deleteNotice(noticeId);
      if (selectedId === noticeId) setSelectedId(null);
    } finally {
      setBusyId(null);
    }
  };

  const onDeleteAll = async () => {
    if (!window.confirm("모든 알림을 삭제할까요?")) return;
    setBusyId("all");
    try {
      await deleteAllNotices();
      setSelectedId(null);
    } finally {
      setBusyId(null);
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
                  <motion.div className="flex items-center gap-2">
                    {selected ? (
                      <Button type="button" size="icon" variant="ghost" onClick={() => setSelectedId(null)} aria-label="목록으로">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <CardTitle className="text-base">{selected ? "알림 상세" : "알림"}</CardTitle>
                  </motion.div>
                  <div className="flex items-center gap-1">
                    {!selected && notices.length > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-xs text-muted-foreground"
                        disabled={busyId === "all"}
                        onClick={() => void onDeleteAll()}
                      >
                        전체 삭제
                      </Button>
                    ) : null}
                    {selected ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="알림 삭제"
                        disabled={busyId === selected.id}
                        onClick={() => void onDelete(selected.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    ) : null}
                    <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="닫기">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="max-h-[calc(70vh-4rem)] overflow-y-auto">
                  {noticesLoading ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">알림을 불러오는 중…</p>
                  ) : selected ? (
                    <motion.div
                      key={selected.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-3"
                    >
                      <motion.div className="flex items-center gap-2">
                        <Badge variant="secondary">알림</Badge>
                        <span className="text-xs text-muted-foreground">{formatDateTimeLabel(selected.createdAt) || selected.createdAt}</span>
                      </motion.div>
                      <p className="text-sm font-semibold">{selected.title}</p>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{selected.message}</p>
                    </motion.div>
                  ) : notices.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">새 알림이 없습니다.</p>
                  ) : (
                    <ul className="space-y-2">
                      {notices.map((notice) => (
                        <li key={notice.id}>
                          <button
                            type="button"
                            onClick={() => void onSelect(notice.id)}
                            className={`w-full rounded-xl border p-3 text-left transition hover:border-primary/40 ${
                              notice.read ? "bg-white" : "border-primary/30 bg-primary/5"
                            }`}
                          >
                            <motion.div className="flex items-start justify-between gap-2">
                              <motion.div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{notice.title}</p>
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">{notice.message}</p>
                              </motion.div>
                              {!notice.read ? (
                                <Badge className="shrink-0 bg-red-500 text-[10px]">NEW</Badge>
                              ) : null}
                            </motion.div>
                            <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTimeLabel(notice.createdAt) || notice.createdAt}</p>
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
