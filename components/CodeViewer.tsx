import React, { useMemo, useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-markdown';
import { Copy, Check, FileCode, Database, Terminal, Code2, Search, Package } from 'lucide-react';

interface CodeViewerProps {
  files: { name: string; content: string; type: 'migration' | 'model' | 'seeder' | 'controller' | 'config' | 'markdown' }[];
  onClose: () => void;
}

// Helper function to escape HTML entities for safe rendering
const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export default function CodeViewer({ files, onClose }: CodeViewerProps) {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const activeFile = files[selectedFileIndex];

  const codeLang = useMemo(() => {
    if (!activeFile) return 'php';
    if (activeFile.name.endsWith('.json')) return 'json';
    if (activeFile.name.endsWith('.ts')) return 'typescript';
    if (activeFile.name.endsWith('.md')) return 'markdown';
    return 'php';
  }, [activeFile]);

  const highlightedCode = useMemo(() => {
    if (!activeFile) return '';
    
    const grammar = Prism.languages[codeLang];

    // Safety Check: Ensure grammar is loaded and highlight, otherwise fallback to plain text.
    if (grammar) {
      try {
        return Prism.highlight(activeFile.content, grammar, codeLang);
      } catch (e) {
        console.error("Prism highlighting failed:", e);
        // Fallback on error
        return escapeHtml(activeFile.content);
      }
    }
    
    // Fallback if grammar is not found
    return escapeHtml(activeFile.content);
  }, [activeFile, codeLang]);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const getIcon = (type: string, name: string) => {
      if (name === 'composer.json') return <Package size={14} className="text-orange-400" />;
      switch(type) {
          case 'migration': return <Database size={14} className="text-yellow-500" />;
          case 'model': return <Code2 size={14} className="text-indigo-400" />;
          case 'seeder': return <Terminal size={14} className="text-green-500" />;
          case 'controller': return <FileCode size={14} className="text-purple-400" />;
          case 'markdown': return <FileCode size={14} className="text-blue-400" />;
          case 'config': return <Package size={14} className="text-orange-400" />;
          default: return <FileCode size={14} />;
      }
  };

  return (
    <div className="flex h-full flex-col md:flex-row bg-[#1e1e1e] text-slate-300 font-sans">
        {/* Sidebar File Tree */}
        <div className="w-full md:w-64 bg-[#252526] border-r border-[#333] flex flex-col">
            <div className="p-3 border-b border-[#333] text-xs font-bold tracking-wider text-slate-500 uppercase flex justify-between items-center">
                <span>Explorer</span>
            </div>
            
            {/* Search */}
            <div className="p-2">
                <div className="relative">
                    <Search size={12} className="absolute left-2 top-2 text-slate-500" />
                    <input 
                        type="text" 
                        placeholder="Search files..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-[#3c3c3c] border border-transparent rounded px-2 pl-7 py-1 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 outline-none"
                    />
                </div>
            </div>

            <div className="overflow-y-auto flex-1 py-2 custom-scrollbar">
                {filteredFiles.map((file, idx) => {
                    const originalIndex = files.indexOf(file);
                    return (
                        <button
                            key={file.name}
                            onClick={() => setSelectedFileIndex(originalIndex)}
                            className={`w-full text-left px-4 py-1.5 text-[13px] flex items-center gap-2 transition-colors border-l-2 ${selectedFileIndex === originalIndex ? 'bg-[#37373d] text-white border-indigo-500' : 'text-slate-400 border-transparent hover:bg-[#2a2d2e] hover:text-slate-200'}`}
                        >
                            {getIcon(file.type, file.name)}
                            <span className="truncate">{file.name}</span>
                        </button>
                    );
                })}
            </div>
        </div>

        {/* Code Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
             {/* Tabs Header */}
             <div className="flex bg-[#252526] border-b border-[#333] overflow-x-auto no-scrollbar">
                 {files.map((file, idx) => (
                     <button
                        key={idx}
                        onClick={() => setSelectedFileIndex(idx)}
                        className={`px-4 py-2 text-xs flex items-center gap-2 border-r border-[#333] min-w-[120px] max-w-[200px] ${selectedFileIndex === idx ? 'bg-[#1e1e1e] text-indigo-400 border-t-2 border-t-indigo-500' : 'text-slate-500 hover:bg-[#2a2d2e]'}`}
                     >
                        {getIcon(file.type, file.name)}
                        <span className="truncate">{file.name}</span>
                        {selectedFileIndex === idx && <div className="ml-auto w-2 h-2 rounded-full bg-white/20" />}
                     </button>
                 ))}
             </div>

             {/* Toolbar */}
             <div className="flex items-center justify-between px-4 py-2 border-b border-[#333]">
                 <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
                     <span>PHP 8.2</span>
                     <span>•</span>
                     <span>Laravel 11</span>
                 </div>
                 <div className="flex items-center gap-2">
                     <button 
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-1 bg-[#333] hover:bg-[#444] rounded text-xs text-white transition-colors"
                     >
                         {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                         {copied ? 'Copied' : 'Copy'}
                     </button>
                 </div>
             </div>

             {/* Editor */}
             <div className="flex-1 overflow-auto custom-scrollbar relative bg-[#1e1e1e]">
                 <pre className="line-numbers !bg-transparent !m-0 !p-4 !font-mono">
                     <code 
                        className={`language-${codeLang}`}
                        dangerouslySetInnerHTML={{ __html: highlightedCode }}
                     />
                 </pre>
             </div>
        </div>
    </div>
  );
}