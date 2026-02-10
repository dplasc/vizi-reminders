"use client";

import { useEffect, useState } from "react";

function normalizeToISO(input: string): string {
  let s = input.trim();
  if (/^\d{4}-\d{2}-\d{2} \d/.test(s)) {
    s = s.replace(/^(\d{4}-\d{2}-\d{2}) /, "$1T");
  }
  if (s.endsWith("+00")) {
    s = s.slice(0, -3) + "Z";
  }
  if (/[+-]\d{4}$/.test(s)) {
    s = s.replace(/([+-])(\d{2})(\d{2})$/, "$1$2:$3");
  }
  if (/[+-]\d{2}$/.test(s)) {
    s = s.replace(/([+-])(\d{2})$/, "$1$2:00");
  }
  return s;
}

function parseAsUTCWhenNoTZ(input: string): Date {
  const s = input.trim();
  const hasTZ =
    s.endsWith("Z") ||
    /[+-]\d{2}:\d{2}$/.test(s) ||
    /[+-]\d{4}$/.test(s) ||
    /[+-]\d{2}$/.test(s);
  if (hasTZ) {
    return new Date(normalizeToISO(s));
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const [, Y, M, D, hh, mm, ss] = m;
    return new Date(
      Date.UTC(
        parseInt(Y!, 10),
        parseInt(M!, 10) - 1,
        parseInt(D!, 10),
        parseInt(hh!, 10),
        parseInt(mm!, 10),
        parseInt(ss ?? "0", 10)
      )
    );
  }
  return new Date(s);
}

export function ZagrebTime({ iso }: { iso: string }) {
  const [text, setText] = useState("");

  useEffect(() => {
    const d = parseAsUTCWhenNoTZ(iso);
    const date = Number.isNaN(d.getTime()) ? new Date(iso) : d;
    const t = date.toLocaleTimeString("hr-HR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Zagreb",
    });
    setText(t);
  }, [iso]);

  if (!text) {
    return <span className="tabular-nums">--:--</span>;
  }
  return <span className="tabular-nums">{text}</span>;
}
