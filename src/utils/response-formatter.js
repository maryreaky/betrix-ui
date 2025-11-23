/**
 * Response Formatter
 * Formats all bot responses consistently
 */

class ResponseFormatter {
  static success(message, data = {}) {
    return `✅ ${message}\n\n${this.formatData(data)}`;
  }

  static error(message, code = null) {
    return `❌ ${message}${code ? ` (${code})` : ""}`;
  }

  static info(message) {
    return `ℹ️ ${message}`;
  }

  static formatData(obj) {
    if (typeof obj === "string") return obj;
    if (Array.isArray(obj)) return obj.join("\n");
    if (typeof obj === "object") {
      return Object.entries(obj)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
    }
    return String(obj);
  }

  static formatList(items, title = "") {
    let text = title ? `<b>${title}</b>\n\n` : "";
    text += items.map((item, i) => `${i + 1}. ${item}`).join("\n");
    return text;
  }

  static formatTable(headers, rows) {
    let text = "<code>";
    const colWidths = headers.map((h, i) => Math.max(h.length, Math.max(...rows.map(r => String(r[i]).length))));
    
    text += headers.map((h, i) => h.padEnd(colWidths[i])).join(" | ") + "\n";
    text += colWidths.map(w => "─".repeat(w)).join("─┼─") + "\n";
    text += rows.map(row => row.map((cell, i) => String(cell).padEnd(colWidths[i])).join(" | ")).join("\n");
    text += "</code>";
    
    return text;
  }
}

export { ResponseFormatter };
