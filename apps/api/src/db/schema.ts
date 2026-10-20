import { pgTable, jsonb, primaryKey, unique, uniqueIndex, uuid, varchar, timestamp, index, foreignKey, check, numeric, date, text, integer, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const users = pgTable("users", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	// Passa a aceitar nulo: o Better Auth guarda a credencial na tabela account,
	// nao aqui. Sem isso, todo cadastro novo violaria o NOT NULL. Os hashes
	// existentes permanecem nesta coluna e sao a rota de volta caso a migracao
	// precise ser revertida.
	password: varchar({ length: 255 }),
	emailVerified: boolean("emailVerified").default(false).notNull(),
	image: text(),
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

export const loans = pgTable("loans", {
	id: uuid().defaultRandom().primaryKey(),
	userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
	direction: varchar({ length: 10 }).notNull(),
	person: varchar({ length: 120 }).notNull(),
	description: varchar({ length: 300 }).default('').notNull(),
	amount: numeric({ precision: 12, scale: 2 }).notNull(),
	dueDate: date("due_date"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("loans_user_id_idx").on(table.userId),
	check("loans_direction_check", sql`${table.direction} IN ('payable', 'receivable')`),
	check("loans_person_check", sql`length(trim(${table.person})) > 0`),
	check("loans_amount_check", sql`${table.amount} > 0 AND ${table.amount} <= 999999999.99`),
]);

export const loanPayments = pgTable("loan_payments", {
	id: uuid().primaryKey(),
	loanId: uuid("loan_id").notNull().references(() => loans.id, { onDelete: "cascade" }),
	amount: numeric({ precision: 12, scale: 2 }).notNull(),
	paidOn: date("paid_on").notNull(),
	notes: varchar({ length: 300 }).default('').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("loan_payments_loan_id_idx").on(table.loanId),
	check("loan_payments_amount_check", sql`${table.amount} > 0 AND ${table.amount} <= 999999999.99`),
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

// ── BETTER AUTH ──────────────────────────────────────────────
// Tabelas do Better Auth. A tabela `users` acima e reaproveitada como modelo
// de usuario dele, entao userId aqui e UUID, e nao text como o CLI do Better
// Auth gera por padrao: a chave estrangeira precisa ter o mesmo tipo da coluna
// referenciada, senao o Postgres recusa a criacao.

export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp("expiresAt", { withTimezone: true, mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp("createdAt", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updatedAt", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	ipAddress: text("ipAddress"),
	userAgent: text("userAgent"),
	userId: uuid("userId").notNull(),
}, (table) => [
	index("session_userId_idx").using("btree", table.userId.asc().nullsLast()),
	unique("session_token_key").on(table.token),
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "session_userId_fkey"
	}).onDelete("cascade"),
]);

export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	// Campo introduzido no Better Auth 1.7: a identidade da conta passou a ser
	// escopada por emissor. O CLI de geracao de schema esta numa versao anterior
	// e nao produz esta coluna - sem ela o cadastro falha com "column issuer of
	// relation account does not exist".
	issuer: text(),
	accountId: text("accountId").notNull(),
	providerId: text("providerId").notNull(),
	userId: uuid("userId").notNull(),
	accessToken: text("accessToken"),
	refreshToken: text("refreshToken"),
	idToken: text("idToken"),
	accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true, mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true, mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp("createdAt", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updatedAt", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("account_userId_idx").using("btree", table.userId.asc().nullsLast()),
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "account_userId_fkey"
	}).onDelete("cascade"),
]);

export const verification = pgTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expiresAt", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("createdAt", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updatedAt", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("verification_identifier_idx").using("btree", table.identifier.asc().nullsLast()),
]);

export const professionalClients = pgTable('professional_clients', {
  id: uuid().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar({ length: 120 }).notNull(),
  contact: varchar({ length: 200 }).notNull().default(''),
  notes: varchar({ length: 500 }).notNull().default(''),
  archived: boolean().notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, table => [
  unique('professional_clients_id_user_id_key').on(table.id, table.userId),
  index('professional_clients_user_idx').on(table.userId),
  check('professional_clients_name_check', sql`length(trim(${table.name})) > 0`),
]);

export const serviceSubscriptions = pgTable('service_subscriptions', {
  id: uuid().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull(),
  serviceName: varchar('service_name', { length: 150 }).notNull(),
  amount: numeric({ precision: 12, scale: 2 }).notNull(),
  intervalMonths: integer('interval_months').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  notes: varchar({ length: 500 }).notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, table => [
  foreignKey({ columns: [table.clientId, table.userId], foreignColumns: [professionalClients.id, professionalClients.userId], name: 'service_subscriptions_client_id_user_id_fkey' }),
  index('service_subscriptions_user_idx').on(table.userId),
  check('service_subscriptions_service_name_check', sql`length(trim(${table.serviceName})) > 0`),
  check('service_subscriptions_amount_check', sql`${table.amount} > 0 AND ${table.amount} <= 999999999.99`),
  check('service_subscriptions_interval_months_check', sql`${table.intervalMonths} IN (1, 3, 12)`),
  check('service_subscriptions_start_date_check', sql`${table.startDate} BETWEEN '1900-01-01' AND '2100-12-31'`),
  check('service_subscriptions_end_date_check', sql`${table.endDate} BETWEEN '1900-01-01' AND '2100-12-31'`),
]);

export const professionalReceipts = pgTable('professional_receipts', {
  id: uuid().primaryKey(),
  subscriptionId: uuid('subscription_id').notNull().references(() => serviceSubscriptions.id, { onDelete: 'cascade' }),
  dueOn: date('due_on').notNull(), paidOn: date('paid_on').notNull(),
  amount: numeric({ precision: 12, scale: 2 }).notNull(),
  clientName: varchar('client_name', { length: 120 }).notNull(),
  serviceName: varchar('service_name', { length: 150 }).notNull(),
  notes: varchar({ length: 500 }).notNull().default(''),
  voidedAt: timestamp('voided_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, table => [
  uniqueIndex('professional_receipts_period_idx').on(table.subscriptionId, table.dueOn).where(sql`${table.voidedAt} IS NULL`),
  check('professional_receipts_amount_check', sql`${table.amount} > 0 AND ${table.amount} <= 999999999.99`),
]);

export const professionalExpenses = pgTable('professional_expenses', {
  id: uuid().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar({ length: 150 }).notNull(), category: varchar({ length: 80 }).notNull().default(''),
  amount: numeric({ precision: 12, scale: 2 }).notNull(), spentOn: date('spent_on').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  notes: varchar({ length: 500 }).notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, table => [
  index('professional_expenses_user_idx').on(table.userId, table.spentOn),
  check('professional_expenses_title_check', sql`length(trim(${table.title})) > 0`),
  check('professional_expenses_amount_check', sql`${table.amount} > 0 AND ${table.amount} <= 999999999.99`),
]);

export const onboardingDrafts = pgTable('onboarding_drafts', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  version: integer().notNull().default(1), data: jsonb().notNull(), dismissed: boolean().notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  aiWindow: timestamp('ai_window', { withTimezone: true }).notNull().defaultNow(), aiCalls: integer('ai_calls').notNull().default(0),
});
export const onboardingCommits = pgTable('onboarding_commits', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  requestId: uuid('request_id').notNull(), requestHash: text('request_hash').notNull(), result: jsonb().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.userId, table.requestId] })]);
