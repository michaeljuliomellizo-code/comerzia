// Utilidades de formato para COMERZIA

const CURRENCY_DIGITS: Record<string, number> = {
  COP: 0,
  MXN: 2,
  USD: 2,
  EUR: 2,
};

export function formatMoney(value: number, currency = "COP"): string {
  const digits = CURRENCY_DIGITS[currency] ?? 2;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatCompact(value: number, currency = "COP"): string {
  const digits = CURRENCY_DIGITS[currency] ?? 2;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-CO").format(value);
}

export function formatDate(date: string | Date, withTime = true): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  };
  if (withTime) {
    opts.hour = "2-digit";
    opts.minute = "2-digit";
  }
  return new Intl.DateTimeFormat("es-CO", opts).format(d);
}

export function formatDayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(d);
}
