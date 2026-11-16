/** Shared signup password rule: 8+ characters, with a letter and a number. */
export function signupPasswordIssue(value: string): string | null {
    const password = String(value || '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim();
    if (password.length < 8) return 'Use at least 8 characters.';
    if (!/[A-Za-z]/.test(password)) return 'Include a letter.';
    if (!/\d/.test(password)) return 'Include a number.';
    return null;
}
