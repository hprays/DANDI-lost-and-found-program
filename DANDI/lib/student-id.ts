export const STUDENT_ID_LENGTH = 8;
export const STUDENT_ID_MESSAGE = "학번은 8자리 숫자로 입력해 주세요.";

export function isValidStudentId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{8}$/.test(value);
}
