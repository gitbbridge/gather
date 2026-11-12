export type LiveDisplayResponseKind = "success" | "terminal" | "retryable";

export function classifyLiveDisplayResponse(status: number): LiveDisplayResponseKind {
  if (status >= 200 && status < 300) return "success";
  if (status === 403 || status === 404) return "terminal";
  return "retryable";
}
