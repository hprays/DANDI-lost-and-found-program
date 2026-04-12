export function getFallbackImageByCategory(category?: string) {
  switch (category) {
    case "전자기기":
      return "/fallbacks/electronics.svg";
    case "지갑/가방":
      return "/fallbacks/wallet.svg";
    case "신분증":
      return "/fallbacks/idcard.svg";
    case "도서/문구":
      return "/fallbacks/book.svg";
    case "의류/악세서리":
      return "/fallbacks/fashion.svg";
    default:
      return "/fallbacks/generic.svg";
  }
}
