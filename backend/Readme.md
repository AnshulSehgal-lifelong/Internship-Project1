## TalentFlow HR Backend

This backend uses FastAPI with an async PostgreSQL database layer and a small set of starter routes for learning and extension.

### Run locally

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

### What is included

- FastAPI app entrypoint at `main.py`
- Async SQLAlchemy session setup
- Starter CRUD routers for employees, departments, and job openings
- JWT auth scaffolding
- Upload and AI route placeholders for later expansion

### Next step

Set `DATABASE_URL` in a `.env` file if you need a different PostgreSQL host, but the default points to the `talentflow` database on localhost.
