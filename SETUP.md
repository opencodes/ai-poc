# AI Todo App Setup

## 1. Install dependencies

```bash
npm install --prefix backend
npm install --prefix frontend
```

## 2. Configure environment

```bash
cp backend/.env.example backend/.env
```

Choose provider in `backend/.env`:

- `AI_PROVIDER=huggingface` with `HF_API_KEY`
- `AI_PROVIDER=openai` with `OPENAI_API_KEY`

## 3. Run apps

Backend:
```bash
npm run dev:backend
```

Frontend:
```bash
npm run dev:frontend
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000

## 4. Available API endpoints

- `GET /health`
- `GET /todos`
- `POST /todos`
- `PATCH /todos/:id`
- `DELETE /todos/:id`
- `POST /api/suggest-todos`
- `POST /api/suggest-todos-with-context`
- `POST /api/suggest-next-tasks`
- `POST /api/agent`
- `POST /api/route`
- `POST /api/suggest-todos-langchain`
