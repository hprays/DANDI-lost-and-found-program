export const categories = [
  "전체",
  "전자기기",
  "지갑/가방",
  "신분증",
  "카드/티켓",
  "의류",
  "악세서리",
  "도서/문구",
  "스포츠/운동",
  "악기",
  "텀블러/생활용품",
  "열쇠/키링",
  "우산/우비",
  "화장품",
  "기타",
];

// 지도에 등록된 모든 건물 + 사용자 친화 줄임말을 자동 포함
const additionalBuildings = ["퇴계도서관", "혜당관", "법학관", "음악관"];

export const buildings = (() => {
  const all = new Set<string>(["전체"]);
  // officeMarkers는 아래에서 선언되므로 module evaluation 후 push 되도록 lazy 형태로 사용
  // 아래 즉시 실행 함수 내에서 OFFICE_NAMES를 참고하지 못하므로, 명시적 list로 작성
  const officeBuildingNames = [
    "소프트웨어 ICT관",
    "미디어센터",
    "글로컬산학협력관",
    "제1공학관",
    "제2공학관",
    "제3공학관",
    "사회과학관",
    "사범관",
    "상경관",
    "인문관",
    "혜당관",
    "퇴계도서관",
    "범정관",
    "법학관",
    "국제관",
    "난파음악관",
    "미술관",
    "체육관",
    "무용관",
  ];
  officeBuildingNames.forEach((name) => all.add(name));
  additionalBuildings.forEach((name) => all.add(name));
  return Array.from(all);
})();

/** 홈 건물별 분류와 동일 (전체 제외) */
export const selectableBuildings = buildings.filter((b) => b !== "전체");

export type OfficeMarker = {
  name: string;
  location: string;
  address: string;
  hours: string;
  phone: string;
  lat: number;
  lng: number;
};

export const lostItems = [
  {
    id: "1",
    name: "에어팟 프로 오른쪽 유닛",
    category: "전자기기",
    type: "이어폰",
    place: "소프트웨어ICT관 1층 로비",
    time: "10분 전 등록",
    color: "white",
    image: "/lost-items/airpod-right.png",
  },
  {
    id: "2",
    name: "검은색 반지갑",
    category: "지갑/가방",
    type: "지갑",
    place: "상경관 315호 앞 벤치",
    time: "30분 전 등록",
    color: "black",
    image: "/lost-items/wallet-black.png",
  },
  {
    id: "3",
    name: "학생증(홍길동)",
    category: "신분증",
    type: "학생증",
    place: "퇴계도서관 2열람실",
    time: "1시간 전 등록",
    color: "blue",
    image: "https://placehold.co/600x400/e8fff6/065f46?text=ID+Card",
  },
  {
    id: "4",
    name: "노트북 파우치(회색)",
    category: "전자기기",
    type: "노트북 파우치",
    place: "제2공학관 2층 휴게공간",
    time: "1시간 20분 전 등록",
    color: "gray",
    image: "https://placehold.co/600x400/f1f5f9/0f172a?text=Laptop+Sleeve",
  },
  {
    id: "5",
    name: "토익 단어장(파란 커버)",
    category: "도서/문구",
    type: "도서",
    place: "인문관 308호 강의실",
    time: "2시간 전 등록",
    color: "blue",
    image: "https://placehold.co/600x400/e0f2fe/0369a1?text=Book",
  },
  {
    id: "6",
    name: "체크무늬 머플러",
    category: "의류/악세서리",
    type: "머플러",
    place: "혜당관 1층 카페",
    time: "2시간 40분 전 등록",
    color: "brown",
    image: "https://placehold.co/600x400/fef3c7/92400e?text=Muffler",
  },
  {
    id: "7",
    name: "스마트워치 검정 스트랩",
    category: "전자기기",
    type: "스마트워치",
    place: "체육관 로비",
    time: "3시간 전 등록",
    color: "black",
    image: "https://placehold.co/600x400/e5e7eb/1f2937?text=Smart+Watch",
  },
  {
    id: "8",
    name: "파란색 볼펜 필통",
    category: "도서/문구",
    type: "필통",
    place: "사회과학관 103호 앞",
    time: "3시간 10분 전 등록",
    color: "blue",
    image: "https://placehold.co/600x400/dbeafe/1d4ed8?text=Pencil+Case",
  },
  {
    id: "9",
    name: "아이보리 에코백",
    category: "지갑/가방",
    type: "에코백",
    place: "퇴계도서관 1층 열람실",
    time: "4시간 전 등록",
    color: "ivory",
    image: "https://placehold.co/600x400/fefce8/854d0e?text=Eco+Bag",
  },
  {
    id: "10",
    name: "무선 마우스 (로지텍)",
    category: "전자기기",
    type: "마우스",
    place: "소프트웨어ICT관 311호",
    time: "어제 등록",
    color: "black",
    image: "https://placehold.co/600x400/f8fafc/334155?text=Mouse",
  },
  {
    id: "11",
    name: "교통카드 지갑 케이스",
    category: "지갑/가방",
    type: "카드지갑",
    place: "상경관 304호 복도",
    time: "어제 등록",
    color: "green",
    image: "https://placehold.co/600x400/dcfce7/166534?text=Card+Case",
  },
  {
    id: "12",
    name: "연보라 텀블러",
    category: "기타",
    type: "텀블러",
    place: "범정관 1층 안내데스크",
    time: "어제 등록",
    color: "purple",
    image: "https://placehold.co/600x400/f3e8ff/6d28d9?text=Tumbler",
  },
];

