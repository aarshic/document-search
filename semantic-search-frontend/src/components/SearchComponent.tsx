import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { SearchResult, SearchResponse } from '../types';
import './SearchComponent.css';

const categoryIcons: { [key: string]: JSX.Element } = {
  // Placeholder SVG icons for categories (tags)
  Consultation: (
    <svg width="32" height="32" fill="none" stroke="#6C63FF" strokeWidth="2"><rect x="8" y="8" width="16" height="16" rx="4"/></svg>
  ),
  Dentist: (
    <svg width="32" height="32" fill="none" stroke="#6C63FF" strokeWidth="2"><circle cx="16" cy="16" r="10"/></svg>
  ),
  Cardiologist: (
    <svg width="32" height="32" fill="none" stroke="#6C63FF" strokeWidth="2"><path d="M8 16c4-8 12-8 16 0"/></svg>
  ),
  Hospital: (
    <svg width="32" height="32" fill="none" stroke="#6C63FF" strokeWidth="2"><rect x="6" y="10" width="20" height="12" rx="3"/></svg>
  ),
  Emergency: (
    <svg width="32" height="32" fill="none" stroke="#6C63FF" strokeWidth="2"><polygon points="16,6 26,26 6,26"/></svg>
  ),
  Laboratory: (
    <svg width="32" height="32" fill="none" stroke="#6C63FF" strokeWidth="2"><rect x="12" y="8" width="8" height="16" rx="2"/></svg>
  ),
};

const MAX_TAGS = 5;

