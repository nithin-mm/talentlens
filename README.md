# TalentLens 🔍

**A NotebookLM-style AI workspace for recruiters and hiring managers.**

Upload candidate resumes and a job description, then chat with an AI that answers
questions grounded strictly in those documents — complete with inline citations,
auto-generated summaries, JD match scoring, cross-candidate comparisons, and a
spoken audio overview.

TalentLens runs **entirely in your browser**. Documents are parsed locally and
your Gemini API key never leaves your machine except to talk directly to
Google's API.

---

## ✨ Features

| Feature | Description |
| --- | --- |
| **3-panel workspace** | Sources (left) · Document viewer (center) · Chat (right), with a tabbed layout on mobile. |
| **Multi-document upload** | Pick **PDF, DOCX, TXT** files. Toggle each document in/out of the AI context with a checkbox. |
| **Job Description, two ways** | **Paste** JD text or **upload** a JD file directly from the Sources panel — or designate any uploaded doc as the JD with the briefcase button. |
| **Automatic JD match scoring** | Every candidate is graded against the active JD: a 0–100 score, rationale, matched skills, and skill gaps. |
| **Grounded Q&A chat** | Streaming answers based strictly on the included documents — the assistant declines when the answer isn't in context. |
| **Inline citations** | Answers cite sources as clickable chips (`citation://Doc/Page`). Click one to jump to and highlight the passage in the viewer. |
| **Auto profile** | On upload, each document gets an AI summary, key skills, and suggested screening questions. |
| **Real PDF viewer** | PDFs render page-by-page on canvas via pdf.js, with zoom; toggle to a plain-text view for any document. |
| **Audio overview** | Generate a spoken "podcast"-style candidate summary using the browser's Web Speech API. |
| **Recruiter quick actions** | One-click "Compare Resumes" and "Draft Questions". |
| **Theme** | Light/dark mode that follows your OS preference and can be toggled manually. |
| **Privacy-first** | Local parsing + session-only API key storage. |

---

## 🚀 Getting Started

> The repo contains the main React component in **`app.jsx`**. The steps below
> set up a surrounding Vite project so you can run it. (`talentlens_app.tsx` and
> `talentlens_appv2.tsx` are earlier drafts; `app.jsx` is the current version.)

### 1. Prerequisites
- **Node.js 18+** and npm
- A **Google Gemini API key** — get one free at
  [Google AI Studio](https://aistudio.google.com/app/apikey)

### 2. Scaffold a Vite + React project

```bash
npm create vite@latest talentlens -- --template react
cd talentlens
```

### 3. Install dependencies

```bash
npm install lucide-react react-markdown
npm install -D tailwindcss postcss autoprefixer tailwindcss-animate @tailwindcss/typography
npx tailwindcss init -p
```

### 4. Configure Tailwind

In `tailwind.config.js`:

```js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: { extend: {} },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
  ],
};
```

In `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Hide scrollbar utility used by the suggested-questions row */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
```

### 5. Add the component

Copy `app.jsx` into `src/`, then render it from `src/main.jsx`:

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import TalentLens from "./app.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <TalentLens />
  </React.StrictMode>
);
```

### 6. Run

```bash
npm run dev
```

Open the printed URL (usually `http://localhost:5173`). On first load you'll be
prompted for your Gemini API key.

> **Note:** pdf.js and mammoth are loaded from a CDN at runtime, so the app needs
> network access on first use to parse documents.

---

## 🔑 Using the App

1. **Enter your API key** in the settings modal (stored in `sessionStorage` for
   the session only — cleared when you close the tab).
2. **Upload candidate documents** via the left panel. Each is parsed locally and
   auto-profiled (summary, skills, suggested questions).
3. **Add a Job Description** — paste it into the JD text box or upload a JD file
   at the bottom of the Sources panel. Candidates are then scored against it
   automatically. (You can also click the briefcase icon on any uploaded
   document to designate it as the JD.)
4. **Select a document** to read it in the center viewer — full PDF rendering
   with zoom, or plain text. The candidate's JD match analysis appears above it.
5. **Ask questions** in the chat. Use the checkboxes to control which documents
   are in context, and click citation chips to verify sources.
6. **Play the audio overview** for a quick spoken summary of the included docs.

---

## 🛠️ Tech Stack

- **React + Vite** (single-page app, no backend)
- **Tailwind CSS** for styling (`tailwindcss-animate` + `@tailwindcss/typography`)
- **lucide-react** for icons
- **react-markdown** for rendering AI responses and citation chips
- **pdf.js** & **mammoth** (loaded from CDN at runtime) for document parsing and
  PDF rendering
- **Google Gemini API** (`gemini-2.5-flash`, streaming + non-streaming) for all
  AI features
- **Web Speech API** (`speechSynthesis`) for the audio overview

---

## ⚠️ Notes & Limitations

- The app talks to Gemini directly from the browser. Your API key is visible to
  anyone who can inspect the running tab, so use a **personal/dev key** — not a
  production secret. For a public deployment, proxy requests through a backend.
- The audio overview uses the browser's built-in `speechSynthesis` voice, which
  varies by OS/browser.
- DOCX and TXT files are treated as a single page; only PDFs have true per-page
  numbers for citations.
- Document text and context sent to the model are length-capped (~8k chars per
  document for profiling/scoring, ~25k chars total for chat) to stay within
  token budgets, so very long documents are truncated.
- All AI output should be **verified** — scores, citations, and comparisons can
  contain mistakes.

---

## 📄 License

Provided as-is for educational and demonstration purposes.
