import React, { useCallback, useState, useMemo, useRef } from 'react';
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
import ContextMenu from './ContextMenu';
import CodeViewer from './CodeViewer';
import AiAssistantModal from './AiAssistantModal';
import { TableData, LaravelColumnType, AiSettings } from '../types';
import { generateMigration, generateModel, generateSeeder, generateController } from '../services/laravelExporter';
import { suggestSchema, suggestSchemaFromJson } from '../services/geminiService';
import { getLayoutedElements } from '../services/layout';
import { Code, Download, Plus, Sparkles, X, Share2, Layout } from 'lucide-react';

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
  
  const [showCodePreview, setShowCodePreview] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [menu, setMenu] = useState<{ id: string; top: number; left: number; right: number; bottom: number; type: 'node' | 'edge' | 'pane' } | null>(null);
  
  const ref = useRef<HTMLDivElement>(null);

  // --- Handlers ---

  const onConnect = useCallback(
    (params: Connection) => {
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
  
  const onPaneClick = useCallback(() => setMenu(null), []);
  
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      
      const pane = ref.current?.getBoundingClientRect();
      if(pane) {
          setMenu({
            id: node.id,
            top: event.clientY,
            left: event.clientX,
            right: pane.width - event.clientX,
            bottom: pane.height - event.clientY,
            type: 'node',
          });
      }
    },
    []
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const pane = ref.current?.getBoundingClientRect();
       if(pane) {
          setMenu({
            id: 'pane',
            top: event.clientY,
            left: event.clientX,
            right: pane.width - event.clientX,
            bottom: pane.height - event.clientY,
            type: 'pane',
          });
       }
    },
    []
  );

  const handleAddTable = (x?: number, y?: number) => {
    const id = generateId();
    const newTable: Node = {
      id,
      type: 'table',
      position: { x: x ?? Math.random() * 400 + 100, y: y ?? Math.random() * 400 + 100 },
      data: {
        name: `table_${nodes.length + 1}`,
        columns: [
          { id: generateId(), name: 'id', type: LaravelColumnType.ID, nullable: false, unique: false },
        ],
        timestamps: true,
        softDeletes: false,
        onEdit: (id: string) => { setSelectedTableId(id); setMenu(null); },
        onDelete: (id: string) => { handleDeleteTable(id); setMenu(null); },
      },
    };
    setNodes((nds) => nds.concat(newTable));
  };

  const handleDeleteTable = (id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    if (selectedTableId === id) setSelectedTableId(null);
  };
  
  const handleDuplicateTable = (id: string) => {
      const node = nodes.find(n => n.id === id);
      if(!node) return;
      
      const newId = generateId();
      const newNode: Node = {
          ...node,
          id: newId,
          position: { x: node.position.x + 50, y: node.position.y + 50 },
          data: {
              ...node.data,
              name: `${node.data.name}_copy`,
              columns: node.data.columns.map(c => ({...c, id: generateId()})),
              onEdit: (id: string) => { setSelectedTableId(id); setMenu(null); },
              onDelete: (id: string) => { handleDeleteTable(id); setMenu(null); },
          }
      };
      setNodes((nds) => nds.concat(newNode));
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
  
  const handleLayout = useCallback(() => {
      const layouted = getLayoutedElements(nodes, edges);
      setNodes([...layouted.nodes]);
      setEdges([...layouted.edges]);
  }, [nodes, edges, setNodes, setEdges]);

  const processAiNodes = (suggestedTables: TableData[]) => {
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

      // Auto-link logic
      const newEdges: Edge[] = [];
      newNodes.forEach(sourceNode => {
          sourceNode.data.columns.forEach(col => {
             if(col.type === LaravelColumnType.FOREIGN_ID || col.name.endsWith('_id')) {
                 const targetName = col.name.replace('_id', ''); 
                 // Try exact match then plural match
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
      
      // Apply layout after a short delay
      setTimeout(() => {
         const layouted = getLayoutedElements([...nodes, ...newNodes], [...edges, ...newEdges]);
         setNodes([...layouted.nodes]);
         setEdges([...layouted.edges]); 
      }, 100);
      
      setShowAiModal(false);
  };

  const handleAiGenerateText = async (prompt: string, settings: AiSettings) => {
    setIsAiLoading(true);
    try {
      const suggestedTables = await suggestSchema(prompt, settings);
      processAiNodes(suggestedTables);
    } catch (e) {
      console.error(e);
      alert("Failed to generate schema.");
    } finally {
      setIsAiLoading(false);
    }
  };
  
  const handleAiGenerateJson = async (req: string, res: string, settings: AiSettings) => {
      setIsAiLoading(true);
      try {
          const tables = await suggestSchemaFromJson(req, res, settings);
          processAiNodes(tables);
      } catch(e) {
          alert('Failed to parse API JSON');
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

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedTableId), [nodes, selectedTableId]);
  
  const generatedFiles = useMemo(() => {
      const files: { name: string; content: string; type: 'migration' | 'model' | 'seeder' | 'controller' }[] = [];
      nodes.forEach(node => {
          // Migration
          files.push({
              name: `create_${node.data.name}_table.php`,
              content: generateMigration(node, nodes, edges),
              type: 'migration'
          });
          // Model
          const modelName = node.data.name.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase()).replace(/\s+/g, '').replace(/_/g, '').replace(/s$/, '');
          files.push({
              name: `${modelName}.php`,
              content: generateModel(node, nodes, edges),
              type: 'model'
          });
          // Seeder
           files.push({
              name: `${modelName}Seeder.php`,
              content: generateSeeder(node),
              type: 'seeder'
          });
          // Controller
          files.push({
              name: `${modelName}Controller.php`,
              content: generateController(node),
              type: 'controller'
          });
      });
      return files;
  }, [nodes, edges]);

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans" ref={ref}>
      <ReactFlowProvider>
        <Sidebar 
            selectedNode={selectedNode} 
            onUpdateTable={handleUpdateTable}
            onClose={() => setSelectedTableId(null)}
        />

        <div className="flex-1 relative h-full">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onPaneClick={onPaneClick}
                onNodeContextMenu={onNodeContextMenu}
                onPaneContextMenu={onPaneContextMenu}
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
                <Panel position="top-center" className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex gap-2 items-center mt-4 flex-wrap justify-center mx-4 animate-in slide-in-from-top-4 duration-500">
                    <button 
                        onClick={() => handleAddTable()}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-indigo-500/30"
                    >
                        <Plus size={16} />
                        New Table
                    </button>
                    
                    <button 
                        onClick={handleLayout}
                        className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Auto Layout"
                    >
                        <Layout size={20} />
                    </button>
                    
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
                    
                    <button 
                        onClick={() => setShowAiModal(true)}
                         className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-purple-500/30"
                    >
                        <Sparkles size={16} />
                        AI Architect
                    </button>

                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />

                    <button 
                        onClick={() => setShowCodePreview(true)}
                        className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Open IDE"
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
                
                {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} onEdit={(id) => setSelectedTableId(id)} onDelete={handleDeleteTable} onDuplicate={handleDuplicateTable} onAddTable={handleAddTable} onLayout={handleLayout} />}
            </ReactFlow>
        </div>

        {/* IDE Modal */}
        {showCodePreview && (
             <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                 <div className="bg-[#1e1e1e] w-full max-w-6xl h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-[#333]">
                     <div className="flex items-center justify-between p-3 border-b border-[#333] bg-[#252526]">
                         <div className="flex items-center gap-2">
                             <div className="flex gap-2 ml-2">
                                <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                                <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                             </div>
                             <span className="ml-4 text-xs font-semibold text-slate-400">LaraSchema - Project Workspace</span>
                         </div>
                         <button onClick={() => setShowCodePreview(false)} className="text-slate-400 hover:text-white transition-colors">
                             <X size={18} />
                         </button>
                     </div>
                     <div className="flex-1 overflow-hidden">
                        {nodes.length > 0 ? (
                            <CodeViewer files={generatedFiles} onClose={() => setShowCodePreview(false)} />
                        ) : (
                             <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                 <Code size={48} className="mb-4 opacity-50" />
                                 <p>No code generated yet. Add tables or use AI to start.</p>
                             </div>
                        )}
                     </div>
                 </div>
             </div>
        )}
        
        {/* AI Assistant Modal */}
        {showAiModal && (
            <AiAssistantModal 
                onClose={() => setShowAiModal(false)}
                onGenerateText={handleAiGenerateText}
                onGenerateJson={handleAiGenerateJson}
                isLoading={isAiLoading}
            />
        )}
      </ReactFlowProvider>
    </div>
  );
}