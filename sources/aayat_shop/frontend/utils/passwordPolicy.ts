export const PASSWORD_RULES = [
  { key: 'length', label: 'حداقل ۸ حرف', test: (password: string) => password.length >= 8 },
  { key: 'number', label: 'شامل عدد', test: (password: string) => /\d/.test(password) },
  { key: 'symbol', label: 'شامل علامت (!@#$%&*^)', test: (password: string) => /[^\w\s]/.test(password) },
  {
    key: 'case',
    label: 'شامل یک حرف بزرگ و کوچک',
    test: (password: string) => /[a-z]/.test(password) && /[A-Z]/.test(password),
  },
] as const;

export function passwordScore(password: string) {
  return PASSWORD_RULES.filter((rule) => rule.test(password)).length;
}

export function passwordPolicyError(password: string) {
  if (password.length < 8) return 'رمز عبور باید حداقل ۸ حرفی باشد';
  if (!/\d/.test(password)) return 'رمز عبور باید شامل عدد باشد';
  if (!/[^\w\s]/.test(password)) return 'رمز عبور باید شامل علامت باشد';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return 'رمز عبور باید شامل حرف بزرگ و کوچک باشد';
  }
  return null;
}
