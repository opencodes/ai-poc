const jsonHeaders = { "Content-Type": "application/json" };

async function request(path, options = {}) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getTodos: () => request("/todos"),
  addTodo: (text) => request("/todos", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ text }) }),
  updateTodo: (id, body) => request(`/todos/${id}`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify(body) }),
  deleteTodo: (id) => request(`/todos/${id}`, { method: "DELETE" }),
  suggest: (goal) => request("/api/suggest-todos", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ goal }) }),
  suggestWithContext: (goal) => request("/api/suggest-todos-with-context", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ goal }) }),
  suggestNextTasks: (incompleteTodos) => request("/api/suggest-next-tasks", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ incompleteTodos }) }),
  runAgent: (command) => request("/api/agent", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ command }) }),
  routeIntent: (message) => request("/api/route", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ message }) }),
  suggestLangchain: (goal) => request("/api/suggest-todos-langchain", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ goal }) })
};
