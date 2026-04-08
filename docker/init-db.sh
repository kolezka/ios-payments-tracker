#!/bin/bash
set -eu

# Create a restricted application user with minimal privileges.
# The superuser (POSTGRES_USER) is only used for initialization;
# the app connects as APP_DB_USER with limited permissions.

APP_USER="${APP_DB_USER:-app}"
APP_PASS="${APP_DB_PASSWORD:?APP_DB_PASSWORD must be set}"
APP_DB="${POSTGRES_DB:-payment_tracker}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$APP_DB" <<-EOSQL
    -- Create app user if it doesn't exist
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${APP_USER}') THEN
            CREATE ROLE ${APP_USER} LOGIN PASSWORD '${APP_PASS}';
        ELSE
            ALTER ROLE ${APP_USER} PASSWORD '${APP_PASS}';
        END IF;
    END
    \$\$;

    -- Revoke all defaults, then grant only what's needed
    REVOKE ALL ON DATABASE ${APP_DB} FROM PUBLIC;
    GRANT CONNECT ON DATABASE ${APP_DB} TO ${APP_USER};

    -- Schema permissions
    GRANT USAGE ON SCHEMA public TO ${APP_USER};
    GRANT CREATE ON SCHEMA public TO ${APP_USER};

    -- Table permissions (for existing tables)
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_USER};
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_USER};

    -- Default permissions for future tables created by this user
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_USER};
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO ${APP_USER};

    -- Deny dangerous operations
    ALTER ROLE ${APP_USER} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
EOSQL

echo "Database user '${APP_USER}' configured with restricted privileges."
