/**
 * Small, framework-free validators shared between the app (main.js) and
 * its test suite — kept in their own module specifically so tests can
 * import them without pulling in main.js (which runs DOM-dependent boot
 * code at module load time).
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(String(value || "").trim());
}

export function isValidPassword(value) {
  return String(value || "").length >= 8;
}
