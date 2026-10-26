# LegalDesk AI ⚖️
### AI-Powered Legal Case Intelligence & Workspace for Indian Advocates

LegalDesk AI is a production-ready AI workspace designed specifically for Indian advocates, law firms, and legal researchers. Upload case documents (FIR, charge sheets, judgments, petitions, contracts, evidence, court orders) and get grounded answers, case timelines, applicable legal provisions, arguments, and court-ready pleadings—with exact document and page-level citations.

---

## 🚀 Key Features

- **📁 Case & Matter Management**: Multi-case organization with client details, court forums, matter types (Criminal, Civil, Bail, Writ, Matrimonial), and status tracking.
- **📄 Document Ingestion & Vector Indexing**: Extract text page-by-page from digital and scanned PDFs, DOCX, and text files. Chunks are embedded with OpenAI's `text-embedding-3-large` (3072 dimensions).
- **💬 Grounded AI Research (RAG)**: Ask factual and legal questions scoped strictly to your case documents. Every response includes verified `[DocName, Page N]` citations to prevent hallucinations.
- **⚖️ Automated Indian Legal Analysis**:
  - Structured 2-3 paragraph case summary
  - Key facts with page citations
  - Applicable statutory sections (IPC / BNS, CrPC / BNSS, Evidence Act / BSA, etc.)
  - Strong arguments (favorable points) & weak vulnerabilities (with counter-strategies)
  - Similar High Court and Supreme Court precedents
- **📅 Chronological Case Timeline**: Automatic extraction of dates, events (incidents, FIR filings, arrests, remand, hearings, interim orders), and associated citations.
- **📝 Court-Ready Legal Drafting**: Generate formal Pleadings, Petitions, Bail Applications (Sec 437/438/439 CrPC), Legal Notices, and Written Statements with one-click export to **Microsoft Word (.docx)**.
- **🐳 100% Dockerized**: Frontend (Nginx Alpine) and Backend (Python FastAPI) run in isolated containers with shared volume persistence. Zero external database required!

---

## 🛠️ Tech Stack

- **Backend**: FastAPI, Python 3.11/3.15, Pydantic v2, Uvicorn, PyPDF, Python-docx, Structlog
- **Frontend**: Responsive Single-Page Application (HTML5, Vanilla CSS, Lucide Icons, Marked.js, Tailwind-inspired Slate/Navy palette)
- **Containerization**: Docker & Docker Compose (Nginx reverse proxy on port 3000 -> FastAPI on port 8000)
- **AI Models**: OpenAI `gpt-4o` (Reasoning & Drafting) + `text-embedding-3-large` (Vector Embeddings)
- **Storage**: Embedded file-persisted local store with in-memory cosine similarity search

---

## ⚡ Quickstart with Docker (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Piyush2004gupta/Legal-RAG-AI.git
   cd Legal-RAG-AI
   ```

2. **Configure environment:**
   Create a `.env` file in the root directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_CHAT_MODEL=gpt-4o
   OPENAI_EMBEDDING_MODEL=text-embedding-3-large
   STORAGE_PATH=/app/storage
   ENVIRONMENT=production
   ```

3. **Build and start containers:**
   ```bash
   docker compose up --build -d
   ```

4. **Access the application:**
   - **Web Workspace**: [http://localhost:3000](http://localhost:3000)
   - **Backend API**: [http://localhost:8000](http://localhost:8000)
   - **Interactive API Docs (Swagger)**: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)

---

## 💻 Quickstart without Docker (Local Python)

1. **Install dependencies:**
   ```bash
   pip install -r backend/requirements.txt
   ```

2. **Run launcher:**
   ```bash
   python run.py
   ```

3. Open your browser at **[http://localhost:8000](http://localhost:8000)**.

---

## 🔒 Security & Privacy

- Document embeddings and extracted texts are saved locally on your disk in `./backend/storage/`.
- No sensitive keys or case data are committed to version control.
- API requests proxy directly between your local Nginx container and FastAPI backend.

---

## 📄 License

MIT License. Designed for Indian Advocates and Legal Practitioners.
