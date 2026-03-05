import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

export default function App() {
  const [todos, setTodos] = useState([]);
  const [todoInput, setTodoInput] = useState("");
  const [goal, setGoal] = useState("");
  const [routeText, setRouteText] = useState("");
  const [agentCommand, setAgentCommand] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [contextSuggestions, setContextSuggestions] = useState([]);
  const [nextSuggestions, setNextSuggestions] = useState([]);
  const [langchainSuggestions, setLangchainSuggestions] = useState([]);
  const [routeResult, setRouteResult] = useState(null);
  const [agentResult, setAgentResult] = useState(null);
  const [error, setError] = useState("");

  const incompleteTodos = useMemo(() => todos.filter((t) => !t.completed), [todos]);

  async function loadTodos() {
    try {
      const data = await api.getTodos();
      setTodos(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadTodos();
  }, []);

  async function addTodo(text = todoInput) {
    const clean = String(text || "").trim();
    if (!clean) return;

    try {
      const created = await api.addTodo(clean);
      setTodos((prev) => [...prev, created]);
      if (text === todoInput) setTodoInput("");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleTodo(todo) {
    try {
      const updated = await api.updateTodo(todo.id, { completed: !todo.completed });
      setTodos((prev) => prev.map((item) => (item.id === todo.id ? updated : item)));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteTodo(id) {
    try {
      await api.deleteTodo(id);
      setTodos((prev) => prev.filter((todo) => todo.id !== id));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function run(fn) {
    try {
      const data = await fn();
      setError("");
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }

  return (
    <div className="app">
      <h1>AI-Powered Todo App (5 Phases)</h1>
      <p className="muted">Backend: Express + OpenAI/LangChain | Frontend: React + Vite</p>
      {error ? <p className="error">{error}</p> : null}

      <div className="grid">
        <section className="card">
          <h2>Todos</h2>
          <div className="row">
            <input
              placeholder="Add a todo"
              value={todoInput}
              onChange={(e) => setTodoInput(e.target.value)}
              onKeyDown={(e) => (e.key === "Enter" ? addTodo() : null)}
            />
            <button onClick={() => addTodo()}>Add</button>
          </div>
          <div>
            {todos.map((todo) => (
              <div key={todo.id} className={`todo-item ${todo.completed ? "done" : ""}`}>
                <span>{todo.text}</span>
                <div className="row" style={{ marginBottom: 0 }}>
                  <button className="secondary" onClick={() => toggleTodo(todo)}>
                    {todo.completed ? "Undo" : "Done"}
                  </button>
                  <button className="secondary" onClick={() => deleteTodo(todo.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Goal Input</h2>
          <textarea
            rows={4}
            placeholder="Example: Build and launch a portfolio website in 2 weeks"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
          <div className="row" style={{ marginTop: 12 }}>
            <button
              onClick={async () => {
                const data = await run(() => api.suggest(goal));
                if (data) setSuggestions(data.suggestions || []);
              }}
            >
              Phase 1/2 Suggest
            </button>
            <button
              onClick={async () => {
                const data = await run(() => api.suggestWithContext(goal));
                if (data) setContextSuggestions(data.suggestions || []);
              }}
            >
              Phase 3 RAG Suggest
            </button>
            <button
              onClick={async () => {
                const data = await run(() => api.suggestLangchain(goal));
                if (data) setLangchainSuggestions(data.suggestions || []);
              }}
            >
              Phase 5 LangChain Suggest
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Suggestions</h2>
          <h3>Phase 1/2</h3>
          <ul>
            {suggestions.map((item, idx) => (
              <li key={`s-${idx}`}>
                {item} <button className="secondary" onClick={() => addTodo(item)}>Add</button>
              </li>
            ))}
          </ul>

          <h3>Phase 3 (Context / RAG)</h3>
          <ul>
            {contextSuggestions.map((item, idx) => (
              <li key={`c-${idx}`}>
                {item} <button className="secondary" onClick={() => addTodo(item)}>Add</button>
              </li>
            ))}
          </ul>

          <h3>Phase 5 (LangChain)</h3>
          <ul>
            {langchainSuggestions.map((item, idx) => (
              <li key={`l-${idx}`}>
                {item} <button className="secondary" onClick={() => addTodo(item)}>Add</button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>Phase 4 Patterns</h2>

          <h3>Co-pilot: Suggest Next Tasks</h3>
          <div className="row">
            <button
              onClick={async () => {
                const data = await run(() => api.suggestNextTasks(incompleteTodos.map((t) => t.text)));
                if (data) setNextSuggestions(data.suggestions || []);
              }}
            >
              Get Next Tasks
            </button>
          </div>
          <ul>
            {nextSuggestions.map((item, idx) => (
              <li key={`n-${idx}`}>
                {item} <button className="secondary" onClick={() => addTodo(item)}>Add</button>
              </li>
            ))}
          </ul>

          <h3>Autonomous Agent</h3>
          <div className="row">
            <input
              placeholder='Example: Add "Create wireframes" and mark todo 2 done'
              value={agentCommand}
              onChange={(e) => setAgentCommand(e.target.value)}
            />
            <button
              onClick={async () => {
                const data = await run(() => api.runAgent(agentCommand));
                if (data) {
                  setAgentResult(data);
                  setTodos(data.todos || []);
                }
              }}
            >
              Run Agent
            </button>
          </div>
          {agentResult ? <p className="muted">Actions: {JSON.stringify(agentResult.actions || [])}</p> : null}

          <h3>Semantic Router</h3>
          <div className="row">
            <input
              placeholder="Example: suggest tasks for learning docker"
              value={routeText}
              onChange={(e) => setRouteText(e.target.value)}
            />
            <button
              onClick={async () => {
                const data = await run(() => api.routeIntent(routeText));
                if (data) setRouteResult(data);
              }}
            >
              Classify Intent
            </button>
          </div>
          {routeResult ? <p className="muted">Intent: {routeResult.intent} (score: {routeResult.score?.toFixed?.(3)})</p> : null}
        </section>
      </div>
    </div>
  );
}
