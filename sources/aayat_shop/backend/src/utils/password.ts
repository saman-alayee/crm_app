const RULES: { test: (password: string) => boolean; message: string }[] = [
  { test: (password) => password.length >= 8, message: 'رمز عبور باید حداقل ۸ حرفی باشد' },
  { test: (password) => /\d/.test(password), message: 'رمز عبور باید شامل عدد باشد' },
  { test: (password) => /[^\w\s]/.test(password), message: 'رمز عبور باید شامل علامت باشد' },
  {
    test: (password) => /[a-z]/.test(password) && /[A-Z]/.test(password),
    message: 'رمز عبور باید شامل حرف بزرگ و کوچک باشد',
  },
];

export function passwordPolicyError(password: string): string | null {
  return RULES.find((rule) => !rule.test(password))?.message ?? null;
}
