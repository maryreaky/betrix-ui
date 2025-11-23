/**
 * PostgreSQL Schema with Drizzle ORM
 * Type-safe database design
 */

import { pgTable, text, integer, timestamp, boolean, numeric, jsonb, index, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table - complete user data
const users = pgTable(
  "users",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    telegramId: text().unique().notNull(),
    chatId: text().notNull(),
    name: text(),
    phone: text(),
    country: text(),
    tier: text().default("free"), // free, member, vvip
    vvipExpiresAt: timestamp(),
    isVerified: boolean().default(false),
    isPhoneVerified: boolean().default(false),
    isSuspended: boolean().default(false),
    signupCompleteAt: timestamp(),
    createdAt: timestamp().defaultNow(),
    updatedAt: timestamp().defaultNow(),
    preferences: jsonb(), // { favoriteTeams, language, notifications }
    metadata: jsonb(),
  },
  (table) => [
    index("idx_telegram_id").on(table.telegramId),
    index("idx_tier").on(table.tier),
    index("idx_phone_verified").on(table.isPhoneVerified),
  ]
);

// Subscriptions table - track all tier upgrades
const subscriptions = pgTable(
  "subscriptions",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer().notNull().references(() => users.id),
    tier: text().notNull(), // member, vvip
    plan: text(), // daily, weekly, monthly
    amount: numeric().notNull(),
    currency: text().default("KES"),
    startDate: timestamp().defaultNow(),
    endDate: timestamp(),
    status: text().default("active"), // active, expired, cancelled
    createdAt: timestamp().defaultNow(),
    updatedAt: timestamp().defaultNow(),
  },
  (table) => [
    index("idx_user_id").on(table.userId),
    index("idx_tier").on(table.tier),
    index("idx_status").on(table.status),
  ]
);

// Payments table - transaction history
const payments = pgTable(
  "payments",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer().notNull().references(() => users.id),
    subscriptionId: integer().references(() => subscriptions.id),
    amount: numeric().notNull(),
    currency: text().default("KES"),
    method: text().notNull(), // till, paypal, binance, bank, stk
    reference: text().unique(),
    transactionId: text(),
    status: text().default("pending"), // pending, confirmed, failed, refunded
    tier: text(),
    metadata: jsonb(), // till number, wallet, etc
    createdAt: timestamp().defaultNow(),
    verifiedAt: timestamp(),
    failedAt: timestamp(),
  },
  (table) => [
    index("idx_user_id").on(table.userId),
    index("idx_status").on(table.status),
    index("idx_method").on(table.method),
    index("idx_reference").on(table.reference),
  ]
);

// Phone verification OTPs
const phoneVerifications = pgTable(
  "phone_verifications",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer().notNull().references(() => users.id),
    phone: text().notNull(),
    code: text().notNull(),
    attempts: integer().default(0),
    isUsed: boolean().default(false),
    expiresAt: timestamp().notNull(),
    createdAt: timestamp().defaultNow(),
  },
  (table) => [
    index("idx_user_id").on(table.userId),
    index("idx_phone").on(table.phone),
    index("idx_code").on(table.code),
  ]
);

// Match subscriptions - /watch implementation
const matchSubscriptions = pgTable(
  "match_subscriptions",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer().notNull().references(() => users.id),
    fixtureId: integer().notNull(),
    matchTitle: text(),
    teams: text(), // "Team A vs Team B"
    leagueId: integer(),
    alertsEnabled: boolean().default(true),
    goalAlertsEnabled: boolean().default(true),
    oddsAlertsEnabled: boolean().default(false),
    createdAt: timestamp().defaultNow(),
    startTime: timestamp(),
    status: text().default("active"), // active, completed, cancelled
  },
  (table) => [
    index("idx_user_id").on(table.userId),
    index("idx_fixture_id").on(table.fixtureId),
    primaryKey({ columns: [table.userId, table.fixtureId] }),
  ]
);

// Referrals - track user referrals
const referrals = pgTable(
  "referrals",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    referrerId: integer().notNull().references(() => users.id),
    referredUserId: integer().notNull().references(() => users.id),
    referralCode: text().notNull(),
    pointsEarned: integer().default(0),
    status: text().default("pending"), // pending, confirmed, converted
    tier: text(), // tier referred user got
    createdAt: timestamp().defaultNow(),
    confirmedAt: timestamp(),
  },
  (table) => [
    index("idx_referrer_id").on(table.referrerId),
    index("idx_code").on(table.referralCode),
    index("idx_status").on(table.status),
  ]
);

// Predictions history - track user predictions
const predictions = pgTable(
  "predictions",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer().notNull().references(() => users.id),
    fixtureId: integer().notNull(),
    prediction: text().notNull(),
    confidence: numeric().notNull(), // 0-1
    result: text(), // win, loss, draw (after match)
    expectedValue: numeric(),
    createdAt: timestamp().defaultNow(),
    matchDate: timestamp(),
  },
  (table) => [
    index("idx_user_id").on(table.userId),
    index("idx_fixture_id").on(table.fixtureId),
  ]
);

// User preferences - favorites, language, etc
const userPreferences = pgTable(
  "user_preferences",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer().notNull().unique().references(() => users.id),
    language: text().default("en"),
    favoriteTeams: jsonb(), // array of team IDs
    favoriteLeagues: jsonb(), // array of league IDs
    timezone: text().default("Africa/Nairobi"),
    notificationsEnabled: boolean().default(true),
    dailyDigest: boolean().default(true),
    theme: text().default("light"),
    createdAt: timestamp().defaultNow(),
    updatedAt: timestamp().defaultNow(),
  },
  (table) => [index("idx_user_id").on(table.userId)]
);

// Audit log - track all important actions
const auditLogs = pgTable(
  "audit_logs",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: integer().references(() => users.id),
    action: text().notNull(), // signup, payment, tier_upgrade, command_used, etc
    resource: text(), // users, payments, predictions, etc
    resourceId: integer(),
    details: jsonb(),
    ipAddress: text(),
    userAgent: text(),
    createdAt: timestamp().defaultNow(),
  },
  (table) => [
    index("idx_user_id").on(table.userId),
    index("idx_action").on(table.action),
    index("idx_created_at").on(table.createdAt),
  ]
);

// Relations
const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
  payments: many(payments),
  matchSubscriptions: many(matchSubscriptions),
  referralsGiven: many(referrals, { relationName: "referrer" }),
  referralsReceived: many(referrals, { relationName: "referred" }),
  predictions: many(predictions),
  phoneVerifications: many(phoneVerifications),
}));

export {
  users,
  subscriptions,
  payments,
  phoneVerifications,
  matchSubscriptions,
  referrals,
  predictions,
  userPreferences,
  auditLogs,
  usersRelations,
};
