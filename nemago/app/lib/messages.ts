// Friendly text for the short error codes our auth actions put in the URL.
const ERRORS: Record<string, string> = {
  invalid_credentials: "That email and password don't match. Try again or reset your password.",
  email_not_confirmed: "Please confirm your email first. Check your inbox for the link we sent.",
  weak_password: "Your password needs at least 8 characters.",
  password_mismatch: "The two passwords don't match.",
  role_missing: "Please choose whether you're a driver or a mechanic.",
  over_email_send_rate_limit: "Too many emails sent. Please wait a few minutes and try again.",
  oauth: "Google sign-in didn't work. Please try again.",
  link_expired: "That link has expired or was already used. Please try again.",
  generic: "Something went wrong. Please try again.",
};

export function errorMessage(code: string | undefined) {
  if (!code) return null;
  return ERRORS[code] ?? ERRORS.generic;
}
