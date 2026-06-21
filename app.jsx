import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings, UploadCloud, FileText, Trash2, CheckCircle, 
  MessageSquare, FileSearch, Mic, Play, Pause, ChevronRight, 
  Search, BrainCircuit, X, AlertCircle, FileUp, Sparkles, Loader2,
  Users, CheckSquare, Square, ZoomIn, ZoomOut, Sun, Moon, Briefcase, Award, ArrowUpRight
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- CONFIGURATION ---
const GEMINI_STABLE_STREAM_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent";
const GEMINI_STABLE_NON_STREAM_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_PROMPT = `You are TalentLens, an advanced AI assistant for recruiters and hiring managers. 
Your primary task is to answer user questions based STRICTLY on the provided candidate resumes, portfolios, and job descriptions (JD).

RULES:
1. Provide accurate, professional, and structured answers.
2. If the answer cannot be found in the provided documents, politely state that you do not have enough information based on the current context. Do not invent information.
3. ALWAYS cite your sources using Markdown links formatted EXACTLY as: [DocName, p. X](citation://DocName/X). Example: "The candidate has 5 years of React experience [Resume_JohnDoe.pdf, p. 1](citation://Resume_JohnDoe.pdf/1)."
4. Keep inline flow beautiful and uninterrupted. Always output comparison tables when asked to contrast candidate skills or experiences.`;

// --- PDF RENDERING COMPONENTS ---

// Parent viewer responsible for loading the PDF Document object exactly ONCE per file.
function PdfViewer({ fileUrl, pages, zoom, activeDocId }) {
  const [pdfDocument, setPdfDocument] = useState(null);

  useEffect(() => {
    if (!fileUrl || !window.pdfjsLib) return;
    let isMounted = true;
    
    const task = window.pdfjsLib.getDocument(fileUrl);
    task.promise.then(pdf => {
      if (isMounted) setPdfDocument(pdf);
    }).catch(e => console.error("PDF load error:", e));

    return () => {
      isMounted = false;
      task.destroy();
    };
  }, [fileUrl]);

  if (!pdfDocument) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <Loader2 size={24} className="animate-spin mb-2" />
        <span className="text-sm">Initializing PDF engine...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pages.map((page) => (
        <div 
          key={page.pageNum} 
          id={`doc-${activeDocId}-page-${page.pageNum}`}
          className="transition-all duration-300 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900"
        >
          <PdfPageRenderer pdfDocument={pdfDocument} pageNum={page.pageNum} zoom={zoom} />
        </div>
      ))}
    </div>
  );
}

// Child renderer strictly responsible for rendering its assigned page using the provided pdfDocument proxy
function PdfPageRenderer({ pdfDocument, pageNum, zoom }) {
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return;

    let isMounted = true;
    
    pdfDocument.getPage(pageNum).then(page => {
      if (!isMounted) return;

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const viewport = page.getViewport({ scale: zoom });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;

      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      context.scale(dpr, dpr);

      const renderTask = page.render({ canvasContext: context, viewport });
      renderTaskRef.current = renderTask;

      renderTask.promise.catch(err => {
        if (err.name !== 'RenderingCancelledException') {
          console.error("PDF Render error:", err);
        }
      });
    });

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDocument, pageNum, zoom]);

  return (
    <div className="flex justify-center bg-white p-3 shadow-sm my-2 overflow-auto dark:bg-slate-900">
      <canvas ref={canvasRef} />
    </div>
  );
}

