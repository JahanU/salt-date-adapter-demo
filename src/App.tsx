import React, { createContext, useContext, useMemo, useState } from "react";
import { DateTime } from "luxon";
import moment from "moment";
import type { Moment } from "moment";
import "moment/locale/en-gb.js"; // Moment ships only "en" unless a locale is imported

/* ---------- 1. The contract ---------- */

interface DateAdapter<T> {
  readonly name: string;
  parse(value: string): T;
  format(date: T, style: "short" | "long"): string;
  addDays(date: T, amount: number): T;
  isValid(date: T): boolean;
}

/* ---------- 2. Luxon adapter ---------- */

class AdapterLuxon implements DateAdapter<DateTime> {
  readonly name = "Luxon";
  private readonly locale: string;

  constructor(locale: string) {
    this.locale = locale;
  }

  parse(value: string) {
    return DateTime.fromFormat(value, "yyyy-MM-dd", { locale: this.locale });
  }
  format(date: DateTime, style: "short" | "long") {
    return date.toFormat(style === "short" ? "yyyy-MM-dd" : "cccc, d LLLL yyyy");
  }
  addDays(date: DateTime, amount: number) {
    return date.plus({ days: amount }); // immutable, returns new instance
  }
  isValid(date: DateTime) {
    return date.isValid;
  }
}

/* ---------- 3. Moment adapter ---------- */

class AdapterMoment implements DateAdapter<Moment> {
  readonly name = "Moment";
  private readonly locale: string;

  constructor(locale: string) {
    this.locale = locale;
  }

  parse(value: string) {
    // Locale is passed per-instance; reading the global moment.locale() would
    // make this adapter's output depend on unrelated code.
    return moment(value, "YYYY-MM-DD", this.locale, true); // strict mode
  }
  format(date: Moment, style: "short" | "long") {
    return date.format(style === "short" ? "YYYY-MM-DD" : "dddd, D MMMM YYYY");
  }
  addDays(date: Moment, amount: number) {
    return date.clone().add(amount, "days"); // clone() is mandatory — Moment mutates
  }
  isValid(date: Moment) {
    return date.isValid();
  }
}

/* ---------- 4. Provider ---------- */

// The date type is deliberately `unknown`: consumers hold opaque tokens and can
// only do what the contract allows. A generic the caller chooses would be a
// cast, not a guarantee — nothing ties it to the adapter actually mounted.
const AdapterContext = createContext<DateAdapter<unknown> | null>(null);

function LocalizationProvider({
  DateAdapter: AdapterClass,
  locale,
  children,
}: {
  DateAdapter: new (locale: string) => DateAdapter<unknown>;
  locale: string;
  children: React.ReactNode;
}) {
  const adapter = useMemo(() => new AdapterClass(locale), [AdapterClass, locale]);
  return <AdapterContext.Provider value={adapter}>{children}</AdapterContext.Provider>;
}

function useDateAdapter(): DateAdapter<unknown> {
  const adapter = useContext(AdapterContext);
  if (!adapter) throw new Error("useDateAdapter must be used within a LocalizationProvider");
  return adapter;
}

/* ---------- 5. Consumer — imports no date library ---------- */

function DatePanel({ value }: { value: string }) {
  const adapter = useDateAdapter();
  const date = adapter.parse(value);

  if (!adapter.isValid(date)) {
    return <p style={{ color: "crimson" }}>Invalid date: "{value}"</p>;
  }

  const week = [1, 2, 3, 4, 5, 6, 7].map((n) => adapter.addDays(date, n));

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p><strong>Adapter in use:</strong> {adapter.name}</p>
      <p><strong>Long form:</strong> {adapter.format(date, "long")}</p>
      <p><strong>Next 7 days:</strong></p>
      <ul>
        {week.map((d, i) => (
          <li key={i}>{adapter.format(d, "short")} — {adapter.format(d, "long")}</li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- 6. App: swap adapters at runtime ---------- */

const ADAPTERS = { luxon: AdapterLuxon, moment: AdapterMoment };

export default function App() {
  const [key, setKey] = useState<keyof typeof ADAPTERS>("luxon");
  const [value, setValue] = useState("2026-07-20");

  return (
    <div style={{ fontFamily: "system-ui", padding: 24, maxWidth: 560 }}>
      <h1>Date Adapter Pattern</h1>

      <label>
        Date library:{" "}
        <select value={key} onChange={(e) => setKey(e.target.value as keyof typeof ADAPTERS)}>
          <option value="luxon">Luxon</option>
          <option value="moment">Moment</option>
        </select>
      </label>

      <label style={{ marginLeft: 16 }}>
        Date:{" "}
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="yyyy-MM-dd" />
      </label>

      <hr style={{ margin: "20px 0" }} />

      <LocalizationProvider DateAdapter={ADAPTERS[key]} locale="en-GB">
        <DatePanel value={value} />
      </LocalizationProvider>
    </div>
  );
}