/**
 * 지도 핀 위치 조정 방법
 * 1) https://www.openstreetmap.org 에서 건물 위치를 검색한다.
 * 2) 해당 위치를 우클릭 → "좌표 표시"에서 lat(위도), lng(경도)를 복사한다.
 * 3) 아래 officeMarkers 항목의 lat, lng 숫자를 붙여넣고 저장한다.
 * 4) npm run dev 재시작 후 지도 페이지에서 확인한다.
 */
export const officeMarkers: OfficeMarker[] = [
  {
    name: "소프트웨어 ICT관 사무실",
    location: "ICT관 311호",
    address: "경기 용인시 수지구 죽전로 152",
    hours: "평일 09:00-18:00",
    phone: "031-000-0001",
    lat: 37.32258,
    lng: 127.12711,
  },
  {
    name: "미디어센터",
    location: "미디어커뮤니케이션 학부 103호",
    address: "사회과학관 103호",
    hours: "평일 09:00-18:00",
    phone: "031-000-0002",
    lat: 37.32206,
    lng: 127.12712,
  },
  {
    name: "글로컬산학협력관",
    location: "창업지원단 사무실 303호",
    address: "글로컬산학협력관",
    hours: "평일 09:00-18:00",
    phone: "031-000-0003",
    lat: 37.32211,
    lng: 127.12589,
  },
  {
    name: "제1공학관",
    location: "토목환경공학과 사무실 214호",
    address: "제1공학관",
    hours: "평일 09:00-18:00",
    phone: "031-000-0004",
    lat: 37.32134,
    lng: 127.12597,
  },
  {
    name: "제2공학관",
    location: "전자전기공학부 사무실 215호",
    address: "제2공학관",
    hours: "평일 09:00-18:00",
    phone: "031-000-0005",
    lat: 37.32151,
    lng: 127.12642,
  },
  {
    name: "제3공학관",
    location: "화학공학과 사무실 217호",
    address: "제3공학관",
    hours: "평일 09:00-18:00",
    phone: "031-000-0006",
    lat: 37.32122,
    lng: 127.12686,
  },
  {
    name: "사회과학관",
    location: "미디어커뮤니케이션 학부(미디어센터 103호)",
    address: "사회과학관",
    hours: "평일 09:00-18:00",
    phone: "031-000-0007",
    lat: 37.32188,
    lng: 127.12663,
  },
  {
    name: "사범관",
    location: "한문교육과 사무실 318호",
    address: "사범관",
    hours: "평일 09:00-18:00",
    phone: "031-000-0008",
    lat: 37.32278,
    lng: 127.12786,
  },
  {
    name: "상경관",
    location: "경영경제대학 통합사무실 304호",
    address: "상경관",
    hours: "평일 09:00-18:00",
    phone: "031-000-0009",
    lat: 37.32129,
    lng: 127.12622,
  },
  {
    name: "인문관",
    location: "문과대학 사무실 308호",
    address: "인문관",
    hours: "평일 09:00-18:00",
    phone: "031-000-0010",
    lat: 37.32189,
    lng: 127.12798,
  },
  {
    name: "혜당관 학생팀",
    location: "혜당관 425호",
    address: "단국대학교 죽전캠퍼스",
    hours: "평일 09:00-18:00",
    phone: "031-000-0011",
    lat: 37.32286,
    lng: 127.12674,
  },
  {
    name: "퇴계도서관 사무실",
    location: "퇴계도서관 320호",
    address: "중앙도서관 건물",
    hours: "평일 09:00-18:00",
    phone: "031-000-0012",
    lat: 37.32258,
    lng: 127.12691,
  },
  {
    name: "범정관(대학본부)",
    location: "단소리 CS센터 118호",
    address: "범정관",
    hours: "평일 09:00-18:00",
    phone: "031-000-0013",
    lat: 37.32179,
    lng: 127.12653,
  },
  {
    name: "법학관",
    location: "법학과 사무실 328호",
    address: "법학관",
    hours: "평일 09:00-18:00",
    phone: "031-000-0014",
    lat: 37.32107,
    lng: 127.12624,
  },
  {
    name: "국제관",
    location: "국제대학 교학행정팀 302호",
    address: "국제관",
    hours: "평일 09:00-18:00",
    phone: "031-000-0015",
    lat: 37.32094,
    lng: 127.12763,
  },
  {
    name: "난파음악관",
    location: "기악/성악/작곡과 사무실 223호",
    address: "난파음악관",
    hours: "평일 09:00-18:00",
    phone: "031-000-0016",
    lat: 37.32057,
    lng: 127.12634,
  },
  {
    name: "미술관",
    location: "패션산업디자인전공 사무실 406호",
    address: "미술관",
    hours: "평일 09:00-18:00",
    phone: "031-000-0017",
    lat: 37.32035,
    lng: 127.12678,
  },
  {
    name: "체육관",
    location: "공연영화학부 사무실 B220호",
    address: "체육관",
    hours: "평일 09:00-18:00",
    phone: "031-000-0018",
    lat: 37.32031,
    lng: 127.12591,
  },
  {
    name: "무용관",
    location: "무용과 사무실 101호",
    address: "무용관",
    hours: "평일 09:00-18:00",
    phone: "031-000-0019",
    lat: 37.32015,
    lng: 127.12636,
  },
];