export default function TalentLens() {
  const [apiKey, setApiKey] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [jdDocId, setJdDocId] = useState(null); 
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [docViewMode, setDocViewMode] = useState('pdf'); 
  const [zoomScale, setZoomScale] = useState(1.0);
  const [messages, setMessages] = useState([{
    id: 'welcome',
    role: 'assistant',
    text: 'Welcome to **TalentLens**. Set your API key in configuration, upload candidate resumes or a Job Description, and discover match metrics instantly.'
  }]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTabMobile, setActiveTabMobile] = useState('sources');
  const [libsLoaded, setLibsLoaded] = useState(false);

  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [jdText, setJdText] = useState('');
  const abortControllerRef = useRef(null);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const jdFileInputRef = useRef(null);
  const jdDocIdRef = useRef(jdDocId);
  const documentsRef = useRef(documents);

  // Keep refs up to date for async callbacks
  useEffect(() => { jdDocIdRef.current = jdDocId; }, [jdDocId]);
  useEffect(() => { documentsRef.current = documents; }, [documents]);

  // Load CDN dependencies
  useEffect(() => {
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js')
    ]).then(() => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
      setLibsLoaded(true);
    }).catch(err => console.error("Library load failed", err));
  }, []);

  // Sync OS System Theme & Local Storage Key
  useEffect(() => {
    const savedKey = sessionStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);
    else setIsSettingsOpen(true);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);
    
    const themeChangeHandler = (e) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', themeChangeHandler);
    return () => mediaQuery.removeEventListener('change', themeChangeHandler);
  }, []);

  // Reset viewer preferences when active document changes
  useEffect(() => {
    setZoomScale(1.0);
    setDocViewMode('pdf');
  }, [activeDocId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleDocumentInclude = (id) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, included: !d.included } : d));
  };

  // Extract page text from a file. PDFs reuse the already-created blob URL so we
  // don't allocate (and leak) a second object URL during parsing.
  const parseFileToPages = async (file, type, fileUrl) => {
    if (type === 'pdf') {
      const pdf = await window.pdfjsLib.getDocument(fileUrl).promise;
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        pages.push({ pageNum: i, text: textContent.items.map(item => item.str).join(' ') });
      }
      return pages;
    } else if (type === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer });
      return [{ pageNum: 1, text: result.value }];
    } else if (type === 'txt') {
      return [{ pageNum: 1, text: await file.text() }];
    }
    throw new Error("Format unsupported.");
  };

  // Promote a document to the active Job Description and re-screen ready candidates
  // against it. Operates on an explicit snapshot to stay free of stale closures.
  const setDocumentAsJD = (docId, docsSnapshot) => {
    const nextDocs = docsSnapshot.map(d => d.id === docId ? { ...d, matchAnalysis: null } : d);
    documentsRef.current = nextDocs;
    setDocuments(nextDocs);
    setJdDocId(docId);
    setActiveDocId(docId);
    computeMatchScore(docId, nextDocs);
  };

  const addJobDescriptionText = () => {
    const text = jdText.trim();
    if (!text) return;

    const docId = crypto.randomUUID();
    const newDoc = {
      id: docId,
      name: 'Pasted Job Description',
      type: 'txt',
      status: 'ready',
      included: true,
      pages: [{ pageNum: 1, text }],
      fileUrl: null,
      summary: null,
      skills: [],
      suggestedQuestions: [],
      matchAnalysis: null
    };

    setJdText('');
    setDocumentAsJD(docId, [...documentsRef.current, newDoc]);
  };

  const handleJdFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!libsLoaded) {
      alert("Engines are bootstrapping. Please re-upload in a moment.");
      if (jdFileInputRef.current) jdFileInputRef.current.value = '';
      return;
    }

    const docId = crypto.randomUUID();
    const type = file.name.split('.').pop().toLowerCase();
    const fileUrl = URL.createObjectURL(file);
    const newDoc = {
      id: docId,
      name: file.name,
      type,
      status: 'parsing',
      included: true,
      pages: [],
      fileUrl,
      summary: null,
      skills: [],
      suggestedQuestions: [],
      matchAnalysis: null
    };

    const withNew = [...documentsRef.current, newDoc];
    documentsRef.current = withNew;
    setDocuments(withNew);

    try {
      const pages = await parseFileToPages(file, type, fileUrl);
      const readyDocs = documentsRef.current.map(d =>
        d.id === docId ? { ...d, status: 'ready', pages } : d
      );
      setDocumentAsJD(docId, readyDocs);
    } catch (error) {
      console.error("JD parsing failed", error);
      setDocuments(prev => prev.map(d =>
        d.id === docId ? { ...d, status: 'error', error: error.message } : d
      ));
    }
    if (jdFileInputRef.current) jdFileInputRef.current.value = '';
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    if (!libsLoaded) {
      alert("Engines are bootstrapping. Please re-upload in a moment.");
      return;
    }

    if (!apiKey) {
      alert("Please configure your Google Gemini API key first.");
      setIsSettingsOpen(true);
      return;
    }

    for (const file of files) {
      const docId = crypto.randomUUID();
      const fileUrl = URL.createObjectURL(file); // Store blob reference strictly, avoid saving array buffers into state
      
      const newDoc = {
        id: docId,
        name: file.name,
        type: file.name.split('.').pop().toLowerCase(),
        status: 'parsing',
        included: true,
        pages: [],
        fileUrl, 
        summary: null,
        skills: [],
        suggestedQuestions: [],
        matchAnalysis: null
      };

      setDocuments(prev => [...prev, newDoc]);

      try {
        const extractedPages = await parseFileToPages(file, newDoc.type, fileUrl);

        setDocuments(prev => prev.map(d =>
          d.id === docId ? { ...d, status: 'summarizing', pages: extractedPages } : d
        ));

        await generateDocProfile(docId, file.name, extractedPages);

      } catch (error) {
        console.error("Parsing failed", error);
        setDocuments(prev => prev.map(d => 
          d.id === docId ? { ...d, status: 'error', error: error.message } : d
        ));
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const generateDocProfile = async (docId, docName, pages) => {
    try {
      const combined = pages.map(p => p.text).join('\n').substring(0, 8000); 
      const payload = {
        contents: [{
          role: "user",
          parts: [{ text: `Analyze candidate Document/CV named "${docName}".\n\nText:\n${combined}\n\nTask:\n1. Provide a concise 2-sentence summary.\n2. Extract 4 key technologies/skills.\n3. Draft 3 short relevant recruiter screening questions.\n\nRespond strictly in valid JSON format:\n{"summary": "...", "skills": ["..."], "questions": ["..."]}` }]
        }],
        generationConfig: { responseMimeType: "application/json" }
      };

      const response = await fetch(`${GEMINI_STABLE_NON_STREAM_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (resultText) {
        const parsed = JSON.parse(resultText);

        // Derive the next state once from the latest documents snapshot (ref avoids
        // both the stale async closure and reading a value assigned inside an updater).
        const newlyUpdatedDocs = documentsRef.current.map(d =>
          d.id === docId ? {
            ...d,
            status: 'ready',
            summary: parsed.summary,
            skills: parsed.skills,
            suggestedQuestions: parsed.questions
          } : d
        );
        documentsRef.current = newlyUpdatedDocs;
        setDocuments(newlyUpdatedDocs);
        setActiveDocId(docId);

        // Trigger JD screening with the same snapshot we just committed.
        if (jdDocIdRef.current && docId !== jdDocIdRef.current) {
           computeMatchScore(jdDocIdRef.current, newlyUpdatedDocs, docId);
        }
      }
    } catch (e) {
      console.error("Auto summarization failed", e);
      setDocuments(prev => prev.map(d => 
        d.id === docId ? { ...d, status: 'ready', summary: "Profiling analysis skipped." } : d
      ));
    }
  };

  const computeMatchScore = async (jdId, allDocs, targetDocId = null) => {
    if (!apiKey) return;
    
    const jdFile = allDocs.find(d => d.id === jdId);
    if (!jdFile) return;

    const jdText = jdFile.pages.map(p => p.text).join('\n').substring(0, 8000);
    const candidates = allDocs.filter(d => 
      d.id !== jdId && 
      d.status === 'ready' && 
      (!targetDocId || d.id === targetDocId)
    );

    for (const cand of candidates) {
      setDocuments(prev => prev.map(d => d.id === cand.id ? { ...d, status: 'scoring' } : d));

      try {
        const candText = cand.pages.map(p => p.text).join('\n').substring(0, 8000);
        const prompt = `Grade the candidate resume against the Job Description details.
JD:\n${jdText}

Candidate Resume (${cand.name}):\n${candText}

Evaluate and return structured rating in JSON format:
{
  "score": <number 0 to 100>,
  "rationale": "<1-2 sentence core reasoning of match fit>",
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["missing1", "missing2"]
}`;

        const res = await fetch(`${GEMINI_STABLE_NON_STREAM_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const parsedAnalysis = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text);
          setDocuments(prev => prev.map(d => 
            d.id === cand.id ? { ...d, status: 'ready', matchAnalysis: parsedAnalysis } : d
          ));
        } else {
          throw new Error("Evaluation error response");
        }
      } catch (err) {
        console.error("Screening failed", err);
        setDocuments(prev => prev.map(d => 
          d.id === cand.id ? { ...d, status: 'ready', matchAnalysis: { score: 0, rationale: "Match scoring omitted.", matchedSkills: [], missingSkills: [] } } : d
        ));
      }
    }
  };

  const designateAsJD = (id) => {
    const isUnsetting = jdDocId === id;
    const newJdId = isUnsetting ? null : id;
    
    setJdDocId(newJdId);

    if (newJdId) {
      // Sync event handler: the `documents` closure is already current. Compute the
      // next state once, nullify the promoted JD's score, then commit and screen with it.
      const nextDocs = documents.map(d => d.id === newJdId ? { ...d, matchAnalysis: null } : d);
      documentsRef.current = nextDocs;
      setDocuments(nextDocs);
      computeMatchScore(newJdId, nextDocs);
    } else {
      setDocuments(docs => docs.map(d => ({ ...d, matchAnalysis: null })));
    }
  };

  const handleChatSubmit = async (queryOverride) => {
    const query = typeof queryOverride === 'string' ? queryOverride : chatInput;
    if (!query.trim() || !apiKey) return; 

    // Stream Interrupt Handling
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    abortControllerRef.current = new AbortController();

    const activeDocs = documents.filter(d => d.included && d.status === 'ready');
    if (activeDocs.length === 0) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: 'Include at least one parsed document context in the check list to begin chatting.' }]);
      return;
    }

    const userMessageId = crypto.randomUUID();
    setMessages(prev => [...prev, { id: userMessageId, role: 'user', text: query }]);
    setChatInput('');
    setIsStreaming(true);

    // Context formatting
    let contextStr = "--- REFERENCE DOCUMENTS AND CONTEXTS ---\n";
    let tokenCharCap = 25000; 
    let accumulatedChars = 0;

    activeDocs.forEach(doc => {
      if (accumulatedChars > tokenCharCap) return;
      const textBlock = doc.pages.map(p => `[Page ${p.pageNum}]: ${p.text}`).join('\n');
      const formatted = `\n[Doc Name: ${doc.name}]\n${textBlock}\n`;
      if (accumulatedChars + formatted.length <= tokenCharCap) {
         contextStr += formatted;
         accumulatedChars += formatted.length;
      } else {
         const truncated = formatted.substring(0, tokenCharCap - accumulatedChars);
         contextStr += truncated + "\n...[Context Truncated for token optimization]";
         accumulatedChars = tokenCharCap + 1;
      }
    });

    const payload = {
      contents: [{ role: "user", parts: [{ text: `Context Details:\n${contextStr}\n\nUser Question:\n${query}` }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }
    };

    const assistantMsgId = crypto.randomUUID();
    setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', text: '' }]);

    try {
      const sseUrl = `${GEMINI_STABLE_STREAM_URL}?alt=sse&key=${apiKey}`;
      const response = await fetch(sseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson?.error?.message || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const dataObj = JSON.parse(dataStr);
              const chunkText = dataObj.candidates?.[0]?.content?.parts?.[0]?.text || '';
              
              setMessages(prev => prev.map(m => 
                m.id === assistantMsgId ? { ...m, text: m.text + chunkText } : m
              ));
            } catch (jsonErr) {
              console.error("Encountered un-parsable data line:", trimmed, jsonErr);
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => prev.map(m => 
          m.id === assistantMsgId ? { ...m, text: `⚠️ **Request Exception:** ${err.message}. Please check API configurations.` } : m
        ));
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleCitationClick = (docName, pageNum) => {
    const targetDoc = documents.find(d => 
      d.name.toLowerCase().includes(docName.toLowerCase()) || 
      docName.toLowerCase().includes(d.name.toLowerCase())
    );

    if (targetDoc) {
      setActiveDocId(targetDoc.id);
      setActiveTabMobile('viewer');

      setTimeout(() => {
        const pageEl = document.getElementById(`doc-${targetDoc.id}-page-${pageNum}`);
        if (pageEl) {
          pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          pageEl.classList.add('bg-yellow-50', 'dark:bg-yellow-900/40', 'border-yellow-400');
          setTimeout(() => {
            pageEl.classList.remove('bg-yellow-50', 'dark:bg-yellow-900/40', 'border-yellow-400');
          }, 3000);
        }
      }, 200);
    }
  };

  const handleGeneratePodcast = async () => {
    if (!apiKey) {
      alert("Please configure your Gemini API Key in Settings first.");
      setIsSettingsOpen(true);
      return;
    }
    
    const synth = window.speechSynthesis;
    
    if (isAudioPlaying) {
      synth.cancel();
      setIsAudioPlaying(false);
      return;
    }

    // The Job Description is not a candidate — keep it out of the candidate list.
    const candidateDocs = documents.filter(d => d.included && d.status === 'ready' && d.id !== jdDocId);
    if (candidateDocs.length === 0) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: 'Add at least one candidate (a document other than the Job Description) to generate an audio overview.' }]);
      return;
    }

    try {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: '🎙️ *Assembling high fidelity candidate comparison podcast outline...*' }]);

      // Ground the model with each candidate's actual resume text so it uses real
      // names/facts instead of inventing them. Cap per-candidate to keep tokens sane.
      const docContext = candidateDocs.map((d, i) => {
         const label = d.name.replace(/\.[^.]+$/, '');
         const meta = d.matchAnalysis ? `JD Match Score: ${d.matchAnalysis.score}%` : 'JD Match: not scored';
         const resumeExcerpt = d.pages.map(p => p.text).join(' ').replace(/\s+/g, ' ').trim().substring(0, 1500);
         return `Candidate ${i + 1} — file "${label}"\nSummary: ${d.summary || 'No summary available.'}\n${meta}\nResume excerpt: ${resumeExcerpt}`;
      }).join('\n\n---\n\n');

      const payload = {
        contents: [{ role: "user", parts: [{ text: `You are creating a short spoken audio overview for a hiring manager comparing the candidates below.

STRICT RULES:
- Use ONLY the information provided below. Do not invent names, employers, job titles, skills, degrees, or numbers.
- Refer to each candidate by the actual name found in their resume excerpt. If no clear name is present, refer to them by their file label (for example, "the candidate in resume_one"). Never make up a name.
- Keep it to roughly 45 seconds of speech (about 110-130 words).
- Conversational and engaging, but strictly factual. Output plain spoken text only: no bullet points, asterisks, headings, or Markdown.
- Discuss ONLY the candidates listed below. There are exactly ${candidateDocs.length} candidate(s); do not introduce any other person.

Candidates:
${docContext}` }] }],
        generationConfig: { temperature: 0.4 }
      };

      const response = await fetch(`${GEMINI_STABLE_NON_STREAM_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("API call failed during overview synthesis");

      const data = await response.json();
      const spokenScript = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (spokenScript) {
        setMessages(prev => [...prev.slice(0, -1), { 
          id: crypto.randomUUID(), 
          role: 'assistant', 
          text: `🎙️ **Audio Overview Synthesized & Playing:**\n\n"${spokenScript}"` 
        }]);

        const utterance = new SpeechSynthesisUtterance(spokenScript);
        utterance.rate = 1.0;
        utterance.onend = () => setIsAudioPlaying(false);
        utterance.onerror = () => setIsAudioPlaying(false);

        setIsAudioPlaying(true);
        synth.speak(utterance);
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev.slice(0, -1), { id: crypto.randomUUID(), role: 'assistant', text: '❌ Failed to generate audio outline.' }]);
    }
  };

  const renderers = {
    a: ({ href, children }) => {
      if (href && href.startsWith('citation://')) {
        const citationPath = href.replace('citation://', '');
        const slashIdx = citationPath.lastIndexOf('/');
        const docName = decodeURIComponent(citationPath.substring(0, slashIdx));
        const pageNum = citationPath.substring(slashIdx + 1);

        return (
          <button
            onClick={() => handleCitationClick(docName, pageNum)}
            className="inline-flex items-center px-1.5 py-0.5 mx-0.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono align-middle"
          >
            <FileSearch size={11} className="mr-0.5" />
            {docName}, p.{pageNum}
          </button>
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline">
          {children}
        </a>
      );
    }
  };

  const deleteDocument = (id) => {
    setDocuments(prev => {
      const doc = prev.find(d => d.id === id);
      // Clean up object URL mapping from browser cache to prevent memory leaks over time
      if (doc && doc.fileUrl) {
         URL.revokeObjectURL(doc.fileUrl);
      }
      return prev.filter(d => d.id !== id);
    });
    if (activeDocId === id) setActiveDocId(null);
    if (jdDocId === id) setJdDocId(null);
  };

  const activeDoc = documents.find(d => d.id === activeDocId);
  const activeSuggested = documents
    .filter(d => d.included && d.status === 'ready')
    .flatMap(d => d.suggestedQuestions || [])
    .slice(0, 4);

  // Candidates for the visual compare board: ready, included, not the JD, sorted by JD score.
  const comparisonDocs = documents
    .filter(d => d.included && d.status === 'ready' && d.id !== jdDocId)
    .sort((a, b) => (b.matchAnalysis?.score ?? -1) - (a.matchAnalysis?.score ?? -1));

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* --- HEADER --- */}
      <header className="flex-none bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800 px-6 py-3 flex justify-between items-center z-10 shadow-sm">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <BrainCircuit size={28} />
          <h1 className="text-2xl font-bold tracking-tight font-sans">TalentLens</h1>
          <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900">
            NotebookLM for Recruiting
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 rounded-full transition-colors"
            title="Toggle theme"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 rounded-full transition-colors"
            title="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* --- MOBILE COMPONENT TAB BAR --- */}
      <div className="md:hidden flex border-b bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        {['sources', 'viewer', 'chat'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTabMobile(tab)}
            className={`flex-1 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${activeTabMobile === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* --- MAIN BODY LAYOUT --- */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* PANEL 1: SOURCES COLUMN */}
        <section className={`w-full md:w-80 flex-none border-r border-slate-200 dark:border-slate-800 flex flex-col ${activeTabMobile !== 'sources' ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <h2 className="font-semibold flex items-center gap-2 mb-4 text-slate-700 dark:text-slate-300">
              <Users size={18} /> Candidate Contexts
            </h2>
            
            <div 
               className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-blue-300 transition-colors bg-slate-50 dark:bg-slate-900/50"
               onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="text-slate-400 dark:text-slate-500 mb-2" size={28} />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Import Candidate PDFs/Docs</span>
              <span className="text-[10px] text-slate-400 mt-1 uppercase">PDF, DOCX, TXT supported</span>
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.txt"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
            </div>

            {/* Job Description: paste text or upload a dedicated file */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <label className="flex items-center gap-1.5 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Briefcase size={12} /> Job Description
              </label>
              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="Paste the job description here..."
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none resize-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={addJobDescriptionText}
                  disabled={!jdText.trim()}
                  className="flex-1 py-1.5 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Set as JD
                </button>
                <button
                  onClick={() => jdFileInputRef.current?.click()}
                  className="py-1.5 px-3 flex items-center gap-1 text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="Upload a job description file"
                >
                  <FileUp size={13} /> Upload
                </button>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  ref={jdFileInputRef}
                  onChange={handleJdFileUpload}
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white dark:bg-slate-900/20">
            {documents.length === 0 ? (
              <div className="text-center text-sm text-slate-400 dark:text-slate-600 py-10">
                No active source profiles parsed.
              </div>
            ) : (
              documents.map(doc => {
                const isJD = jdDocId === doc.id;
                return (
                  <div 
                    key={doc.id} 
                    className={`bg-white dark:bg-slate-900 border rounded-xl p-3 shadow-sm transition-all cursor-pointer ${activeDocId === doc.id ? 'border-blue-400 ring-2 ring-blue-400/30 dark:border-blue-500' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'}`}
                    onClick={() => setActiveDocId(doc.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 overflow-hidden flex-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleDocumentInclude(doc.id); }}
                          className="text-slate-400 hover:text-blue-600 flex-none"
                        >
                          {doc.included ? <CheckSquare size={16} className="text-blue-600"/> : <Square size={16}/>}
                        </button>
                        <FileText size={16} className="text-slate-400 flex-none" />
                        <span className="text-sm font-semibold truncate text-slate-700 dark:text-slate-200">{doc.name}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); designateAsJD(doc.id); }}
                          className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-all ${isJD ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300'}`}
                          title={isJD ? "JD context active" : "Designate as Job Description"}
                        >
                          <Briefcase size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }}
                          className="text-slate-300 hover:text-red-500 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {isJD && (
                      <span className="inline-block mt-2 px-2 py-0.5 text-[9px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 font-bold uppercase tracking-wider rounded">
                        Job Description (JD)
                      </span>
                    )}

                    {doc.status === 'parsing' || doc.status === 'summarizing' || doc.status === 'scoring' ? (
                       <div className="mt-2 flex items-center text-xs text-blue-500">
                         <Loader2 size={12} className="animate-spin mr-1.5" />
                         {doc.status === 'parsing' ? 'Extracting text...' : doc.status === 'scoring' ? 'Matching to JD...' : 'Context synthesis...'}
                       </div>
                    ) : doc.status === 'error' ? (
                       <div className="mt-2 text-xs text-red-500 flex items-center">
                         <AlertCircle size={12} className="mr-1" /> Parsing failure
                       </div>
                    ) : (
                      <div className="mt-2">
                        {doc.matchAnalysis && !isJD && (
                          <div className="flex items-center gap-2 mb-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800/40 dark:to-slate-900/40 px-2 py-1.5 rounded-lg border border-blue-100/40 dark:border-slate-800">
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                              JD Match Score: {doc.matchAnalysis.score}%
                            </span>
                          </div>
                        )}
                        <div className="flex gap-1 flex-wrap">
                          {doc.skills?.slice(0, 3).map((skill, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-semibold tracking-wide">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
             <button 
                onClick={handleGeneratePodcast}
                disabled={documents.filter(d => d.included && d.status === 'ready' && d.id !== jdDocId).length === 0}
                className="w-full py-2.5 px-3 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
                {isAudioPlaying ? <Pause size={16} /> : <Mic size={16} />}
                {isAudioPlaying ? "Mute Audio Overview" : "Voice Podcast Overview"}
             </button>
          </div>
        </section>

        {/* PANEL 2: COMPREHENSIVE DOCUMENT VIEWER */}
        <section className={`w-full md:w-1/2 flex-none bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col relative ${activeTabMobile !== 'viewer' ? 'hidden md:flex' : 'flex'}`}>
          {activeDoc ? (
            <>
              <div className="p-4 border-b border-slate-100 dark:border-slate-900 flex items-center justify-between bg-white dark:bg-slate-900 shadow-sm z-10">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 truncate max-w-[50%]">
                  <FileText size={18} className="text-blue-600 dark:text-blue-400"/> 
                  {activeDoc.name}
                </h3>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
                    <button
                      onClick={() => setDocViewMode('pdf')}
                      disabled={activeDoc.type !== 'pdf'}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${docViewMode === 'pdf' && activeDoc.type === 'pdf' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-100 shadow' : 'text-slate-500'}`}
                    >
                      PDF View
                    </button>
                    <button
                      onClick={() => setDocViewMode('text')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${docViewMode === 'text' || activeDoc.type !== 'pdf' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-100 shadow' : 'text-slate-500'}`}
                    >
                      Plain Text
                    </button>
                  </div>

                  {docViewMode === 'pdf' && activeDoc.type === 'pdf' && (
                    <div className="flex items-center border-l border-slate-200 dark:border-slate-700 pl-2 gap-1">
                      <button 
                        onClick={() => setZoomScale(z => Math.max(0.5, z - 0.25))}
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                        title="Zoom Out"
                      >
                        <ZoomOut size={16} />
                      </button>
                      <span className="text-xs font-mono font-bold text-slate-500 w-12 text-center">{Math.round(zoomScale * 100)}%</span>
                      <button 
                        onClick={() => setZoomScale(z => Math.min(2.0, z + 0.25))}
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                        title="Zoom In"
                      >
                        <ZoomIn size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50">
                 {/* Match Score Dashboard Injection (Hides if doc is promoted to JD) */}
                 {activeDoc.matchAnalysis && activeDoc.id !== jdDocId && (
                   <div className="mb-6 p-5 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-800/80 dark:to-slate-900 border border-blue-100 dark:border-slate-200 rounded-xl shadow-sm">
                     <div className="flex items-start justify-between">
                       <div>
                         <h4 className="flex items-center gap-2 text-sm font-extrabold text-blue-900 dark:text-blue-400 mb-1">
                           <Award size={16} /> Candidate JD Screening Analysis
                         </h4>
                         <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg mb-3">
                           {activeDoc.matchAnalysis.rationale}
                         </p>
                       </div>
                       <div className="bg-white dark:bg-slate-800 border border-blue-250 dark:border-slate-700 rounded-lg p-3 text-center shadow-sm">
                         <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">SCORE</span>
                         <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{activeDoc.matchAnalysis.score}%</span>
                       </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-blue-200/40">
                       <div>
                         <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Matched Skills</span>
                         <div className="flex flex-wrap gap-1">
                           {activeDoc.matchAnalysis.matchedSkills?.map((s, idx) => (
                             <span key={idx} className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 font-medium">
                               {s}
                             </span>
                           ))}
                         </div>
                       </div>
                       <div>
                         <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Gaps / Missing Skills</span>
                         <div className="flex flex-wrap gap-1">
                           {activeDoc.matchAnalysis.missingSkills?.map((s, idx) => (
                             <span key={idx} className="px-1.5 py-0.5 text-[10px] rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400 font-medium">
                               {s}
                             </span>
                           ))}
                         </div>
                       </div>
                     </div>
                   </div>
                 )}

                 {/* AI candidate summary card */}
                 {activeDoc.summary && (
                    <div className="mb-6 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                       <h4 className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                         <Sparkles size={16} className="text-amber-500" /> Executive Profile Summary
                       </h4>
                       <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                         {activeDoc.summary}
                       </p>
                    </div>
                 )}

                 {/* Page Contents View Renderer */}
                 {docViewMode === 'pdf' && activeDoc.type === 'pdf' ? (
                    <PdfViewer
                      fileUrl={activeDoc.fileUrl}
                      pages={activeDoc.pages}
                      zoom={zoomScale}
                      activeDocId={activeDoc.id}
                    />
                 ) : (
                    <div className="space-y-6">
                      {activeDoc.pages?.map((page) => (
                        <div 
                          key={page.pageNum} 
                          id={`doc-${activeDoc.id}-page-${page.pageNum}`}
                          className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-all duration-300"
                        >
                           <div className="text-right text-xs text-slate-400 dark:text-slate-500 font-mono mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                              PAGE {page.pageNum}
                           </div>
                           <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                              {page.text}
                           </div>
                        </div>
                      ))}
                    </div>
                 )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 dark:bg-slate-950">
              <FileSearch size={48} className="mb-4 text-slate-300 dark:text-slate-700" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Select a candidate document profile from left column</p>
            </div>
          )}
        </section>

        {/* PANEL 3: CHAT RECRUITER ASSISTANT */}
        <section className={`flex-1 min-w-0 bg-white dark:bg-slate-950 flex flex-col relative ${activeTabMobile !== 'chat' ? 'hidden md:flex' : 'flex'}`}>
          
          <div className="p-4 border-b border-slate-100 dark:border-slate-900 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm z-10 flex items-center gap-2">
             <MessageSquare size={18} className="text-blue-600 dark:text-blue-400"/>
             <h2 className="font-bold text-slate-800 dark:text-slate-100">AI Screening Assistant</h2>
          </div>

          <div className="flex-1 min-w-0 overflow-y-auto p-4 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] min-w-0 rounded-2xl px-5 py-3 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 rounded-tl-sm'
                }`}>
                  {msg.role === 'user' ? (
                     <div className="text-sm whitespace-pre-wrap break-words">{msg.text}</div>
                  ) : (
                     <div className="prose prose-sm dark:prose-invert prose-blue max-w-none break-words overflow-x-auto">
                       <ReactMarkdown remarkPlugins={[remarkGfm]} components={renderers}>{msg.text || (isStreaming ? "..." : "")}</ReactMarkdown>
                     </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Prompt chips dynamically rendering from selected resume */}
          {activeSuggested.length > 0 && messages.length < 3 && (
            <div className="px-4 pb-2 flex overflow-x-auto gap-2 no-scrollbar">
               {activeSuggested.map((q, i) => (
                  <button 
                    key={i}
                    onClick={() => handleChatSubmit(q)}
                    className="whitespace-nowrap flex-none text-xs bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-700 dark:hover:text-blue-400 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    {q}
                  </button>
               ))}
            </div>
          )}

          {/* Quick recruiters action deck */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
             <div className="flex gap-2 mb-2 items-center text-xs text-slate-500">
               <span className="font-bold uppercase tracking-wider text-[10px]">Quick Screens:</span>
               <button
                 onClick={() => setIsCompareOpen(true)}
                 className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
               >
                 Compare Resumes <ArrowUpRight size={12} />
               </button>
               <span>•</span>
               <button 
                 onClick={() => handleChatSubmit("Draft 3 technical interview screening questions and suggested ideal answers for candidate positions.")}
                 className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
               >
                 Draft Questions <ArrowUpRight size={12} />
               </button>
             </div>

            <form 
              onSubmit={(e) => { e.preventDefault(); handleChatSubmit(); }}
              className="flex items-end gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl p-1 focus-within:ring-2 focus-within:ring-blue-500 transition-all shadow-sm"
            >
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit();
                  }
                }}
                placeholder="Ask about candidate portfolios, compare gaps, or match metrics..."
                className="flex-1 max-h-32 min-h-[44px] bg-transparent border-none focus:ring-0 resize-none text-sm p-3 text-slate-800 dark:text-slate-100 outline-none"
                rows={1}
              />
              <button 
                type="submit"
                disabled={!chatInput.trim()}
                className="p-3 m-1 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isStreaming ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
              </button>
            </form>
          </div>
        </section>
      </main>

      {/* --- COMPARE CANDIDATES MODAL --- */}
      {isCompareOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsCompareOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Users size={20} className="text-blue-600" /> Compare Candidates
              </h2>
              <button onClick={() => setIsCompareOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {!jdDocId && (
                <div className="flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400 p-3 rounded-lg">
                  <AlertCircle size={16} className="flex-none mt-0.5" />
                  <span>Designate or paste a Job Description to score and rank these candidates by fit.</span>
                </div>
              )}

              {comparisonDocs.length === 0 ? (
                <div className="text-center text-sm text-slate-400 dark:text-slate-600 py-10">
                  No candidates to compare. Upload and include at least one resume.
                </div>
              ) : (
                comparisonDocs.map(doc => {
                  const score = doc.matchAnalysis?.score;
                  const hasScore = typeof score === 'number';
                  const barColor = !hasScore ? 'bg-slate-300 dark:bg-slate-700'
                    : score >= 75 ? 'bg-emerald-500'
                    : score >= 50 ? 'bg-blue-500'
                    : 'bg-amber-500';
                  const matched = doc.matchAnalysis?.matchedSkills?.length ? doc.matchAnalysis.matchedSkills : null;
                  const gaps = doc.matchAnalysis?.missingSkills?.length ? doc.matchAnalysis.missingSkills : null;

                  return (
                    <div key={doc.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <button
                          onClick={() => { setActiveDocId(doc.id); setActiveTabMobile('viewer'); setIsCompareOpen(false); }}
                          className="font-semibold text-sm text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 truncate text-left"
                          title="Open in viewer"
                        >
                          {doc.name}
                        </button>
                        <span className="flex-none text-sm font-black text-slate-700 dark:text-slate-200">
                          {hasScore ? `${score}%` : 'Not scored'}
                        </span>
                      </div>

                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
                        <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: hasScore ? `${score}%` : '0%' }} />
                      </div>

                      {doc.matchAnalysis?.rationale && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                          {doc.matchAnalysis.rationale}
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Matched Skills</span>
                          <div className="flex flex-wrap gap-1">
                            {matched ? matched.map((s, i) => (
                              <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 font-medium">
                                {s}
                              </span>
                            )) : <span className="text-[10px] text-slate-400">—</span>}
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Gaps / Missing</span>
                          <div className="flex flex-wrap gap-1">
                            {gaps ? gaps.map((s, i) => (
                              <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400 font-medium">
                                {s}
                              </span>
                            )) : <span className="text-[10px] text-slate-400">—</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- SETTINGS MODAL --- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Settings size={20} className="text-blue-600"/> TalentLens Key Setup
              </h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 text-blue-800 dark:text-blue-300 text-sm p-4 rounded-xl flex items-start gap-3">
                <AlertCircle size={20} className="flex-none mt-0.5" />
                <p>
                  TalentLens operates client-side inside the browser. Your Gemini API key is stored strictly in memory storage (<strong>sessionStorage</strong>) and communicates directly with Google endpoints.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Google Gemini API Key
                </label>
                <input 
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm dark:text-slate-100"
                />
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Recommended for stable usage: <strong>Gemini 2.5 Flash</strong> from Google AI Studio.
                </p>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-2">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2.5 text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  sessionStorage.setItem('gemini_api_key', apiKey);
                  setIsSettingsOpen(false);
                }}
                className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}