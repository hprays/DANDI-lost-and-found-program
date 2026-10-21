import { categories } from "@/lib/mock-data";

/** 물품명 키워드 → 카테고리 (카테고리명은 mock-data.ts categories와 동일) */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "신분증": ["학생증", "신분증", "주민등록증", "운전면허", "여권", "외국인등록증"],
  "카드/티켓": ["카드", "티켓", "교통카드"],
  "지갑/가방": ["지갑", "카드지갑", "가방", "백팩", "파우치", "에코백", "쇼핑백", "크로스백"],
  "전자기기": [
    "이어폰", "에어팟", "버즈", "애플워치", "갤럭시워치", "워치", "휴대폰", "핸드폰", "아이폰", "갤럭시",
    "노트북", "태블릿", "테블릿", "아이패드", "패드", "갤럭시탭", "충전기", "보조배터리", "보존배터리",
    "배터리", "베터리", "마우스", "키보드", "애플펜슬", "펜슬", "USB", "케이블", "드론", "전자담배",
    "헤드셋", "헤드폰", "스피커", "계산기",
  ],
  "의류": [
    "모자", "바지", "자켓", "재킷", "점퍼", "후드", "셔츠", "니트", "가디건", "목도리", "장갑",
    "슬리퍼", "신발", "양말", "패딩", "코트", "조끼", "바라클라바", "의류", "옷",
  ],
  "악세서리": ["안경", "선글라스", "반지", "목걸이", "귀걸이", "팔찌", "시계", "머리끈", "집게삔", "헤어", "스크런치", "거울"],
  "도서/문구": ["책", "노트", "필통", "볼펜", "샤프", "연필", "S펜", "교재", "수첩", "파일", "도서", "문제집", "스케치북"],
  "스포츠/운동": ["라켓", "축구공", "농구공", "배구공", "운동", "요가"],
  "악기": ["악기", "리코더", "우쿨렐레"],
  "텀블러/생활용품": ["텀블러", "물병", "보틀", "컵", "안약", "렌즈", "손풍기", "선풍기", "담요", "쿠션", "인형", "피규어", "증명사진", "칫솔", "약"],
  "열쇠/키링": ["열쇠", "키링", "키홀더", "차키"],
  "우산/우비": ["우산", "우비"],
  "화장품": ["틴트", "립", "화장품", "파우더", "향수", "핸드크림"],
};

/** text에서 가장 앞에 나온 키워드(같은 위치면 긴 키워드)의 값 */
function earliestMatch(text: string, table: Record<string, string[]>): string | undefined {
  let best: { pos: number; len: number; value: string } | null = null;
  for (const [value, words] of Object.entries(table)) {
    for (const word of words) {
      const pos = text.indexOf(word);
      if (pos < 0) continue;
      if (!best || pos < best.pos || (pos === best.pos && word.length > best.len)) {
        best = { pos, len: word.length, value };
      }
    }
  }
  return best?.value;
}

/** 물품명에서 가장 앞에 나온 키워드의 카테고리, 없으면 "기타" */
export function guessCategory(text: string): string {
  return earliestMatch(text, CATEGORY_KEYWORDS) ?? "기타";
}

