import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { ChatOpenAI } from "@langchain/openai";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 5000);
const AI_PROVIDER = (process.env.AI_PROVIDER || "openai").toLowerCase();

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

const HF_TEXT_MODEL = process.env.HF_TEXT_MODEL || "HuggingFaceH4/zephyr-7b-beta";
const HF_EMBED_MODEL = process.env.HF_EMBED_MODEL || "sentence-transformers/all-MiniLM-L6-v2";
const HF_API_KEY = process.env.HF_API_KEY || "";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const hfBaseUrl = "https://api-inference.huggingface.co/models";

let todos = [];
let nextId = 1;

function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length || vecA.length === 0) {
    return -1;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i += 1) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (!normA || !normB) return -1;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function parseJsonArray(text) {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item)).slice(0, 10);
    }
  } catch {
    // fallback below
  }

  return String(text)
    .split("\n")
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 10);
}

function parseJsonObject(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function averageRows(matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0 || !Array.isArray(matrix[0])) return null;
  const width = matrix[0].length;
  const out = new Array(width).fill(0);
  let count = 0;

  for (const row of matrix) {
    if (!Array.isArray(row) || row.length !== width) continue;
    for (let i = 0; i < width; i += 1) out[i] += Number(row[i]) || 0;
    count += 1;
  }

  if (!count) return null;
  return out.map((v) => v / count);
}

function normalizeEmbedding(raw) {
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "number") {
    return raw.map((n) => Number(n) || 0);
  }
  if (Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0])) {
    if (typeof raw[0][0] === "number") {
      return averageRows(raw);
    }
    if (Array.isArray(raw[0][0])) {
      return averageRows(raw[0]);
    }
  }
  return null;
}

function isProviderConfigured() {
  if (AI_PROVIDER === "huggingface") return Boolean(HF_API_KEY);
  return Boolean(openai);
}

function ensureProvider(res) {
  if (AI_PROVIDER !== "openai" && AI_PROVIDER !== "huggingface") {
    res.status(400).json({ error: "AI_PROVIDER must be 'openai' or 'huggingface'." });
    return false;
  }
  if (!isProviderConfigured()) {
    if (AI_PROVIDER === "huggingface") {
      res.status(400).json({ error: "HF_API_KEY is missing. Add it to backend/.env." });
      return false;
    }
    res.status(400).json({ error: "OPENAI_API_KEY is missing. Add it to backend/.env." });
    return false;
  }
  return true;
}

async function hfRequest(model, payload) {
  const response = await fetch(`${hfBaseUrl}/${model}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HF_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error || `Hugging Face request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

async function generateText({ system, user, temperature = 0.3, maxTokens = 220 }) {
  if (AI_PROVIDER === "huggingface") {
    const prompt = `${system}\n\nUser: ${user}\nAssistant:`;
    const data = await hfRequest(HF_TEXT_MODEL, {
      inputs: prompt,
      parameters: {
        max_new_tokens: maxTokens,
        temperature,
        return_full_text: false
      },
      options: { wait_for_model: true }
    });

    if (Array.isArray(data) && typeof data[0]?.generated_text === "string") return data[0].generated_text;
    if (typeof data?.generated_text === "string") return data.generated_text;
    return JSON.stringify(data);
  }

  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature,
    max_tokens: maxTokens
  });

  return response.choices[0]?.message?.content || "";
}

async function embedText(text) {
  if (AI_PROVIDER === "huggingface") {
    const data = await hfRequest(HF_EMBED_MODEL, {
      inputs: text,
      options: { wait_for_model: true }
    });
    return normalizeEmbedding(data);
  }

  const resp = await openai.embeddings.create({
    model: OPENAI_EMBEDDING_MODEL,
    input: text
  });
  return resp.data[0]?.embedding || null;
}

async function createTodo(text) {
  const todo = {
    id: nextId++,
    text,
    completed: false,
    embedding: null
  };

  if (isProviderConfigured()) {
    try {
      todo.embedding = await embedText(text);
    } catch {
      // Keep todo creation independent from embedding provider outages.
    }
  }

  todos.push(todo);
  return todo;
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    provider: AI_PROVIDER,
    aiEnabled: isProviderConfigured(),
    todoCount: todos.length
  });
});

