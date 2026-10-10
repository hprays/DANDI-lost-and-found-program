// 물품 ID와 신고 ID가 섞이지 않는지 확인 (Node 23.6+ 타입 제거 실행): npm run check:ids
import assert from "node:assert/strict";
import {
  findCatalogItemByHint,
  isSameCatalogItem,
  resolveServerLostItemId,
} from "../lib/catalog-identity.ts";

// 물품 A(10)의 신고 번호가 물품 B의 번호(20)와 같은 경우
const A = { id: "10", lostItemId: "10", reportId: "20", name: "A" };
const B = { id: "20", lostItemId: "20", reportId: "30", name: "B" };

for (const pools of [[A, B], [B, A]]) {
  assert.equal(isSameCatalogItem(A, B), false);
  assert.equal(findCatalogItemByHint("20", pools)?.name, "B");
  assert.equal(resolveServerLostItemId(undefined, "20", pools), "20");
  assert.equal(resolveServerLostItemId(B, "20", pools), "20");
}

// 승인 직후 임시 카드(report-20)는 같은 신고에서 생성된 서버 물품 A와 같은 항목
const provisional = { id: "report-20", reportId: "20", name: "A" };
assert.equal(isSameCatalogItem(provisional, A), true);
assert.equal(isSameCatalogItem(provisional, B), false);
assert.equal(resolveServerLostItemId(provisional, "report-20", [A, B]), "10");

// 서버에 없는 임시 카드는 PATCH/DELETE 대상 ID가 없다
assert.equal(resolveServerLostItemId({ id: "report-99", reportId: "99" }, "report-99", [A, B]), "");

console.log("catalog identity checks passed");
