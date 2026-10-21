import { apiJson } from "@/lib/api-json";
import { isValidStudentId } from "@/lib/student-id";

export type UserProfileResponse = {
  name?: string | null;
  department?: string | null;
  studentId?: string | null;
  profileCompleted: boolean;
};

export function fetchMyProfile() {
  return apiJson<UserProfileResponse>("/api/users/me");
}

export async function saveMyProfile(profile: { name: string; department: string; studentId: string }) {
  const saved = await apiJson<UserProfileResponse>("/api/users/me/profile", {
    method: "PATCH", body: JSON.stringify(profile),
  });
  if (!isValidStudentId(saved.studentId) || saved.studentId !== profile.studentId || !saved.profileCompleted) {
    throw new Error("학번 저장 결과를 확인하지 못했습니다. 다시 시도해 주세요.");
  }
  return saved;
}
