"""Merge employees table into users and add employee fields to users.

Revision ID: merge_employee_into_user
Revises: 
Create Date: 2026-05-15 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = 'merge_employee_into_user'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # 1) Add columns to users table
    op.add_column('users', sa.Column('department_id', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('salary', sa.Numeric(), nullable=True))
    op.add_column('users', sa.Column('hire_date', sa.Date(), nullable=True))

    # 2) Create FK users.department_id -> departments.id if not exists
    # Use raw SQL to be idempotent
    op.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_department_id_fkey;"))
    op.execute(text("ALTER TABLE users ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id);") )

    # 3) Re-point departments.manager_id FK to users(id)
    op.execute(text("ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_manager_id_fkey;"))
    op.execute(text("ALTER TABLE departments ADD CONSTRAINT departments_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES users(id);") )

    # 4) Migrate data from employees -> users if employees table exists
    # Insert users for employees that don't already have a user with same email
        insert_sql = text(r"""
        INSERT INTO users (first_name, last_name, role, email, hashed_password, is_active, department_id, salary, hire_date)
        SELECT
            split_part(name, ' ', 1) as first_name,
            NULLIF(substr(name, char_length(split_part(name, ' ', 1)) + 2), '') as last_name,
            role,
            email,
            md5(random()::text || clock_timestamp()::text) as hashed_password,
            false as is_active,
            department_id,
            salary,
            hire_date
        FROM employees e
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.email = e.email);
        """)

    try:
        # Only run if employees table exists
        res = conn.execute(text("SELECT to_regclass('public.employees')"))
        exists = res.scalar()
        if exists:
            conn.execute(insert_sql)
            # commit intermediate results
            op.get_context().impl.bind.execute(text('COMMIT'))
            # Finally drop employees table
            op.execute(text('DROP TABLE employees'))
    except Exception as exc:
        # If employees table doesn't exist or migration fails, surface warning but continue
        print('Warning during employees->users data migration:', exc)


def downgrade():
    conn = op.get_bind()

    # Recreate employees table (best-effort)
    op.execute(text('CREATE TABLE IF NOT EXISTS employees (id SERIAL PRIMARY KEY, name VARCHAR(120), email VARCHAR(255) UNIQUE, department_id INTEGER, role VARCHAR(120), salary DOUBLE PRECISION, hire_date DATE);'))

    # Copy back data from users into employees for rows that look like employees
    op.execute(text(r"""
    INSERT INTO employees (name, email, department_id, role, salary, hire_date)
    SELECT concat_ws(' ', first_name, last_name) as name, email, department_id, role, salary, hire_date
    FROM users
    WHERE department_id IS NOT NULL OR salary IS NOT NULL OR hire_date IS NOT NULL
    ON CONFLICT (email) DO NOTHING;
    """))

    # Remove FK from departments to users and recreate pointing to employees
    op.execute(text('ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_manager_id_fkey;'))
    op.execute(text('ALTER TABLE departments ADD CONSTRAINT departments_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES employees(id);'))

    # Drop FK users.department_id
    op.execute(text('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_department_id_fkey;'))

    # Drop employee columns from users
    op.drop_column('users', 'department_id')
    op.drop_column('users', 'salary')
    op.drop_column('users', 'hire_date')
