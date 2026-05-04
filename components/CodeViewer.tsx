
import React, { useMemo, useState } from 'react';
import Prism from 'prismjs';
// Order is critical here: markup-templating must be loaded before PHP
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-markdown';
import { Copy, Check, FileCode, Database, Terminal, Code2, Search, Package, Folder, FolderOpen, File, ChevronRight, ChevronDown, FileJson, Layers } from 'lucide-react';

interface CodeViewerProps {
  files: { name: string; content: string; type: 'migration' | 'model' | 'seeder' | 'controller' | 'config' | 'markdown' }[];
  onClose: () => void;
}

// Tree Structure Interface
interface TreeNode {
    name: string;
    path: string;
    type: 'file' | 'folder';
    children?: TreeNode[];
    fileData?: { content: string; type: string };
    isOpen?: boolean;
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

// Recursive function to build tree
const buildTree = (files: CodeViewerProps['files']): TreeNode[] => {
    const root: TreeNode[] = [];

    files.forEach(file => {
        const parts = file.name.split('/');
        let currentLevel = root;

        parts.forEach((part, index) => {
            const isFile = index === parts.length - 1;
            const existingNode = currentLevel.find(n => n.name === part);

            if (existingNode) {
                if (isFile) {
                    // Should not happen with unique paths, but safety check
                    existingNode.fileData = { content: file.content, type: file.type };
                } else {
                    currentLevel = existingNode.children || [];
                }
            } else {
                const newNode: TreeNode = {
                    name: part,
                    path: parts.slice(0, index + 1).join('/'),
                    type: isFile ? 'file' : 'folder',
                    children: isFile ? undefined : [],
                    fileData: isFile ? { content: file.content, type: file.type } : undefined,
                    isOpen: true // Default open
                };
                currentLevel.push(newNode);
                if (!isFile) {
                    currentLevel = newNode.children || [];
                }
            }
        });
    });

    // Sort folders first, then files
    const sortNodes = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });
        nodes.forEach(n => {
            if (n.children) sortNodes(n.children);
        });
    };
    sortNodes(root);
    return root;
};

const getFileIcon = (fileName: string, type?: string) => {
    if (fileName === 'composer.json') return <Package size={14} className="text-orange-400" />;
    if (fileName.endsWith('blade.php')) return <Layers size={14} className="text-red-400" />;
    if (fileName.endsWith('.php')) return <FileCode size={14} className="text-indigo-400" />;
    if (fileName.endsWith('.json')) return <FileJson size={14} className="text-yellow-400" />;
    return <File size={14} className="text-slate-400" />;
};

export default function CodeViewer({ files, onClose }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  
  // Build tree structure
  const [treeStructure, setTreeStructure] = useState<TreeNode[]>(() => buildTree(files));
  
  // Set default active file
  if (!activeFilePath && files.length > 0) {
      setActiveFilePath(files[0].name);
  }

  const activeFile = useMemo(() => {
      return files.find(f => f.name === activeFilePath);
  }, [files, activeFilePath]);

  const toggleFolder = (path: string) => {
      const updateNode = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map(node => {
              if (node.path === path) {
                  return { ...node, isOpen: !node.isOpen };
              }
              if (node.children) {
                  return { ...node, children: updateNode(node.children) };
              }
              return node;
          });
      };
      setTreeStructure(prev => updateNode(prev));
  };

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
    if (grammar) {
      try {
        return Prism.highlight(activeFile.content, grammar, codeLang);
      } catch (e) {
        return escapeHtml(activeFile.content);
      }
    }
    return escapeHtml(activeFile.content);
  }, [activeFile, codeLang]);

  const handleCopy = () => {
    if(activeFile) {
        navigator.clipboard.writeText(activeFile.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  const RecursiveTree = ({ nodes, level = 0 }: { nodes: TreeNode[], level?: number }) => {
      return (
          <>
            {nodes.map(node => (
                <div key={node.path}>
                    <div 
                        className={`
                            flex items-center gap-1.5 py-1 px-2 cursor-pointer transition-colors text-sm
                            ${level === 0 ? 'pl-2' : ''}
                            ${node.type === 'file' && activeFilePath === node.path ? 'bg-[#37373d] text-white' : 'text-slate-400 hover:bg-[#2a2d2e] hover:text-slate-200'}
                        `}
                        style={{ paddingLeft: `${level * 12 + 8}px` }}
                        onClick={() => {
                            if (node.type === 'folder') toggleFolder(node.path);
                            else setActiveFilePath(node.path);
                        }}
                    >
                        {node.type === 'folder' && (
                            <span className="text-slate-500">
                                {node.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </span>
                        )}
                        {node.type === 'folder' ? (
                            node.isOpen ? <FolderOpen size={14} className="text-blue-400" /> : <Folder size={14} className="text-blue-400" />
                        ) : (
                            getFileIcon(node.name)
                        )}
                        <span className="truncate select-none">{node.name}</span>
                    </div>
                    {node.type === 'folder' && node.isOpen && node.children && (
                        <RecursiveTree nodes={node.children} level={level + 1} />
                    )}
                </div>
            ))}
          </>
      );
  };

  return (
    <div className="flex h-full flex-col md:flex-row bg-[#1e1e1e] text-slate-300 font-sans">
        {/* Sidebar File Tree */}
        <div className="w-full md:w-72 bg-[#252526] border-r border-[#333] flex flex-col">
            <div className="p-3 border-b border-[#333] text-xs font-bold tracking-wider text-slate-500 uppercase flex justify-between items-center bg-[#1e1e1e]">
                <span>Project Explorer</span>
            </div>
            
            <div className="overflow-y-auto flex-1 py-2 custom-scrollbar">
                <RecursiveTree nodes={treeStructure} />
            </div>
        </div>

        {/* Code Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
             {/* Tabs Header */}
             <div className="flex bg-[#252526] border-b border-[#333] overflow-x-auto no-scrollbar h-9">
                 {activeFilePath && (
                     <div className="px-4 flex items-center gap-2 border-r border-[#333] bg-[#1e1e1e] text-indigo-400 border-t-2 border-t-indigo-500 min-w-[150px]">
                        {getFileIcon(activeFilePath.split('/').pop()!)}
                        <span className="truncate text-xs">{activeFilePath.split('/').pop()}</span>
                     </div>
                 )}
             </div>

             {/* Toolbar */}
             <div className="flex items-center justify-between px-4 py-2 border-b border-[#333] bg-[#1e1e1e]">
                 <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
                     {activeFilePath}
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
                 <pre className="line-numbers !bg-transparent !m-0 !p-4 !font-mono text-sm leading-relaxed">
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
