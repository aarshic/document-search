export interface SearchResult {
  document_id: number;
  content: string;
  metadata: {
    filename: string;
    path: string;
    tags: string[];
  };
  similarity_score: number;
}

export interface SearchResponse {
  results: SearchResult[];
} 