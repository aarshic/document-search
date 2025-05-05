from fastapi import FastAPI, UploadFile, File, Form, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import numpy as np
from sentence_transformers import SentenceTransformer
import faiss
import json
import os
import fitz  # PyMuPDF
from io import BytesIO
from fastapi.responses import StreamingResponse, FileResponse
from keybert import KeyBERT

app = FastAPI(title="Semantic Search API")

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the sentence transformer model
model = SentenceTransformer('all-MiniLM-L6-v2')
kw_model = KeyBERT(model)

# Initialize FAISS index
embedding_size = 384  # Size of embeddings from all-MiniLM-L6-v2
index = faiss.IndexFlatL2(embedding_size)

# Store documents and their embeddings
documents = []
document_embeddings = []

FINANCE_DOCS_DIR = os.path.join(os.path.dirname(__file__), 'finance_documents')

# Create finance_documents directory if it doesn't exist
os.makedirs(FINANCE_DOCS_DIR, exist_ok=True)

# Helper to extract text from PDF (first N pages or all)
def extract_text_from_pdf(pdf_path: str, max_pages: int = 5) -> str:
    doc = fitz.open(pdf_path)
    text = ""
    for page_num in range(min(len(doc), max_pages)):
        text += doc[page_num].get_text()
    doc.close()
    return text

# Helper to generate thumbnail (first page)
def get_pdf_thumbnail(pdf_path: str) -> bytes:
    doc = fitz.open(pdf_path)
    page = doc[0]
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
    img_bytes = pix.tobytes("png")
    doc.close()
    return img_bytes

# On startup, scan PDFs and build index
def build_index():
    global documents, document_embeddings
    documents.clear()
    document_embeddings.clear()
    pdf_files = [f for f in os.listdir(FINANCE_DOCS_DIR) if f.lower().endswith('.pdf')]
    for idx, fname in enumerate(pdf_files):
        fpath = os.path.join(FINANCE_DOCS_DIR, fname)
        text = extract_text_from_pdf(fpath)
        embedding = model.encode([text])[0]
        # Extract 3 relevant tags using KeyBERT
        tags = [kw[0] for kw in kw_model.extract_keywords(text, keyphrase_ngram_range=(1, 2), stop_words='english', top_n=3)]
        doc = {
            "id": idx,
            "content": text[:500],  # Store a snippet for preview
            "metadata": {
                "filename": fname,
                "path": fpath,
                "tags": tags
            }
        }
        documents.append(doc)
        document_embeddings.append(embedding)
    if document_embeddings:
        index.reset()
        index.add(np.array(document_embeddings))

@app.on_event("startup")
def on_startup():
    build_index()

class SearchQuery(BaseModel):
    query: str
    top_k: Optional[int] = 5
    tags: Optional[List[str]] = None

@app.post("/search")
async def search(query: SearchQuery):
    if not documents:
        return {"message": "No documents in the index", "results": []}
    query_embedding = model.encode([query.query])[0]
    # Compute cosine similarities
    doc_embs = np.array(document_embeddings)
    query_emb = np.array(query_embedding)
    # Normalize
    doc_embs_norm = doc_embs / np.linalg.norm(doc_embs, axis=1, keepdims=True)
    query_emb_norm = query_emb / np.linalg.norm(query_emb)
    similarities = np.dot(doc_embs_norm, query_emb_norm)
    # Get top_k indices
    top_k = min(query.top_k, len(documents))
    top_indices = np.argsort(similarities)[::-1][:top_k]
    results = []
    for idx in top_indices:
        doc = documents[idx]
        results.append({
            "document_id": doc["id"],
            "content": doc["content"],
            "metadata": {
                "filename": doc["metadata"]["filename"],
                "path": doc["metadata"]["path"],
                "tags": doc["metadata"]["tags"]
            },
            "similarity_score": float(similarities[idx])
        })
    return {"results": results}

@app.get("/documents")
async def list_documents():
    return {"documents": documents}

@app.get("/thumbnail/{doc_id}")
async def get_thumbnail(doc_id: int):
    if 0 <= doc_id < len(documents):
        pdf_path = documents[doc_id]["metadata"]["path"]
        img_bytes = get_pdf_thumbnail(pdf_path)
        return StreamingResponse(BytesIO(img_bytes), media_type="image/png")
    return Response(status_code=404)

@app.post("/upload")
async def upload_document(file: UploadFile = File(...), tags: str = Form("")):
    if not file.filename.lower().endswith('.pdf'):
        return {"error": "Only PDF files are supported"}
    
    file_path = os.path.join(FINANCE_DOCS_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Parse tags from comma-separated string
    tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
    
    # Rebuild index with new document
    build_index()
    return {"message": f"File {file.filename} uploaded successfully", "tags": tag_list}

@app.get("/documents/{path:path}")
async def get_document(path: str):
    try:
        file_path = os.path.join(FINANCE_DOCS_DIR, path)
        if not os.path.exists(file_path):
            return Response(status_code=404)
        return FileResponse(file_path)
    except Exception as e:
        return Response(status_code=500, content=str(e))

# Endpoint to update tags for a document
class TagUpdateRequest(BaseModel):
    tags: list[str]

@app.post("/documents/{doc_id}/tags")
async def update_document_tags(doc_id: int, tag_update: TagUpdateRequest):
    if 0 <= doc_id < len(documents):
        documents[doc_id]["metadata"]["tags"] = tag_update.tags
        return {"message": "Tags updated successfully", "tags": tag_update.tags}
    raise HTTPException(status_code=404, detail="Document not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
