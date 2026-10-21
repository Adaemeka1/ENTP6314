"use client";

import { useFormStatus } from "react-dom";

// A submit button that greys out while the form is sending, so people
// don't click twice.
export function SubmitButton({
  children,
  pendingText,
  className = "btn btn-primary",
}: {
  children: React.ReactNode;
  pendingText: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
