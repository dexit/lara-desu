import React, { useCallback, useState, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  Panel,
  MarkerType,
  ConnectionMode,
} from 'reactflow';
import TableNode from './TableNode';
import Sidebar from './Sidebar';
import { TableData, LaravelColumnType } from '../types';
import { generateMigration } from '../services/laravelExporter';
import { suggestSchema } from '../services/geminiService';
import { Code, Download, Loader2, Plus, Sparkles, X, Share2 } from 'lucide-react';

const nodeTypes = {
  table: TableNode,
};

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

// Helper to create a new unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

export default function Editor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showCodePreview, setShowCodePreview] = useState(false);

  // --- Handlers ---

  const onConnect = useCallback(
    (params: Connection) => {
      // Ensure we are connecting columns
      if (!params.sourceHandle || !params.targetHandle) return;

      setEdges((eds) => addEdge({ 
          ...params, 
          animated: true, 
          style: { stroke: '#6366f1', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
          type: 'default'
      }, eds));
    },
    [setEdges]
  );

  const handleAddTable = () => {
    const id = generateId();
    const newTable: Node = {
      id,
      type: 'table',
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: {
        name: `table_${nodes.length + 1}`,
        columns: [
          { id: generateId(), name: 'id', type: LaravelColumnType.ID, nullable: false, unique: false },
        ],
        timestamps: true,
        softDeletes: false,
        onEdit: (id: string) => setSelectedTableId(id),
        onDelete: (id: string) => handleDeleteTable(id),
      },
    };
    setNodes((nds) => nds.concat(newTable));
  };

  const handleDeleteTable = (id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    if (selectedTableId === id) setSelectedTableId(null);
  };

  const handleUpdateTable = (id: string, newData: Partial<TableData>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    try {
      const suggestedTables = await suggestSchema(aiPrompt);
      
      const newNodes: Node[] = suggestedTables.map((table, index) => ({
        id: generateId(),
        type: 'table',
        position: { x: 250 + (index * 320), y: 150 + (index % 3 * 80) }, 
        data: {
            ...table,
            onEdit: (id: string) => setSelectedTableId(id),
            onDelete: (id: string) => handleDeleteTable(id),
        }
      }));

      // Attempt to auto-link based on foreignId convention (simple heuristic)
      const newEdges: Edge[] = [];
      newNodes.forEach(sourceNode => {
          sourceNode.data.columns.forEach(col => {
             if(col.type === LaravelColumnType.FOREIGN_ID || col.name.endsWith('_id')) {
                 const targetName = col.name.replace('_id', ''); // e.g. user_id -> user
                 // Find a table named 'users' or 'user'
                 const targetNode = newNodes.find(n => n.data.name === targetName || n.data.name === targetName + 's');
                 if(targetNode) {
                     const targetCol = targetNode.data.columns.find(c => c.type === LaravelColumnType.ID || c.name === 'id');
                     if(targetCol) {
                         newEdges.push({
                             id: `e-${sourceNode.id}-${col.id}-${targetNode.id}`,
                             source: sourceNode.id,
                             sourceHandle: `src-${col.id}`,
                             target: targetNode.id,
                             targetHandle: `tgt-${targetCol.id}`,
                             animated: true,
                             style: { stroke: '#6366f1', strokeWidth: 2 },
                             markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' }
                         });
                     }
                 }
             }
          });
      });

      setNodes((nds) => [...nds, ...newNodes]);
      setEdges((eds) => [...eds, ...newEdges]);
      setAiPrompt("");
    } catch (e) {
      console.error(e);
      alert("Failed to generate schema. Please check your API key.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const exportProject = () => {
    const data = { nodes, edges };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lara-schema.json';
    a.click();
  };
  
  const importProject = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
            const json = JSON.parse(e.target?.result as string);
            if (json.nodes) {
                // Re-attach handlers which are not serializable
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const restoredNodes = json.nodes.map((n: any) => ({
                    ...n,
                    data: {
                        ...n.data,
                        onEdit: (id: string) => setSelectedTableId(id),
                        onDelete: (id: string) => handleDeleteTable(id),
                    }
                }));
                setNodes(restoredNodes);
            }
            if (json.edges) setEdges(json.edges);
          } catch (err) {
              alert('Invalid file format');
          }
      };
      reader.readAsText(file);
  };

  // Find currently selected node data
  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedTableId), [nodes, selectedTableId]);

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans">
      <ReactFlowProvider>
        {/* Sidebar */}
        <Sidebar 
            selectedNode={selectedNode} 
            onUpdateTable={handleUpdateTable}
            onClose={() => setSelectedTableId(null)}
        />

        {/* Main Canvas */}
        <div className="flex-1 relative h-full">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                className="bg-slate-50 dark:bg-slate-900"
                defaultEdgeOptions={{ type: 'smoothstep' }}
                connectionMode={ConnectionMode.Loose}
            >
                <Background gap={12} size={1} />
                <Controls />
                <MiniMap style={{background: '#1e293b'}} nodeColor={() => '#6366f1'} />
                
                {/* Top Toolbar */}
                <Panel position="top-center" className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex gap-2 items-center mt-4">
                    <button 
                        onClick={handleAddTable}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-indigo-500/30"
                    >
                        <Plus size={16} />
                        New Table
                    </button>
                    
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
                    
                    <div className="relative flex items-center">
                         <div className="absolute left-3 text-slate-400">
                             {isAiLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                         </div>
                         <input 
                            type="text" 
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
                            placeholder="AI Generate (e.g. 'E-commerce system')..." 
                            className="pl-9 pr-20 py-2 w-80 bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-indigo-500 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none dark:text-white transition-all"
                         />
                         <button 
                            onClick={handleAiGenerate}
                            disabled={isAiLoading || !aiPrompt}
                            className="absolute right-1 px-3 py-1 bg-white dark:bg-slate-800 text-xs font-bold rounded-lg shadow-sm text-indigo-600 hover:text-indigo-700 disabled:opacity-50 border border-slate-100 dark:border-slate-700"
                         >
                            Generate
                         </button>
                    </div>

                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />

                    <button 
                        onClick={() => setShowCodePreview(true)}
                        className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="View Migrations"
                    >
                        <Code size={20} />
                    </button>
                     <button 
                        onClick={exportProject}
                        className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Export JSON"
                    >
                        <Download size={20} />
                    </button>
                     <label className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition-colors" title="Import JSON">
                        <span className="sr-only">Import</span>
                        <Share2 size={20} className="transform rotate-90" />
                        <input type="file" className="hidden" accept=".json" onChange={importProject} />
                    </label>
                </Panel>
            </ReactFlow>
        </div>

        {/* Code Preview Modal */}
        {showCodePreview && (
             <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-8">
                 <div className="bg-white dark:bg-slate-800 w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700">
                     <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                         <div>
                            <h3 className="text-xl font-bold dark:text-white">Migration Preview</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Laravel 10+ / PHP 8.1+ Anonymous Migrations</p>
                         </div>
                         <button onClick={() => setShowCodePreview(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full dark:text-white transition-colors">
                             <X size={24} />
                         </button>
                     </div>
                     <div className="flex-1 overflow-auto p-6 bg-slate-100 dark:bg-slate-950 font-mono text-xs">
                         {nodes.length > 0 ? (
                             nodes.map(node => (
                             <div key={node.id} className="mb-10 last:mb-0">
                                 <div className="flex items-center justify-between mb-3 bg-white dark:bg-slate-900 p-3 rounded-t-lg border border-slate-200 dark:border-slate-800 border-b-0">
                                     <div className="flex items-center gap-2">
                                        <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">File</span>
                                        <span className="text-slate-700 dark:text-slate-300 font-medium">{`database/migrations/2024_01_01_000000_create_${node.data.name}_table.php`}</span>
                                     </div>
                                 </div>
                                 <pre className="p-6 bg-white dark:bg-[#0d1117] rounded-b-lg shadow-sm border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300 overflow-x-auto leading-relaxed">
                                     {generateMigration(node, nodes, edges)}
                                 </pre>
                             </div>
                         ))
                         ) : (
                             <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                 <Code size={48} className="mb-4 opacity-50" />
                                 <p className="text-lg">No tables defined.</p>
                                 <p className="text-sm">Add a table manually or use AI to generate a schema.</p>
                             </div>
                         )}
                     </div>
                 </div>
             </div>
        )}
      </ReactFlowProvider>
    </div>
  );
}