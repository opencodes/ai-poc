Here is the complete, single combined markdown file containing all five phases of the AI-powered todo app learning path. You can copy and save it as `ai-todo-app-learning-path.md`.

```markdown
# Building an AI-Powered Todo App: A 5-Phase Learning Path for Node.js Developers

This guide takes you through five progressive phases of integrating AI into a fullstack Node.js (Express + React) todo application. Each phase introduces a new concept and a practical AI feature.

- **Phase 1:** API Layer – Smart Todo Suggestions
- **Phase 2:** Prompt Engineering – Improving Suggestion Quality
- **Phase 3:** RAG (Retrieval-Augmented Generation) – Context-Aware Suggestions
- **Phase 4:** Integration Patterns – From Co-pilot to Autonomous Agent
- **Phase 5:** Tools & Frameworks – LangChain Integration

---

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** React (or any framework)
- **AI:** OpenAI API (GPT-3.5/4, embeddings)
- **Database:** SQLite / in-memory (for simplicity)

---

## Phase 1: API Layer – Smart Todo Suggestions

**Goal:** Add a feature that generates todo suggestions based on a user's goal using the OpenAI API.

### Step 1: Basic Todo App Setup

Create a simple Express API and React frontend with CRUD operations.

**Backend (`server.js`):**
```javascript
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

let todos = []; // In-memory store

app.get('/todos', (req, res) => res.json(todos));
app.post('/todos', (req, res) => {
  const todo = { id: Date.now(), text: req.body.text, completed: false };
  todos.push(todo);
  res.json(todo);
});
// ... update, delete routes

app.listen(5000, () => console.log('Server running on port 5000'));
```

**Frontend (`App.js`):**
```jsx
import { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    axios.get('http://localhost:5000/todos').then(res => setTodos(res.data));
  }, []);

  const addTodo = () => {
    axios.post('http://localhost:5000/todos', { text: input }).then(res => {
      setTodos([...todos, res.data]);
      setInput('');
    });
  };

  return (
    <div>
      <h1>Todo App</h1>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={addTodo}>Add</button>
      <ul>
        {todos.map(todo => <li key={todo.id}>{todo.text}</li>)}
      </ul>
    </div>
  );
}
```

### Step 2: Add AI Suggestion Endpoint

Install OpenAI: `npm install openai`

Create `routes/ai.js`:
```javascript
const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/suggest-todos', async (req, res) => {
  const { goal } = req.body;
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful task breakdown assistant. Given a goal, list 3-5 actionable todos. Return as a JSON array of strings.' },
        { role: 'user', content: goal }
      ],
      temperature: 0.7,
      max_tokens: 150,
    });
    const suggestions = JSON.parse(response.choices[0].message.content);
    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

Add to server: `app.use('/api', require('./routes/ai'));`

### Step 3: Frontend – Call Suggestion API

Add state and a button to fetch suggestions:
```jsx
const [suggestions, setSuggestions] = useState([]);
const [goal, setGoal] = useState('');

const getSuggestions = async () => {
  const res = await axios.post('http://localhost:5000/api/suggest-todos', { goal });
  setSuggestions(res.data.suggestions);
};

return (
  <div>
    <h1>AI-Powered Todo</h1>
    <input placeholder="Enter a goal" value={goal} onChange={e => setGoal(e.target.value)} />
    <button onClick={getSuggestions}>Suggest Todos</button>
    {suggestions.length > 0 && (
      <div>
        <h3>Suggestions:</h3>
        {suggestions.map((s, i) => (
          <div key={i}>
            <span>{s}</span>
            <button onClick={() => addTodo(s)}>Add</button>
          </div>
        ))}
      </div>
    )}
    {/* existing todo list */}
  </div>
);
```

**What you've learned:** Making basic API calls, parsing structured output, integrating AI as a feature.

---

## Phase 2: Prompt Engineering – Improving Suggestion Quality

**Goal:** Refine prompts to get more accurate, consistent, and useful todo suggestions.

### Step 1: Iterate on System Prompt