/** 물품명 키워드 → public/placeholders/items/<이름>.svg (Microsoft Fluent Emoji, MIT) */
const ITEM_IMAGE_KEYWORDS: Record<string, string[]> = {
  // "노트북 충전기"처럼 기기명+충전기는 충전기로 (같은 위치면 긴 키워드 우선)
  "electric-plug": ["충전기", "케이블", "USB", "노트북 충전기", "노트북충전기", "핸드폰 충전기", "휴대폰 충전기"],
  "battery": ["보조배터리", "보존배터리", "배터리", "베터리"],
  "headphone": ["이어폰", "에어팟", "버즈", "헤드셋", "헤드폰", "갤럭시 버즈", "갤럭시버즈"],
  "abacus": ["계산기"],
  "helicopter": ["드론"],
  "watch": ["애플워치", "갤럭시워치", "워치", "시계"],
  "mobile-phone": ["휴대폰", "핸드폰", "아이폰", "갤럭시", "태블릿", "테블릿", "아이패드", "갤럭시탭", "패드"],
  "laptop": ["노트북"],
  "computer-mouse": ["마우스"],
  "keyboard": ["키보드"],
  "cigarette": ["전자담배"],
  "camera": ["카메라"],
  "purse": ["지갑", "카드지갑"],
  "backpack": ["백팩", "가방"],
  "clutch-bag": ["파우치"],
  "shopping-bags": ["쇼핑백"],
  "handbag": ["에코백", "크로스백"],
  "credit-card": ["카드", "교통카드"],
  "ticket": ["티켓"],
  "identification-card": ["학생증", "신분증", "주민등록증", "운전면허", "여권", "외국인등록증"],
  "billed-cap": ["모자"],
  "jeans": ["바지"],
  "t-shirt": ["티셔츠", "셔츠", "후드", "니트", "가디건", "의류", "옷"],
  "coat": ["자켓", "재킷", "점퍼", "패딩", "코트", "조끼"],
  "gloves": ["장갑"],
  "scarf": ["목도리", "바라클라바"],
  "socks": ["양말"],
  "running-shoe": ["신발", "운동화"],
  "thong-sandal": ["슬리퍼"],
  "sunglasses": ["선글라스"],
  "glasses": ["안경"],
  "ring": ["반지"],
  "gem-stone": ["목걸이", "귀걸이", "팔찌"],
  "ribbon": ["머리끈", "집게삔", "헤어", "스크런치"],
  "mirror": ["거울"],
  "books": ["책", "도서", "교재", "문제집"],
  "notebook": ["노트", "수첩", "스케치북"],
  "pen": ["애플펜슬", "펜슬", "S펜", "볼펜", "펜"],
  "pencil": ["연필", "샤프", "필통"],
  "file-folder": ["파일"],
  "badminton": ["라켓"],
  "basketball": ["농구공", "축구공", "배구공", "운동"],
  "guitar": ["악기", "기타 케이스"],
  "cup-with-straw": ["텀블러", "물병", "보틀", "컵"],
  "pill": ["안약", "약"],
  "teddy-bear": ["인형", "피규어"],
  "framed-picture": ["증명사진", "사진"],
  "toothbrush": ["칫솔"],
  "key": ["열쇠", "키링", "키홀더", "차키"],
  "umbrella": ["우산", "우비"],
  "lipstick": ["틴트", "립"],
  "lotion-bottle": ["핸드크림", "화장품", "향수", "파우더"],
  "dollar-banknote": ["현금", "지폐"],
  "cookie": ["다과"],
};

/** 물품명 키워드가 없을 때 쓰는 카테고리 기본 그림 */
const CATEGORY_DEFAULT_IMAGE: Record<string, string> = {
  "전자기기": "mobile-phone",
  "지갑/가방": "purse",
  "신분증": "identification-card",
  "카드/티켓": "credit-card",
  "의류": "t-shirt",
  "악세서리": "gem-stone",
  "도서/문구": "books",
  "스포츠/운동": "basketball",
  "악기": "guitar",
  "텀블러/생활용품": "cup-with-straw",
  "열쇠/키링": "key",
  "우산/우비": "umbrella",
  "화장품": "lotion-bottle",
};

/** 사진 없는 물품의 대체 그림 경로 — 물품명 → 카테고리 → 상자 순 */
export function itemPlaceholderImage(name: string, category?: string): string {
  const slug =
    earliestMatch(name, ITEM_IMAGE_KEYWORDS) ??
    (category ? CATEGORY_DEFAULT_IMAGE[category] : undefined) ??
    "package";
  return `/placeholders/items/${slug}.svg`;
}

/** API 카테고리가 화면 카테고리 목록에 있으면 그대로, 아니면 물품명으로 추정 */
export function resolveCategory(apiCategory: string | undefined, name: string): string {
  if (apiCategory && categories.includes(apiCategory)) return apiCategory;
  return guessCategory(`${name} ${apiCategory ?? ""}`);
}
