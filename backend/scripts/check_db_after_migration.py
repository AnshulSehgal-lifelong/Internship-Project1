from app.core.config import settings
from sqlalchemy import create_engine, text

# Use a synchronous driver for inspection
sync_url = settings.database_url.replace('+asyncpg', '')
if '://' in sync_url and '+asyncpg' in settings.database_url:
    sync_url = settings.database_url.replace('+asyncpg', '');

print('Using DB URL for checks:', sync_url)
engine = create_engine(sync_url)
with engine.connect() as conn:
    cols = conn.execute(text("select column_name, data_type from information_schema.columns where table_name='users' order by ordinal_position")).fetchall()
    print('\nusers columns:')
    for c in cols:
        print(' -', c[0], c[1])

    emp_exists = conn.execute(text("select to_regclass('public.employees')")).scalar()
    print('\nemployees table present:', bool(emp_exists))

    if emp_exists:
        count = conn.execute(text('select count(*) from employees')).scalar()
        print('employees count:', count)

    users_count = conn.execute(text('select count(*) from users')).scalar()
    print('users count:', users_count)
