CREATE TABLE onboarding_drafts (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  dismissed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  ai_window timestamptz NOT NULL DEFAULT now(),
  ai_calls integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE onboarding_commits (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  request_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);
