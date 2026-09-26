export function formatMoney(value: number, currency = "PKR", locale = "en-PK") {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function formatClubDateTime(value: Date | string, timezone = "Asia/Karachi") {
  return new Intl.DateTimeFormat("en-PK", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatTime(value: Date | string, timezone = "Asia/Karachi") {
  return new Intl.DateTimeFormat("en-PK", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