Improve the system prompt for specificity:
```javascript
messages: [
  { role: 'system', content: 'You are a productivity expert. Break down the user\'s goal into a list of concrete, actionable steps. Each step should be specific, measurable, and achievable. Return exactly 4 tasks as a JSON array of strings. Do not include any explanation or extra text.' },
  { role: 'user', content: goal }
],
```

### Step 2: Use Few-Shot Examples

Add examples to guide the model:
```javascript
messages: [
  { role: 'system', content: 'You are a helpful task breakdown assistant.' },
  { role: 'user', content: 'Goal: Learn React' },
  { role: 'assistant', content: '["Complete official React tutorial", "Build a simple counter app", "Create a todo app with hooks", "Learn React Router"]' },
  { role: 'user', content: goal }
],
```

### Step 3: Handle Edge Cases

Add retry logic for JSON parsing:
```javascript
const getSuggestionsWithRetry = async (goal, retries = 2) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [ /* ... */ ],
        temperature: 0.3,
        max_tokens: 150,
      });
      return JSON.parse(response.choices[0].message.content);
    } catch (e) {
      if (i === retries - 1) throw e;
    }
  }
};
```

### Step 4: Parameter Tuning

- Use lower temperature (0.2–0.4) for factual tasks.
- Adjust `max_tokens` based on expected output length.

**What you've learned:** Crafting system messages, few-shot prompting, error handling, tuning parameters.

---

## Phase 3: RAG – Context-Aware Suggestions

**Goal:** Make suggestions based on user's existing todos by retrieving relevant past tasks.

### Step 1: Store Todos with Embeddings

Generate and store embeddings when creating a todo:
```javascript
// In POST /todos
const embeddingResponse = await openai.embeddings.create({
  model: 'text-embedding-ada-002',
  input: todo.text,
});
todo.embedding = embeddingResponse.data[0].embedding;
todos.push(todo);
```

### Step 2: Retrieve Relevant Todos

Add cosine similarity function and a new endpoint:
```javascript
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (normA * normB);
}

router.post('/suggest-todos-with-context', async (req, res) => {
  const { goal } = req.body;
  const embedResp = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: goal,
  });
  const goalEmbedding = embedResp.data[0].embedding;

  const similarities = todos.map(todo => ({
    todo,
    similarity: cosineSimilarity(goalEmbedding, todo.embedding)
  }));
  similarities.sort((a,b) => b.similarity - a.similarity);
  const topTodos = similarities.slice(0,3).map(s => s.todo.text);

  const context = topTodos.length ? `User's related tasks: ${topTodos.join(', ')}` : 'No related tasks found.';

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a productivity assistant. Based on the user\'s goal and their existing related tasks, suggest new actionable todos that complement their work.' },
      { role: 'user', content: `Goal: ${goal}\n${context}` }
    ],
    temperature: 0.7,
  });
  // parse and return suggestions...
});
```

### Step 3: Frontend – Show Contextual Suggestions

Call the new endpoint and display suggestions.

**What you've learned:** Generating embeddings, semantic similarity search, using retrieved context in prompts (RAG).

---

## Phase 4: Integration Patterns – Co-pilot, Agent, Router

**Goal:** Implement three common AI integration patterns.

### Pattern A: Co-pilot (Human in the Loop)

**Endpoint `/api/suggest-next-tasks`** suggests next tasks based on incomplete todos.
```javascript
router.post('/suggest-next-tasks', async (req, res) => {
  const { incompleteTodos } = req.body;
  const prompt = `Based on these current tasks: ${incompleteTodos.join(', ')}, what are 2-3 logical next tasks the user should consider? Return as JSON array.`;
  // call OpenAI and return suggestions
});
```
Frontend shows suggestions with "Add" buttons.

### Pattern B: Autonomous Agent (Function Calling)

Define tools for todo operations:
```javascript
const tools = [
  {
    type: 'function',
    function: {
      name: 'create_todo',
      description: 'Create a new todo item',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The todo text' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_todo',
      description: 'Mark a todo as completed',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'The todo ID' },
        },
        required: ['id'],
      },
    },
  },
];
```

**Endpoint `/api/agent`** processes natural language commands:
```javascript
router.post('/agent', async (req, res) => {
  const { command } = req.body;
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: command }],
    tools: tools,
    tool_choice: 'auto',
  });

  const message = response.choices[0].message;
  if (message.tool_calls) {
    for (const toolCall of message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);
      if (toolCall.function.name === 'create_todo') {
        const newTodo = { id: Date.now(), text: args.text, completed: false };
        todos.push(newTodo);
      }
      // handle complete_todo
    }
    res.json({ success: true, message: 'Actions executed' });
  } else {
    res.json({ reply: message.content });
  }
});
```
Frontend adds a chat-like interface.

### Pattern C: Semantic Router

Use embeddings to classify intent:
```javascript
const intents = {
  add: 'User wants to create a new todo.',
  suggest: 'User wants task suggestions based on a goal.',
  complete: 'User wants to mark a todo as done.',
};

