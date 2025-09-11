-- Initialize EstateCraft Database
-- This file is executed when the PostgreSQL container starts

-- Create extensions if they don't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create additional schemas if needed
CREATE SCHEMA IF NOT EXISTS estatecraft;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA estatecraft TO estatecraft_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA estatecraft TO estatecraft_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA estatecraft TO estatecraft_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA estatecraft GRANT ALL ON TABLES TO estatecraft_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA estatecraft GRANT ALL ON SEQUENCES IN SCHEMA estatecraft TO estatecraft_user;
