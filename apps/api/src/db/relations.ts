import { relations } from "drizzle-orm/relations";
import { users, categories, transactions, goals, creditCards, cardExpenses, fixedBills, billPayments, monthlyConfig, investmentTypes, investments } from "./schema";

export const categoriesRelations = relations(categories, ({one, many}) => ({
	user: one(users, {
		fields: [categories.userId],
		references: [users.id]
	}),
	transactions: many(transactions),
}));

export const usersRelations = relations(users, ({many}) => ({
	categories: many(categories),
	transactions: many(transactions),
	goals: many(goals),
	creditCards: many(creditCards),
	cardExpenses: many(cardExpenses),
	fixedBills: many(fixedBills),
	billPayments: many(billPayments),
	monthlyConfigs: many(monthlyConfig),
	investmentTypes: many(investmentTypes),
	investments: many(investments),
}));

export const transactionsRelations = relations(transactions, ({one}) => ({
	user: one(users, {
		fields: [transactions.userId],
		references: [users.id]
	}),
	category: one(categories, {
		fields: [transactions.categoryId],
		references: [categories.id]
	}),
}));

export const goalsRelations = relations(goals, ({one}) => ({
	user: one(users, {
		fields: [goals.userId],
		references: [users.id]
	}),
}));

export const creditCardsRelations = relations(creditCards, ({one, many}) => ({
	user: one(users, {
		fields: [creditCards.userId],
		references: [users.id]
	}),
	cardExpenses: many(cardExpenses),
}));

export const cardExpensesRelations = relations(cardExpenses, ({one}) => ({
	user: one(users, {
		fields: [cardExpenses.userId],
		references: [users.id]
	}),
	creditCard: one(creditCards, {
		fields: [cardExpenses.cardId],
		references: [creditCards.id]
	}),
}));

export const fixedBillsRelations = relations(fixedBills, ({one, many}) => ({
	user: one(users, {
		fields: [fixedBills.userId],
		references: [users.id]
	}),
	billPayments: many(billPayments),
}));

export const billPaymentsRelations = relations(billPayments, ({one}) => ({
	user: one(users, {
		fields: [billPayments.userId],
		references: [users.id]
	}),
	fixedBill: one(fixedBills, {
		fields: [billPayments.billId],
		references: [fixedBills.id]
	}),
}));

export const monthlyConfigRelations = relations(monthlyConfig, ({one}) => ({
	user: one(users, {
		fields: [monthlyConfig.userId],
		references: [users.id]
	}),
}));

export const investmentTypesRelations = relations(investmentTypes, ({one, many}) => ({
	user: one(users, {
		fields: [investmentTypes.userId],
		references: [users.id]
	}),
	investments: many(investments),
}));

export const investmentsRelations = relations(investments, ({one}) => ({
	user: one(users, {
		fields: [investments.userId],
		references: [users.id]
	}),
	investmentType: one(investmentTypes, {
		fields: [investments.typeId],
		references: [investmentTypes.id]
	}),
}));