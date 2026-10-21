"use client";

import { useCallback, useState } from "react";

/** Each list owns its page; account changes and shrinking lists stay on a valid page. */
export function useListPagination<T>(items: readonly T[], pageSize: number, scope = "") {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const [selection, setSelection] = useState({ page: 1, scope });
  const page = selection.scope === scope ? Math.min(selection.page, totalPages) : 1;

  if (selection.page !== page || selection.scope !== scope) {
    setSelection({ page, scope });
  }

  const setPage = useCallback((nextPage: number) => {
    setSelection({ page: Math.max(1, Math.min(nextPage, totalPages)), scope });
  }, [scope, totalPages]);

  const offset = (page - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize),
    page,
    totalPages,
    total: items.length,
    start: items.length ? offset + 1 : 0,
    end: Math.min(offset + pageSize, items.length),
    setPage,
  };
}
