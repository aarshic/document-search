# Semantic Document Search

A semantic search application that allows you to search through PDF documents using natural language queries. The application uses sentence transformers for semantic search and FAISS for efficient vector similarity search.

## Features

- Semantic search through PDF documents
- PDF thumbnail generation
- Document upload functionality
- Fast and efficient search using FAISS
- RESTful API using FastAPI

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `finance_documents` directory in the project root and add your PDF files there.

4. Start the server:
```bash
python app.py
```

The server will start at `http://localhost:8000`

## API Endpoints

- `POST /search`: Search documents using natural language
  - Request body: `{"query": "your search query", "top_k": 5}`
  - Returns: List of matching documents with similarity scores

- `GET /documents`: List all indexed documents
  - Returns: List of all documents in the index

- `GET /thumbnail/{doc_id}`: Get thumbnail of a document
  - Returns: PNG image of the first page

- `POST /upload`: Upload a new PDF document
  - Form data: `file` (PDF file)
  - Returns: Success message

## Frontend

The frontend is a React application that provides a user interface for the semantic search functionality. It's located in the `semantic-search-frontend` directory.

## Technologies Used

- FastAPI: Web framework
- Sentence Transformers: For generating document embeddings
- FAISS: For efficient similarity search
- PyMuPDF: For PDF processing
- React: Frontend framework
