Alembic migrations for this project.

To run migrations:

1. Activate the backend virtualenv.

2. From the `backend` folder run:

```bash
alembic upgrade head
```

If `alembic` is not installed in the venv, install it:

```bash
pip install alembic
```

This repository includes a migration that merges the `employees` table into `users`. Review `alembic/versions/20260515_merge_employee_into_user.py` before running and BACKUP your database.