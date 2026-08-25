import { pgTable, unique, uuid, varchar, timestamp, index, foreignKey, check, numeric, date, text, integer, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const users = pgTable("users", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_email_key").on(table.email),
]);

export const categories = pgTable("categories", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id"),
	name: varchar({ length: 100 }).notNull(),
	color: varchar({ length: 7 }).default('#6366f1'),
	icon: varchar({ length: 50 }).default('tag'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_categories_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "categories_user_id_fkey"
		}).onDelete("cascade"),
]);

export const transactions = pgTable("transactions", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id"),
	categoryId: uuid("category_id"),
	title: varchar({ length: 200 }).notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	type: varchar({ length: 10 }).notNull(),
	date: date().notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_transactions_date").using("btree", table.date.asc().nullsLast().op("date_ops")),
	index("idx_transactions_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
	index("idx_transactions_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "transactions_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "transactions_category_id_fkey"
		}).onDelete("set null"),
	check("transactions_type_check", sql`(type)::text = ANY ((ARRAY['income'::character varying, 'expense'::character varying])::text[])`),
]);

export const goals = pgTable("goals", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id"),
	title: varchar({ length: 200 }).notNull(),
	targetAmount: numeric("target_amount", { precision: 12, scale:  2 }).notNull(),
	currentAmount: numeric("current_amount", { precision: 12, scale:  2 }).default('0'),
	deadline: date(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "goals_user_id_fkey"
		}).onDelete("cascade"),
]);

export const creditCards = pgTable("credit_cards", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id"),
	name: varchar({ length: 100 }).notNull(),
	dueDay: integer("due_day").notNull(),
	color: varchar({ length: 7 }).default('#6366f1'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_credit_cards_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "credit_cards_user_id_fkey"
		}).onDelete("cascade"),
	check("credit_cards_due_day_check", sql`(due_day >= 1) AND (due_day <= 31)`),
]);

export const cardExpenses = pgTable("card_expenses", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id"),
	cardId: uuid("card_id"),
	month: integer().notNull(),
	year: integer().notNull(),
	amount: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_card_expenses_card_id").using("btree", table.cardId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "card_expenses_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.cardId],
			foreignColumns: [creditCards.id],
			name: "card_expenses_card_id_fkey"
		}).onDelete("cascade"),
	unique("card_expenses_card_id_month_year_key").on(table.cardId, table.month, table.year),
	check("card_expenses_month_check", sql`(month >= 1) AND (month <= 12)`),
]);

export const fixedBills = pgTable("fixed_bills", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id"),
	name: varchar({ length: 100 }).notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	dueDay: integer("due_day"),
	active: boolean().default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_fixed_bills_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fixed_bills_user_id_fkey"
		}).onDelete("cascade"),
	check("fixed_bills_due_day_check", sql`(due_day >= 1) AND (due_day <= 31)`),
]);

export const billPayments = pgTable("bill_payments", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id"),
	billId: uuid("bill_id"),
	month: integer().notNull(),
	year: integer().notNull(),
	paid: boolean().default(false),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_bill_payments_bill_id").using("btree", table.billId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "bill_payments_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.billId],
			foreignColumns: [fixedBills.id],
			name: "bill_payments_bill_id_fkey"
		}).onDelete("cascade"),
	unique("bill_payments_bill_id_month_year_key").on(table.billId, table.month, table.year),
	check("bill_payments_month_check", sql`(month >= 1) AND (month <= 12)`),
]);

export const monthlyConfig = pgTable("monthly_config", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id"),
	month: integer().notNull(),
	year: integer().notNull(),
	estimatedIncome: numeric("estimated_income", { precision: 12, scale:  2 }).default('0'),
	balance: numeric({ precision: 12, scale:  2 }).default('0'),
	investments: numeric({ precision: 12, scale:  2 }).default('0'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_monthly_config_user").using("btree", table.userId.asc().nullsLast(), table.month.asc().nullsLast(), table.year.asc().nullsLast()),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "monthly_config_user_id_fkey"
		}).onDelete("cascade"),
	unique("monthly_config_user_id_month_year_key").on(table.userId, table.month, table.year),
	check("monthly_config_month_check", sql`(month >= 1) AND (month <= 12)`),
]);

export const investmentTypes = pgTable("investment_types", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id"),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	color: varchar({ length: 7 }).default('#6366f1'),
	icon: varchar({ length: 10 }).default('📈'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_investment_types_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "investment_types_user_id_fkey"
		}).onDelete("cascade"),
]);

export const investments = pgTable("investments", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id"),
	typeId: uuid("type_id"),
	name: varchar({ length: 100 }).notNull(),
	investedAmount: numeric("invested_amount", { precision: 12, scale:  2 }).default('0').notNull(),
	currentValue: numeric("current_value", { precision: 12, scale:  2 }).default('0').notNull(),
	monthlyRate: numeric("monthly_rate", { precision: 8, scale:  4 }).default('0'),
	targetPercent: numeric("target_percent", { precision: 5, scale:  2 }).default('0'),
	month: integer(),
	year: integer(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_investments_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "investments_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.typeId],
			foreignColumns: [investmentTypes.id],
			name: "investments_type_id_fkey"
		}).onDelete("cascade"),
	check("investments_month_check", sql`(month >= 1) AND (month <= 12)`),
]);
