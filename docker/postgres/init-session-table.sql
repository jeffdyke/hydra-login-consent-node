-- PostgreSQL initialization script for session storage
-- This script is idempotent and can be run multiple times safely
-- Used by connect-pg-simple for express-session storage

-- Create session table if it doesn't exist
-- Schema matches connect-pg-simple v10.x requirements
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
) WITH (OIDS=FALSE);

-- Create index on expire column for efficient cleanup
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Grant permissions to hydra user
-- This ensures the application can read/write session data
GRANT SELECT, INSERT, UPDATE, DELETE ON "session" TO hydra;

-- Log successful initialization
DO $$
BEGIN
  RAISE NOTICE 'Session table initialization complete';
  RAISE NOTICE 'Table: session';
  RAISE NOTICE 'Purpose: Express session storage for OAuth2 flows';
  RAISE NOTICE 'Used by: connect-pg-simple middleware';
END $$;
