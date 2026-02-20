-- Runs once on first container start
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create test database alongside main
CREATE DATABASE anatoview_test
  WITH TEMPLATE anatoview
  OWNER anatoview;