app.get("/todos", (_req, res) => {
  res.json(todos.map(({ embedding, ...todo }) => todo));
});

app.post("/todos", async (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const todo = await createTodo(text);
  const { embedding, ...safeTodo } = todo;
  res.status(201).json(safeTodo);
});

app.patch("/todos/:id", async (req, res) => {
  const id = Number(req.params.id);
  const todo = todos.find((item) => item.id === id);
  if (!todo) {
    res.status(404).json({ error: "Todo not found" });
    return;
  }

  if (typeof req.body?.text === "string") {
    const nextText = req.body.text.trim();
    if (nextText) {
      todo.text = nextText;
      if (isProviderConfigured()) {
        try {
          todo.embedding = await embedText(nextText);
        } catch {
          // do nothing
        }
      }
    }
  }

  if (typeof req.body?.completed === "boolean") {
    todo.completed = req.body.completed;
  }

  const { embedding, ...safeTodo } = todo;
  res.json(safeTodo);
});

app.delete("/todos/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = todos.findIndex((item) => item.id === id);
  if (index === -1) {
    res.status(404).json({ error: "Todo not found" });
    return;
  }
  todos.splice(index, 1);
  res.status(204).send();
});

app.post("/api/suggest-todos", async (req, res) => {
  if (!ensureProvider(res)) return;

  const goal = String(req.body?.goal || "").trim();
  if (!goal) {
    res.status(400).json({ error: "goal is required" });
    return;
  }

  try {
    const text = await generateText({
      system: "You are a productivity expert. Return exactly 4 concrete todos as a JSON array of strings. No extra text.",
      user: `Goal: ${goal}`,
      temperature: 0.3,
      maxTokens: 200
    });

    res.json({ suggestions: parseJsonArray(text) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/suggest-todos-with-context", async (req, res) => {
  if (!ensureProvider(res)) return;

  const goal = String(req.body?.goal || "").trim();
  if (!goal) {
    res.status(400).json({ error: "goal is required" });
    return;
  }

  try {
    const goalEmbedding = await embedText(goal);
    const topRelated = todos
      .filter((todo) => Array.isArray(todo.embedding) && Array.isArray(goalEmbedding))
      .map((todo) => ({
        text: todo.text,
        score: cosineSimilarity(goalEmbedding, todo.embedding)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.text);

    const context = topRelated.length
      ? `Related existing tasks: ${topRelated.join("; ")}`
      : "No related existing tasks.";

    const text = await generateText({
      system: "Suggest 4 actionable tasks as a JSON array of strings. Use context to avoid duplicates and complement existing work.",
      user: `Goal: ${goal}\n${context}`,
      temperature: 0.5,
      maxTokens: 220
    });

    res.json({ suggestions: parseJsonArray(text), context: topRelated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/suggest-next-tasks", async (req, res) => {
  if (!ensureProvider(res)) return;

  const incompleteTodos = Array.isArray(req.body?.incompleteTodos)
    ? req.body.incompleteTodos.map((t) => String(t).trim()).filter(Boolean)
    : todos.filter((t) => !t.completed).map((t) => t.text);

  if (!incompleteTodos.length) {
    res.json({ suggestions: [] });
    return;
  }

  try {
    const text = await generateText({
      system: "Return 3 next tasks as JSON array of strings, based on current tasks.",
      user: `Current tasks: ${incompleteTodos.join(", ")}`,
      temperature: 0.4,
      maxTokens: 160
    });

    res.json({ suggestions: parseJsonArray(text) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const agentTools = [
  {
    type: "function",
    function: {
      name: "create_todo",
      description: "Create a new todo item",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" }
        },
        required: ["text"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "complete_todo",
      description: "Mark a todo as completed",
      parameters: {
        type: "object",
        properties: {
          id: { type: "number" }
        },
        required: ["id"]
      }
    }
  }
];

app.post("/api/agent", async (req, res) => {
  if (!ensureProvider(res)) return;

  const command = String(req.body?.command || "").trim();
  if (!command) {
    res.status(400).json({ error: "command is required" });
    return;
  }

  try {
    const actions = [];
    let reply = null;

    if (AI_PROVIDER === "openai") {
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content: "You manage a todo list. Use tools when user asks to create or complete items. Otherwise respond normally."
          },
          { role: "user", content: command }
        ],
        tools: agentTools,
        tool_choice: "auto"
      });

      const message = response.choices[0]?.message;
      reply = message?.content || null;

      if (Array.isArray(message?.tool_calls) && message.tool_calls.length > 0) {
        for (const call of message.tool_calls) {
          const args = parseJsonObject(call.function.arguments || "{}") || {};
          if (call.function.name === "create_todo" && typeof args.text === "string") {
            const todo = await createTodo(args.text.trim());
            actions.push({ type: "create_todo", id: todo.id, text: todo.text });
          }
          if (call.function.name === "complete_todo") {
            const id = Number(args.id);
            const todo = todos.find((item) => item.id === id);
            if (todo) {
              todo.completed = true;
              actions.push({ type: "complete_todo", id: todo.id });
            }
          }
        }
      }
    } else {
      const plannerText = await generateText({
        system:
          "You are a todo action planner. Return ONLY JSON object: {\"actions\":[{\"type\":\"create_todo\",\"text\":\"...\"}|{\"type\":\"complete_todo\",\"id\":1}],\"reply\":\"short response\"}. No markdown.",
        user: `Todos: ${JSON.stringify(todos.map(({ embedding, ...todo }) => todo))}\nCommand: ${command}`,
        temperature: 0.2,
        maxTokens: 260
      });

      const parsed = parseJsonObject(plannerText) || {};
      reply = typeof parsed.reply === "string" ? parsed.reply : null;

      const plannedActions = Array.isArray(parsed.actions) ? parsed.actions : [];
      for (const action of plannedActions) {
        if (action?.type === "create_todo" && typeof action.text === "string") {
          const todo = await createTodo(action.text.trim());
          actions.push({ type: "create_todo", id: todo.id, text: todo.text });
        }
        if (action?.type === "complete_todo") {
          const id = Number(action.id);
          const todo = todos.find((item) => item.id === id);
          if (todo) {
            todo.completed = true;
            actions.push({ type: "complete_todo", id: todo.id });
          }
        }
      }
    }

    res.json({
      reply,
      actions,
      todos: todos.map(({ embedding, ...todo }) => todo)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const intentDescriptions = {
  add: "User wants to create a new todo task",
  suggest: "User wants suggested tasks from an objective",
  complete: "User wants to mark an existing todo as finished"
};

app.post("/api/route", async (req, res) => {
  if (!ensureProvider(res)) return;

  const message = String(req.body?.message || "").trim();
  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  try {
    const msgVector = await embedText(message);
    const intents = Object.keys(intentDescriptions);
    let winner = "suggest";
    let bestScore = -Infinity;

    for (const intent of intents) {
      const vector = await embedText(intentDescriptions[intent]);
      const score = cosineSimilarity(msgVector, vector);
      if (score > bestScore) {
        bestScore = score;
        winner = intent;
      }
    }

    res.json({ intent: winner, score: bestScore });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/suggest-todos-langchain", async (req, res) => {
  if (!ensureProvider(res)) return;

  const goal = String(req.body?.goal || "").trim();
  if (!goal) {
    res.status(400).json({ error: "goal is required" });
    return;
  }

  try {
    if (AI_PROVIDER === "openai") {
      const model = new ChatOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        model: OPENAI_MODEL,
        temperature: 0.3
      });

      const prompt = `You are a productivity expert. Break down this goal into exactly 4 actionable tasks. Return as JSON array of strings. Goal: ${goal}`;
      const result = await model.invoke(prompt);
      const text = typeof result?.content === "string" ? result.content : "[]";
      res.json({ suggestions: parseJsonArray(text), provider: "openai-langchain" });
      return;
    }

    const text = await generateText({
      system: "Break down the goal into exactly 4 actionable tasks and return JSON array of strings.",
      user: `Goal: ${goal}`,
      temperature: 0.3,
      maxTokens: 200
    });

    res.json({ suggestions: parseJsonArray(text), provider: "huggingface" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`AI provider: ${AI_PROVIDER}`);
});
