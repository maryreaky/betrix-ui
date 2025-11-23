/**
 * OTP Service - Phone Verification
 */

import twilio from "twilio";
import { Logger } from "../utils/logger.js";
import { db } from "../database/db.js";
import { phoneVerifications, users } from "../database/schema.js";
import { eq } from "drizzle-orm";

const logger = new Logger("OTPService");

class OTPService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.fromPhone = process.env.TWILIO_PHONE_NUMBER;
  }

  /**
   * Generate and send OTP
   */
  async sendOTP(userId, phoneNumber) {
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store OTP in database
      await db.insert(phoneVerifications).values({
        userId,
        phone: phoneNumber,
        code,
        expiresAt,
      });

      // Send SMS
      const message = await this.client.messages.create({
        body: `Your BETRIX verification code is: ${code}. Valid for 10 minutes.`,
        from: this.fromPhone,
        to: phoneNumber,
      });

      logger.info(`OTP sent: ${userId} -> ${phoneNumber}`);
      return { success: true, messageId: message.sid };
    } catch (err) {
      logger.error("Send OTP failed", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOTP(userId, code) {
    try {
      const verification = await db.query.phoneVerifications.findFirst({
        where: eq(phoneVerifications.userId, userId),
      });

      if (!verification) {
        return { success: false, error: "No OTP found" };
      }

      if (verification.isUsed) {
        return { success: false, error: "OTP already used" };
      }

      if (new Date() > verification.expiresAt) {
        return { success: false, error: "OTP expired" };
      }

      if (verification.code !== code) {
        // Increment attempts
        await db
          .update(phoneVerifications)
          .set({ attempts: verification.attempts + 1 })
          .where(eq(phoneVerifications.id, verification.id));

        if (verification.attempts >= 3) {
          return { success: false, error: "Too many attempts" };
        }

        return { success: false, error: "Invalid code" };
      }

      // Mark as used
      await db
        .update(phoneVerifications)
        .set({ isUsed: true })
        .where(eq(phoneVerifications.id, verification.id));

      // Update user
      await db
        .update(users)
        .set({ isPhoneVerified: true, phone: verification.phone })
        .where(eq(users.id, userId));

      logger.info(`OTP verified: ${userId}`);
      return { success: true };
    } catch (err) {
      logger.error("Verify OTP failed", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phone, country = "KE") {
    const patterns = {
      KE: /^(?:\+254|0)(?:7|1)[0-9]{8}$/,
      NG: /^(?:\+234|0)[789][01]\d{8}$/,
      ZA: /^(?:\+27|0)[1-9]\d{8}$/,
      US: /^(?:\+1)?[2-9]\d{2}[2-9](?!11)\d{6}$/,
      GB: /^(?:\+44|0)[1-9]\d{9,10}$/,
    };

    const pattern = patterns[country] || patterns.KE;
    return pattern.test(phone);
  }

  /**
   * Format phone number to international
   */
  formatPhoneNumber(phone, country = "KE") {
    const countryCode = {
      KE: "+254",
      NG: "+234",
      ZA: "+27",
      US: "+1",
      GB: "+44",
    }[country] || "+254";

    // Remove leading 0 if present
    let cleaned = phone.replace(/^0/, "");

    // Remove all non-digits
    cleaned = cleaned.replace(/\D/g, "");

    return `${countryCode}${cleaned}`;
  }
}

export { OTPService };
