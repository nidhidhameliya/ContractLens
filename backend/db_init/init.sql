-- Runs automatically on first DB start (inside Docker)
-- Enables the pgvector extension for semantic search on decisions

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
