export function isSixDigitEmailOtp(value: string) {
  return /^\d{6}$/.test(value);
}