// Pre-compute intent embeddings
const intentEmbeddings = await Promise.all(
  Object.values(intents).map(desc => 
    openai.embeddings.create({ input: desc, model: 'text-embedding-ada-002' })
  )
);

router.post('/route', async (req, res) => {
  const { message } = req.body;
  const msgEmbed = await openai.embeddings.create({ input: message, model: 'text-embedding-ada-002' });
  // find closest intent by cosine similarity...
});
```

**What you've learned:** Co-pilot (AI suggests, user approves), autonomous agent (AI calls functions), semantic routing (intent classification with embeddings).

---

## Phase 5: Tools & Frameworks – LangChain Integration

**Goal:** Refactor using LangChain to manage prompts, chains, and agents efficiently.

### Step 1: Install LangChain
```bash
npm install langchain @langchain/openai
```

### Step 2: Rewrite Suggestion Endpoint with LangChain
```javascript
const { PromptTemplate } = require('langchain/prompts');
const { LLMChain } = require('langchain/chains');
const { ChatOpenAI } = require('@langchain/openai');

const model = new ChatOpenAI({ temperature: 0.7 });
const prompt = PromptTemplate.fromTemplate(
  "You are a productivity expert. Break down the goal '{goal}' into exactly 4 actionable tasks. Return as a JSON array of strings."
);
const chain = new LLMChain({ llm: model, prompt });

router.post('/suggest-todos-langchain', async (req, res) => {
  const { goal } = req.body;
  const result = await chain.call({ goal });
  // result.text contains the output
});
```

### Step 3: Build a RAG Chain with LangChain
```javascript
const { OpenAIEmbeddings } = require('@langchain/openai');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { createRetrievalChain } = require('langchain/chains/retrieval');
const { Document } = require('langchain/document');

const embeddings = new OpenAIEmbeddings();
const vectorStore = await MemoryVectorStore.fromDocuments(
  todos.map(t => new Document({ pageContent: t.text, metadata: { id: t.id } })),
  embeddings
);
const retriever = vectorStore.asRetriever();

// Create a retrieval chain (simplified)
const retrievalChain = createRetrievalChain({
  retriever,
  combineDocsChain: ... // chain that combines docs with prompt
});
```

### Step 4: Implement Agent with LangChain
```javascript
const { Tool } = require('langchain/tools');
const { AgentExecutor, createOpenAIToolsAgent } = require('langchain/agents');

const tools = [
  new Tool({
    name: 'create_todo',
    description: 'Create a new todo',
    func: async (text) => {
      const newTodo = { id: Date.now(), text, completed: false };
      todos.push(newTodo);
      return `Todo "${text}" created.`;
    }
  }),
  // ...
];

const agent = await createOpenAIToolsAgent({
  llm: model,
  tools,
  prompt: ... // optional custom prompt
});
const executor = new AgentExecutor({ agent, tools });

const result = await executor.invoke({ input: command });
```

**What you've learned:** Using LangChain to abstract prompts, chains, and agents; simplifying complex AI workflows.

---

## Conclusion

By building this AI-powered todo app through five phases, you've gained practical experience with:

- Core AI API integration
- Prompt engineering techniques
- Retrieval-Augmented Generation (RAG)
- Integration patterns (co-pilot, agent, router)
- Using frameworks like LangChain

You're now equipped to add AI capabilities to any fullstack application. Each phase built on the previous, giving you a solid foundation to explore further. Happy coding!
```

Just save this content as a `.md` file and you'll have the complete guide in one document.