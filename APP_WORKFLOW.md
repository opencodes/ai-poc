# AI Todo App: How It Works

## 1. Start the app
1. Install dependencies:
   - `npm install --prefix backend`
   - `npm install --prefix frontend`
2. Configure backend env:
   - `cp backend/.env.example backend/.env`
   - Set `AI_PROVIDER` and API key (`HF_API_KEY` or `OPENAI_API_KEY`).
3. Run both servers:
   - `npm run dev:backend`
   - `npm run dev:frontend`

## 2. Basic todo flow
1. Frontend calls backend `GET /todos` to load tasks.
2. Add todo from UI -> `POST /todos`.
3. Mark done/undo -> `PATCH /todos/:id`.
4. Delete todo -> `DELETE /todos/:id`.

## 3. AI suggestion flow
1. You enter a goal in frontend.
2. Frontend calls one of these endpoints:
   - `POST /api/suggest-todos` (basic suggestions)
   - `POST /api/suggest-todos-with-context` (RAG using existing todos)
   - `POST /api/suggest-next-tasks` (co-pilot next steps)
   - `POST /api/suggest-todos-langchain` (OpenAI+LangChain mode, HF fallback)
3. Backend generates suggestions and returns a task list.
4. You can click **Add** beside any suggestion to save it as a todo.

## 4. Advanced AI flow
1. **Agent mode** (`POST /api/agent`):
   - You type a natural language command.
   - Backend plans actions (create/complete todo) and updates todos.
2. **Semantic router** (`POST /api/route`):
   - Backend embeds your message.
   - Compares it to intent descriptions (`add`, `suggest`, `complete`).
   - Returns the closest intent.

## 5. Provider behavior
1. `AI_PROVIDER=openai` -> uses OpenAI chat + embeddings.
2. `AI_PROVIDER=huggingface` -> uses Hugging Face Inference API for generation + embeddings.
3. `GET /health` shows provider and AI status.