const SearchComponent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'search' | 'upload'>('search');
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTags, setUploadTags] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [editTagsOpen, setEditTagsOpen] = useState<boolean>(false);
  const [editTagsDocId, setEditTagsDocId] = useState<number | null>(null);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagsError, setEditTagsError] = useState<string>('');

  useEffect(() => {
    fetch('http://localhost:8000/documents')
      .then(response => response.json())
      .then(data => {
        const allTags = new Set<string>();
        data.documents.forEach((doc: SearchResult) => {
          doc.metadata.tags?.forEach(tag => allTags.add(tag));
        });
        setAvailableTags(Array.from(allTags));
      });
  }, []);

  const handleSearch = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, top_k: 5, tags: selectedTags.length > 0 ? selectedTags : undefined }),
      });
      const data: SearchResponse = await response.json();
      setResults(data.results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentClick = (path: string) => {
    window.open(`http://localhost:8000/documents/${encodeURIComponent(path)}`, '_blank');
  };

  // Upload logic
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    setUploadStatus('');
    if (!uploadFile) {
      setUploadStatus('Please select a PDF file.');
      return;
    }
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('tags', uploadTags);
    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setUploadStatus('Upload successful!');
        setUploadFile(null);
        setUploadTags('');
      } else {
        setUploadStatus(data.error || 'Upload failed.');
      }
    } catch (error) {
      setUploadStatus('Upload failed.');
    }
  };

  // Open tag editor
  const openEditTags = (docId: number, tags: string[]) => {
    setEditTagsDocId(docId);
    setEditTags([...tags]);
    setEditTagsError('');
    setEditTagsOpen(true);
  };

  // Handle tag change
  const handleTagChange = (idx: number, value: string) => {
    const newTags = [...editTags];
    newTags[idx] = value;
    setEditTags(newTags);
  };

  // Add new tag
  const handleAddTag = () => {
    if (editTags.length < MAX_TAGS) {
      setEditTags([...editTags, '']);
    }
  };

  // Remove tag
  const handleRemoveTag = (idx: number) => {
    setEditTags(editTags.filter((_, i) => i !== idx));
  };

  // Save tags to backend
  const handleSaveTags = async () => {
    if (editTags.some(tag => !tag.trim())) {
      setEditTagsError('Tags cannot be empty.');
      return;
    }
    if (editTags.length > MAX_TAGS) {
      setEditTagsError('You can have at most 5 tags.');
      return;
    }
    try {
      const response = await fetch(`http://localhost:8000/documents/${editTagsDocId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: editTags }),
      });
      if (response.ok) {
        // Update tags in results state
        setResults(results => results.map(r =>
          r.document_id === editTagsDocId ? {
            ...r,
            metadata: { ...r.metadata, tags: editTags }
          } : r
        ));
        setEditTagsOpen(false);
      } else {
        setEditTagsError('Failed to update tags.');
      }
    } catch {
      setEditTagsError('Failed to update tags.');
    }
  };

  return (
    <div className="modern-search-container">
      {/* Tab Navigation */}
      <div className="tab-nav">
        <button
          className={activeTab === 'search' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('search')}
        >
          Search
        </button>
        <button
          className={activeTab === 'upload' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('upload')}
        >
          Upload
        </button>
      </div>

      {/* Search Tab */}
      {activeTab === 'search' && (
        <>
          <form onSubmit={handleSearch} className="modern-search-form">
            <div className="modern-search-input-wrapper">
              <input
                type="text"
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                placeholder="Search documents..."
                className="modern-search-input"
              />
              <button type="submit" className="modern-search-icon-btn" disabled={loading}>
                <svg width="22" height="22" fill="none" stroke="#b0b0b0" strokeWidth="2"><circle cx="10" cy="10" r="8"/><line x1="16" y1="16" x2="21" y2="21"/></svg>
              </button>
            </div>
          </form>

          {results.length > 0 && (
            <>
              <div className="modern-top-results-title">Top Results</div>
              <div className="modern-results-list">
                {results.map((result, index) => (
                  <div key={index} className="modern-result-card" onClick={() => handleDocumentClick(result.metadata.path)}>
                    <img
                      src={`http://localhost:8000/thumbnail/${result.document_id}`}
                      alt={`Thumbnail for ${result.metadata.filename}`}
                      className="modern-result-thumbnail"
                    />
                    <div className="modern-result-content">
                      <div className="modern-result-title">{result.metadata.filename}</div>
                      <div className="modern-result-snippet">{result.content}</div>
                      <div className="modern-result-tags">
                        {result.metadata.tags?.map((tag: string, i: number) => (
                          <span key={i} className="modern-result-tag">{tag}</span>
                        ))}
                        <button
                          className="edit-tags-btn"
                          type="button"
                          title="Edit tags"
                          onClick={e => {
                            e.stopPropagation();
                            openEditTags(result.document_id, result.metadata.tags || []);
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="#4fc3f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 3l5 5-9.5 9.5H3v-4.5L12 3z"/>
                          </svg>
                        </button>
                      </div>
                      <div className="modern-result-similarity">Similarity: {(result.similarity_score * 100).toFixed(2)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Edit Tags Dialog */}
          {editTagsOpen && (
            <div className="modal-overlay">
              <div className="modal-dialog">
                <div className="modal-title">Edit Tags</div>
                <div className="modal-tags-list">
                  {editTags.map((tag, idx) => (
                    <div key={idx} className="modal-tag-row">
                      <input
                        type="text"
                        value={tag}
                        maxLength={32}
                        onChange={e => handleTagChange(idx, e.target.value)}
                        className="modal-tag-input"
                      />
                      <button
                        type="button"
                        className="modal-remove-tag"
                        onClick={() => handleRemoveTag(idx)}
                        disabled={editTags.length <= 1}
                      >×</button>
                    </div>
                  ))}
                  {editTags.length < MAX_TAGS && (
                    <button type="button" className="modal-add-tag" onClick={handleAddTag}>+ Add Tag</button>
                  )}
                </div>
                {editTagsError && <div className="modal-error">{editTagsError}</div>}
                <div className="modal-actions">
                  <button type="button" className="modal-cancel" onClick={() => setEditTagsOpen(false)}>Cancel</button>
                  <button type="button" className="modal-save" onClick={handleSaveTags}>Save</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <form className="modern-upload-form" onSubmit={handleUpload}>
          <label className="upload-label">
            Select PDF file
            <input type="file" accept="application/pdf" onChange={handleFileChange} />
          </label>
          <input
            type="text"
            className="upload-tags-input"
            placeholder="Optional: comma-separated tags"
            value={uploadTags}
            onChange={e => setUploadTags(e.target.value)}
          />
          <button type="submit" className="upload-btn">Upload</button>
          {uploadStatus && <div className="upload-status">{uploadStatus}</div>}
        </form>
      )}
    </div>
  );
};

export default SearchComponent; 