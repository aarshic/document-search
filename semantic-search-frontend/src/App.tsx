import React from 'react';
import SearchComponent from './components/SearchComponent';
import './App.css';

const App: React.FC = () => {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Semantic Document Search</h1>
        <p>Search through your documents using natural language</p>
      </header>
      <main>
        <SearchComponent />
      </main>
    </div>
  );
};

export default App; 