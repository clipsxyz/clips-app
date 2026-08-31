/** Mask a stored E.164 number for the Security tab, e.g. +353 87 **** 567 */
export function maskPhoneNumber(raw: string | null | undefined): string {
    const trimmed = String(raw || '').trim();
    const digits = trimmed.replace(/\D+/g, '');
    if (digits.length < 8) {
        return trimmed ? '••••' : '';
    }

    let country = '';
    let national = digits;
    if (digits.startsWith('353') && digits.length >= 11) {
        country = '353';
        national = digits.slice(3);
    } else if (digits.startsWith('44') && digits.length >= 11) {
        country = '44';
        national = digits.slice(2);
    } else if (digits.startsWith('1') && digits.length >= 11) {
        country = '1';
        national = digits.slice(1);
    } else if (trimmed.startsWith('+')) {
        const ccLen = Math.min(3, digits.length - 6);
        country = digits.slice(0, ccLen);
        national = digits.slice(ccLen);
    } else {
        country = digits.slice(0, Math.min(3, digits.length - 6));
        national = digits.slice(country.length);
    }

    if (national.startsWith('0')) {
        national = national.slice(1);
    }
    const prefix = national.slice(0, 2);
    const last = national.slice(-3);
    return `+${country} ${prefix} **** ${last}`;
}

/** Build E.164, dropping a leading 0 on the national number (Irish 087 + +353 → +35387…). */
export function toE164Phone(countryCode: string, nationalInput: string): string {
    const ccDigits = String(countryCode || '').replace(/\D+/g, '');
    let national = String(nationalInput || '').replace(/\D+/g, '');
    if (national.startsWith('0')) {
        national = national.slice(1);
    }
    if (ccDigits && national.startsWith(ccDigits)) {
        national = national.slice(ccDigits.length);
    }
    return `+${ccDigits}${national}`;
}
