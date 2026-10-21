// 기간 필터·보관실 매칭·남은 시간 표시 확인 (Node 23.6+ 타입 제거 실행): npm run check:filters
import assert from "node:assert/strict";
import {
  findOfficeForStorage,
  formatRemaining,
  officeForBuilding,
  officeStorageLabel,
  periodStartMs,
} from "../lib/item-filters.ts";

// 2026-10-15(목) 14:30 기준
const now = new Date(2026, 9, 15, 14, 30).getTime();
assert.equal(periodStartMs("전체", now), 0);
assert.equal(periodStartMs("오늘", now), new Date(2026, 9, 15).getTime());
assert.equal(periodStartMs("이번 주", now), new Date(2026, 9, 12).getTime());
assert.equal(periodStartMs("이번 달", now), new Date(2026, 9, 1).getTime());
// 일요일은 같은 주의 월요일부터
assert.equal(periodStartMs("이번 주", new Date(2026, 9, 18, 9).getTime()), new Date(2026, 9, 12).getTime());

const offices = [
  { name: "인문관", location: "문과대학 사무실 308호", address: "인문관" },
  { name: "혜당관 학생팀", location: "혜당관 425호", address: "단국대학교 죽전캠퍼스" },
  { name: "소프트웨어 ICT관", location: "SW융합대학 사무실", address: "소프트웨어 ICT관" },
];
assert.equal(findOfficeForStorage("혜당관 학생팀 425호", offices)?.name, "혜당관 학생팀");
assert.equal(findOfficeForStorage("혜당관 425호", offices)?.name, "혜당관 학생팀");
assert.equal(findOfficeForStorage("소프트웨어ICT관 1층", offices)?.name, "소프트웨어 ICT관");
assert.equal(findOfficeForStorage("", offices), undefined);
assert.equal(findOfficeForStorage("정문 경비실", offices), undefined);

assert.equal(formatRemaining(9 * 60_000 + 5_000), "9분 05초");
assert.equal(formatRemaining(-1), "0분 00초");

// 습득 건물 → 그 건물 관리실을 보관 장소로
const realOffices = [
  { name: "소프트웨어 ICT관 사무실", location: "ICT관 311호" },
  { name: "제1공학관", location: "토목환경공학과 사무실 214호" },
  { name: "혜당관 학생팀", location: "혜당관 425호" },
  { name: "퇴계도서관 사무실", location: "퇴계도서관 320호" },
  { name: "범정관(대학본부)", location: "단소리 CS센터 118호" },
  { name: "난파음악관", location: "기악/성악/작곡과 사무실 223호" },
];
const label = (b) => {
  const o = officeForBuilding(b, realOffices);
  return o ? officeStorageLabel(o) : undefined;
};
assert.equal(label("퇴계도서관"), "퇴계도서관 사무실 320호");
assert.equal(label("혜당관"), "혜당관 학생팀 425호");
assert.equal(label("제1공학관"), "제1공학관 토목환경공학과 사무실 214호");
assert.equal(label("소프트웨어 ICT관"), "소프트웨어 ICT관 사무실 311호");
assert.equal(label("범정관"), "범정관 (대학본부) 단소리 CS센터 118호");
// 이름이 건물로 시작하지 않으면 찾지 않는다 (음악관 ≠ 난파음악관)·빈 값도 — 호출 측이 기본 보관실로 보낸다
assert.equal(label("음악관"), undefined);
assert.equal(officeStorageLabel({ name: "사회과학관", location: "사회과학관 102호" }), "사회과학관 102호");
assert.equal(label(""), undefined);

console.log("item-filters OK");
