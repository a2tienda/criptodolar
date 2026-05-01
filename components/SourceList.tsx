import React from 'react';
import { GroundingChunk } from '../types';

interface SourceListProps {
  sources: GroundingChunk[];
}

export const SourceList: React.FC<SourceListProps> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;

  // Filter out duplicates based on URI
  const uniqueSources = sources.filter((source, index, self) => 
    index === self.findIndex((t) => (
      t.web?.uri === source.web?.uri
    ))
  );

  return (
    <div className="mt-8 text-sm text-slate-500 dark:text-slate-400 transition-colors">
      <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Fuentes consultadas (Google Search):</h4>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {uniqueSources.map((source, idx) => (
          source.web ? (
            <li key={idx} className="bg-slate-50 dark:bg-slate-800 rounded px-3 py-2 border border-slate-100 dark:border-slate-700 truncate hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors">
              <a 
                href={source.web.uri} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-purple-600 dark:hover:text-purple-400 text-slate-700 dark:text-slate-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                <span className="truncate">{source.web.title || source.web.uri}</span>
              </a>
            </li>
          ) : null
        ))}
      </ul>
    </div>
  );
};