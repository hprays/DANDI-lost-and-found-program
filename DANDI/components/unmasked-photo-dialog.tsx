'use client';

import { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { UNMASKED_SENSITIVE_MESSAGE } from '@/lib/vision-utils';

/**
 * 신분증·카드 사진을 모자이크 없이 공개하려 할 때 띄우는 경고 팝업.
 * 브라우저 기본 경고창 대신 앱 안에서 보여 준다.
 */
export function UnmaskedPhotoDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unmasked-photo-title"
        aria-describedby="unmasked-photo-desc"
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-red-600">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          <h2 id="unmasked-photo-title" className="text-base font-semibold">
            공개할 수 없습니다
          </h2>
        </div>
        <p
          id="unmasked-photo-desc"
          className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700"
        >
          {UNMASKED_SENSITIVE_MESSAGE}
        </p>
        <Button type="button" className="mt-4 w-full" onClick={onClose} autoFocus>
          확인
        </Button>
      </div>
    </div>
  );
}
