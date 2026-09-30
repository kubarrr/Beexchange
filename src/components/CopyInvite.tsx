"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";

export function CopyInvite({ label, copiedLabel }: { label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-primary"
      onClick={async () => {
        await navigator.clipboard.writeText(window.location.origin);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      <Link2 size={18} /> {copied ? copiedLabel : label}
    </button>
  );
}
