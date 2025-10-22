const REDLINE_PATTERNS: Array<RegExp> = [
  /AKIA[0-9A-Z]{16}/g,
  /sk-[A-Za-z0-9]{16,}/g,
  /Bearer\s+[A-Za-z0-9\-_.]+/gi,
  /-----BEGIN[^-]+-----[\s\S]*?-----END[^-]+-----/g,
  /[A-Za-z0-9]{24,}/g,
];

export function redact(input: string): string {
  if (!input) return input;
  let result = input;
  for (const pattern of REDLINE_PATTERNS) {
    result = result.replace(pattern, "•••");
  }
  return result;
}

export function redactAll(values: string[]): string[] {
  return values.map((value) => redact(value));
}
