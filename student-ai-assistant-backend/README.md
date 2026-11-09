# Studora Backend — Phase 1

This is the first Django REST Framework backend foundation for Studora. It includes:
- SQLite database
- Registration and JWT login
- Current-user endpoint
- Private PDF/TXT uploads with basic text extraction
- Document list, detail, and delete endpoints
- Chat/conversation records and message saving
- CORS for the Vite frontend at localhost:5173

**Not implemented yet:** ChromaDB, embeddings, RAG answers, summaries, MCQ generation/evaluation, agentic tool loop, web search, and full frontend integration. Those will be added in later phases.

## 1. Create and activate a virtual environment (Windows PowerShell)
```powershell
py -m venv venv
.env\Scripts\Activate.ps1
```
If PowerShell blocks activation, use Command Prompt:
```bat
venv\Scripts\activate.bat
```

## 2. Install dependencies
```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 3. Create the database tables
```bash
python manage.py makemigrations accounts documents conversations
python manage.py migrate
```

## 4. Create an admin account (optional)
```bash
python manage.py createsuperuser
```

## 5. Run the backend
```bash
python manage.py runserver
```
The API runs at `http://127.0.0.1:8000/`.

## API quick reference
- `POST /api/auth/register/` JSON: `{"username":"student1","email":"student@example.com","password":"StrongPass123"}`
- `POST /api/auth/login/` JSON: `{"username":"student1","password":"StrongPass123"}` → returns `access` and `refresh`
- `GET /api/auth/me/` Authorization: `Bearer <access token>`
- `GET /api/documents/` list own documents
- `POST /api/documents/` multipart form fields: `file` (PDF/TXT), optional `title`
- `GET /api/documents/<id>/` retrieve own document metadata
- `DELETE /api/documents/<id>/` delete own document record
- `GET /api/chat/history/` list own conversations
- `POST /api/chat/conversations/` JSON: `{"title":"Python revision"}`
- `GET /api/chat/conversations/<id>/` retrieve a conversation and messages
- `POST /api/chat/conversations/<id>/messages/` JSON: `{"content":"Explain loops"}` saves a user message only for now

All private endpoints require `Authorization: Bearer <access token>`.

## Important
- Do not commit real API keys or production secrets. `SECRET_KEY` is a development fallback only.
- Uploaded files are private through authenticated API views; avoid exposing `MEDIA_ROOT` as a public static folder in production.
- PDF text extraction only works for text-based PDFs; scanned PDFs need OCR later.
