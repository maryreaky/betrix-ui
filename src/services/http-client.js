/**
 * HTTP client with retry, timeout, and error handling
 */

import fetch from "node-fetch";
import { Logger } from "../utils/logger.js";
import { APIError, TimeoutError } from "../utils/errors.js";

const logger = new Logger("HttpClient");

class HttpClient {
  /**
   * Fetch with retries and timeout
   */
  static async fetch(url, options = {}, label = "request", retries = 2, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timer);

      const text = await response.text();
      if (!response.ok) {
        throw new APIError(`HTTP ${response.status} ${response.statusText} ${text}`, response.status);
      }

      // Handle empty responses
      if (!text) return {};

      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } catch (err) {
      clearTimeout(timer);

      if (err.name === "AbortError") {
        throw new TimeoutError(`${label} timed out after ${timeoutMs}ms`);
      }

      if (retries > 0) {
        logger.warn(`Retry ${label}: ${err.message} (${retries} retries left)`);
        await new Promise(r => setTimeout(r, 600));
        return HttpClient.fetch(url, options, label, retries - 1, timeoutMs);
      }

      throw new APIError(`${label} failed: ${err.message}`);
    }
  }
}

export { HttpClient };
