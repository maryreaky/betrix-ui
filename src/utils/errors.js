/**
 * Custom error classes for better error handling
 */

class BetrixError extends Error {
  constructor(message, code = "UNKNOWN", statusCode = 500) {
    super(message);
    this.name = "BetrixError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

class ValidationError extends BetrixError {
  constructor(message) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

class NotFoundError extends BetrixError {
  constructor(message) {
    super(message, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

class PaymentError extends BetrixError {
  constructor(message, provider = "UNKNOWN") {
    super(message, `PAYMENT_ERROR_${provider}`, 402);
    this.name = "PaymentError";
    this.provider = provider;
  }
}

class APIError extends BetrixError {
  constructor(message, statusCode = 500) {
    super(message, "API_ERROR", statusCode);
    this.name = "APIError";
  }
}

class TimeoutError extends BetrixError {
  constructor(message = "Request timeout") {
    super(message, "TIMEOUT", 504);
    this.name = "TimeoutError";
  }
}

export { BetrixError, ValidationError, NotFoundError, PaymentError, APIError, TimeoutError };
