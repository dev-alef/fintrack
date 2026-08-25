CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bill_payments" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"bill_id" uuid,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"paid" boolean DEFAULT false,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "bill_payments_bill_id_month_year_key" UNIQUE("bill_id","month","year"),
	CONSTRAINT "bill_payments_month_check" CHECK ((month >= 1) AND (month <= 12))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "card_expenses" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"card_id" uuid,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "card_expenses_card_id_month_year_key" UNIQUE("card_id","month","year"),
	CONSTRAINT "card_expenses_month_check" CHECK ((month >= 1) AND (month <= 12))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"name" varchar(100) NOT NULL,
	"color" varchar(7) DEFAULT '#6366f1',
	"icon" varchar(50) DEFAULT 'tag',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_cards" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"name" varchar(100) NOT NULL,
	"due_day" integer NOT NULL,
	"color" varchar(7) DEFAULT '#6366f1',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "credit_cards_due_day_check" CHECK ((due_day >= 1) AND (due_day <= 31))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fixed_bills" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"name" varchar(100) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"due_day" integer,
	"active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "fixed_bills_due_day_check" CHECK ((due_day >= 1) AND (due_day <= 31))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goals" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"title" varchar(200) NOT NULL,
	"target_amount" numeric(12, 2) NOT NULL,
	"current_amount" numeric(12, 2) DEFAULT '0',
	"deadline" date,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "investment_types" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"name" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(7) DEFAULT '#6366f1',
	"icon" varchar(10) DEFAULT '📈',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "investments" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"type_id" uuid,
	"name" varchar(100) NOT NULL,
	"invested_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"current_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"monthly_rate" numeric(8, 4) DEFAULT '0',
	"target_percent" numeric(5, 2) DEFAULT '0',
	"month" integer,
	"year" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "investments_month_check" CHECK ((month >= 1) AND (month <= 12))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monthly_config" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"estimated_income" numeric(12, 2) DEFAULT '0',
	"balance" numeric(12, 2) DEFAULT '0',
	"investments" numeric(12, 2) DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "monthly_config_user_id_month_year_key" UNIQUE("user_id","month","year"),
	CONSTRAINT "monthly_config_month_check" CHECK ((month >= 1) AND (month <= 12))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid,
	"category_id" uuid,
	"title" varchar(200) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"type" varchar(10) NOT NULL,
	"date" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "transactions_type_check" CHECK ((type)::text = ANY ((ARRAY['income'::character varying, 'expense'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_key" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "public"."fixed_bills"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "card_expenses" ADD CONSTRAINT "card_expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "card_expenses" ADD CONSTRAINT "card_expenses_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."credit_cards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fixed_bills" ADD CONSTRAINT "fixed_bills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "investment_types" ADD CONSTRAINT "investment_types_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "investments" ADD CONSTRAINT "investments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "investments" ADD CONSTRAINT "investments_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "public"."investment_types"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "monthly_config" ADD CONSTRAINT "monthly_config_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bill_payments_bill_id" ON "bill_payments" USING btree ("bill_id" uuid_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_card_expenses_card_id" ON "card_expenses" USING btree ("card_id" uuid_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_categories_user_id" ON "categories" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_credit_cards_user_id" ON "credit_cards" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_fixed_bills_user_id" ON "fixed_bills" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_investment_types_user_id" ON "investment_types" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_investments_user_id" ON "investments" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_monthly_config_user" ON "monthly_config" USING btree ("user_id", "month", "year");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transactions_date" ON "transactions" USING btree ("date" date_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transactions_type" ON "transactions" USING btree ("type" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transactions_user_id" ON "transactions" USING btree ("user_id" uuid_ops);
