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
import RelationshipModal from './RelationshipModal';
import { TableData, LaravelColumnType, AiSettings, Column } from '../types';
import { 
    generateMigration, 
    generateModel, 
    generateSeeder, 
    generateController, 
    generateFactory, 
    generateStoreRequest, 
    generateUpdateRequest, 
    generateResource, 
    generateTypeScript,
    generateApiRoutes,
    generateComposerJson,
    generateReadme
} from '../services/laravelExporter';
import { suggestSchema, suggestSchemaFromJson } from '../services/geminiService';
import { getLayoutedElements } from '../services/layout';
import { Code, Download, Plus, Sparkles, X, Share2, Layout, Layers } from 'lucide-react';

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
  
  // Relationship Modal State
  const [relationshipWizard, setRelationshipWizard] = useState<{ sourceId: string, targetId: string } | null>(null);

  const [menu, setMenu] = useState<{ id: string; top: number; left: number; right: number; bottom: number; type: 'node' | 'edge' | 'pane' } | null>(null);
  
  const ref = useRef<HTMLDivElement>(null);

  // --- Handlers ---

  const onConnect = useCallback(
    (params: Connection) => {
      // 1. Check if this is a Table-to-Table connection (Header to Header)
      if (params.sourceHandle === 'table-handle' || params.targetHandle === 'table-target') {
          if (params.source && params.target && params.source !== params.target) {
              setRelationshipWizard({ sourceId: params.source, targetId: params.target });
          }
          return;
      }

      // 2. Normal Column-to-Column connection
      if (!params.sourceHandle || !params.targetHandle) return;
      
      // Normalize handle IDs (remove src-, tgt-, -r, -l prefixes/suffixes)
      const cleanSourceId = params.sourceHandle.replace(/^(src-|tgt-)/, '').replace(/-(r|l)$/, '');
      const cleanTargetId = params.targetHandle.replace(/^(src-|tgt-)/, '').replace(/-(r|l)$/, '');

      // Smart Auto-Update for Generic Columns being connected to IDs
      // If user connects 'some_string' -> 'id', assume it's an FK
      setNodes((nds) => {
          return nds.map(node => {
              if (node.id === params.source) {
                  const col = node.data.columns.find((c: Column) => c.id === cleanSourceId);
                  
                  // If connecting a generic string/int to an ID, make it a foreignId
                  if (col && (col.type === LaravelColumnType.STRING || col.type === LaravelColumnType.INTEGER) && !col.name.endsWith('_id')) {
                       // Find target table name to guess FK name
                       const targetNode = nds.find(n => n.id === params.target);
                       if (targetNode) {
                           const newName = `${targetNode.data.name.replace(/s$/, '')}_id`;
                           // Update the column
                           const updatedColumns = node.data.columns.map((c: Column) => {
                               if (c.id === cleanSourceId) {
                                   return { ...c, name: newName, type: LaravelColumnType.FOREIGN_ID, nullable: true };
                               }
                               return c;
                           });
                           return { ...node, data: { ...node.data, columns: updatedColumns }};
                       }
                  }
              }
              return node;
          });
      });

      setEdges((eds) => addEdge({ 
          ...params, 
          animated: true, 
          style: { stroke: '#6366f1', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
          type: 'default'
      }, eds));
    },
    [setEdges, setNodes]
  );
  
  const handleCreateRelationship = (type: '1:1' | '1:N' | 'N:M', config: any) => {
      if (!relationshipWizard) return;
      
      const { sourceId, targetId } = relationshipWizard;
      // Handle Swap Logic
      const isSwapped = config.isSwapped;
      const actualSourceId = isSwapped ? targetId : sourceId;
      const actualTargetId = isSwapped ? sourceId : targetId;

      const sourceNode = nodes.find(n => n.id === actualSourceId);
      const targetNode = nodes.find(n => n.id === actualTargetId);
      
      if (!sourceNode || !targetNode) return;
      
      const newEdges: Edge[] = [];
      const newNodes: Node[] = [];
      
      if (type === '1:N') {
          // Add table_a_id to Table B (Target)
          const fkName = `${sourceNode.data.name.replace(/s$/, '')}_id`;
          const fkId = generateId();
          
          // Check if column already exists
          const exists = targetNode.data.columns.find((c: Column) => c.name === fkName);
          let targetColId = exists?.id;

          if (!exists) {
              const newCol: Column = {
                  id: fkId,
                  name: fkName,
                  type: LaravelColumnType.FOREIGN_ID,
                  nullable: false,
                  unique: false,
                  onDelete: 'cascade'
              };
              
              setNodes(nds => nds.map(n => {
                  if (n.id === actualTargetId) {
                      return { ...n, data: { ...n.data, columns: [...n.data.columns, newCol] }};
                  }
                  return n;
              }));
              targetColId = fkId;
          }

          // Create Edge: Target(FK) -> Source(ID)
          const sourcePkId = sourceNode.data.columns.find((c: Column) => c.type === LaravelColumnType.ID)?.id;
          
          if (targetColId && sourcePkId) {
             setEdges(eds => addEdge({
                 id: `e-${actualTargetId}-${actualSourceId}-${Math.random()}`,
                 source: actualTargetId,
                 sourceHandle: `src-${targetColId}`,
                 target: actualSourceId,
                 targetHandle: `tgt-${sourcePkId}`,
                 animated: true,
                 style: { stroke: '#6366f1', strokeWidth: 2 },
                 markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' }
             }, eds));
          }

      } else if (type === '1:1') {
           // Same as 1:N but unique, usually FK on Target pointing to Source
           const fkName = `${sourceNode.data.name.replace(/s$/, '')}_id`;
           const fkId = generateId();
           
           const exists = targetNode.data.columns.find((c: Column) => c.name === fkName);
           let targetColId = exists?.id;

           if (!exists) {
               const newCol: Column = {
                   id: fkId,
                   name: fkName,
                   type: LaravelColumnType.FOREIGN_ID,
                   nullable: true,
                   unique: true, 
                   onDelete: 'cascade'
               };
               
               setNodes(nds => nds.map(n => {
                  if (n.id === actualTargetId) {
                      return { ...n, data: { ...n.data, columns: [...n.data.columns, newCol] }};
                  }
                  return n;
              }));
              targetColId = fkId;
           }
           
           const sourcePkId = sourceNode.data.columns.find((c: Column) => c.type === LaravelColumnType.ID)?.id;
           
           if (targetColId && sourcePkId) {
              setEdges(eds => addEdge({
                  id: `e-${actualTargetId}-${actualSourceId}-${Math.random()}`,
                  source: actualTargetId,
                  sourceHandle: `src-${targetColId}`,
                  target: actualSourceId,
                  targetHandle: `tgt-${sourcePkId}`,
                  animated: true,
                  style: { stroke: '#6366f1', strokeWidth: 2 },
                  markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' }
              }, eds));
           }

      } else if (type === 'N:M') {
          // Create Pivot Table
          const pivotName = [sourceNode.data.name, targetNode.data.name].sort().map(s => s.replace(/s$/, '')).join('_');
          const pivotId = generateId();
          
          const sourceFkName = `${sourceNode.data.name.replace(/s$/, '')}_id`;
          const targetFkName = `${targetNode.data.name.replace(/s$/, '')}_id`;
          
          const col1Id = generateId();
          const col2Id = generateId();

          const pivotNode: Node = {
              id: pivotId,
              type: 'table',
              // Place it between them
              position: { 
                  x: (sourceNode.position.x + targetNode.position.x) / 2, 
                  y: (sourceNode.position.y + targetNode.position.y) / 2 + 50
              },
              data: {
                  name: pivotName,
                  columns: [
                      { id: generateId(), name: 'id', type: LaravelColumnType.ID, nullable: false, unique: false },
                      { id: col1Id, name: sourceFkName, type: LaravelColumnType.FOREIGN_ID, nullable: false, unique: false, onDelete: 'cascade' },
                      { id: col2Id, name: targetFkName, type: LaravelColumnType.FOREIGN_ID, nullable: false, unique: false, onDelete: 'cascade' }
                  ],
                  timestamps: true,
                  softDeletes: false,
                  color: '#f5f3ff', // Purple for pivot
                  onEdit: (id: string) => { setSelectedTableId(id); setMenu(null); },
                  onDelete: (id: string) => { handleDeleteTable(id); setMenu(null); },
              }
          };
          
          newNodes.push(pivotNode);
          
          const sourcePkId = sourceNode.data.columns.find((c: Column) => c.type === LaravelColumnType.ID)?.id;
          const targetPkId = targetNode.data.columns.find((c: Column) => c.type === LaravelColumnType.ID)?.id;
          
          // Connect Pivot -> Source
          if (sourcePkId) {
               newEdges.push({
                 id: `e-${pivotId}-${actualSourceId}-${Math.random()}`,
                 source: pivotId,
                 sourceHandle: `src-${col1Id}`,
                 target: actualSourceId,
                 targetHandle: `tgt-${sourcePkId}`,
                 animated: true,
                 style: { stroke: '#6366f1', strokeWidth: 2 },
                 markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' }
              });
          }
          
          // Connect Pivot -> Target
          if (targetPkId) {
               newEdges.push({
                 id: `e-${pivotId}-${actualTargetId}-${Math.random()}`,
                 source: pivotId,
                 sourceHandle: `src-${col2Id}`,
                 target: actualTargetId,
                 targetHandle: `tgt-${targetPkId}`,
                 animated: true,
                 style: { stroke: '#6366f1', strokeWidth: 2 },
                 markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' }
              });
          }
          
          setNodes(nds => [...nds, ...newNodes]);
          setEdges(eds => [...eds, ...newEdges]);
      }
      
      setRelationshipWizard(null);
  };

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
  
  const handleAddCoreTables = () => {
      const coreTables: TableData[] = [
          {
              name: 'users',
              columns: [
                  { id: generateId(), name: 'id', type: LaravelColumnType.ID, nullable: false, unique: false },
                  { id: generateId(), name: 'name', type: LaravelColumnType.STRING, nullable: false, unique: false },
                  { id: generateId(), name: 'email', type: LaravelColumnType.STRING, nullable: false, unique: true },
                  { id: generateId(), name: 'email_verified_at', type: LaravelColumnType.TIMESTAMP, nullable: true, unique: false },
                  { id: generateId(), name: 'password', type: LaravelColumnType.STRING, nullable: false, unique: false },
                  { id: generateId(), name: 'remember_token', type: LaravelColumnType.STRING, length: 100, nullable: true, unique: false },
              ],
              timestamps: true,
              softDeletes: false,
              color: '#eef2ff'
          },
          {
              name: 'password_reset_tokens',
              columns: [
                  { id: generateId(), name: 'email', type: LaravelColumnType.STRING, nullable: false, unique: false, index: true }, // Primary key handled differently usually
                  { id: generateId(), name: 'token', type: LaravelColumnType.STRING, nullable: false, unique: false },
                  { id: generateId(), name: 'created_at', type: LaravelColumnType.TIMESTAMP, nullable: true, unique: false },
              ],
              timestamps: false,
              softDeletes: false,
              color: '#fffbeb'
          },
          {
              name: 'failed_jobs',
              columns: [
                   { id: generateId(), name: 'id', type: LaravelColumnType.ID, nullable: false, unique: false },
                   { id: generateId(), name: 'uuid', type: LaravelColumnType.STRING, nullable: false, unique: true },
                   { id: generateId(), name: 'connection', type: LaravelColumnType.TEXT, nullable: false, unique: false },
                   { id: generateId(), name: 'queue', type: LaravelColumnType.TEXT, nullable: false, unique: false },
                   { id: generateId(), name: 'payload', type: LaravelColumnType.LONG_TEXT, nullable: false, unique: false },
                   { id: generateId(), name: 'exception', type: LaravelColumnType.LONG_TEXT, nullable: false, unique: false },
                   { id: generateId(), name: 'failed_at', type: LaravelColumnType.TIMESTAMP, nullable: false, unique: false, default: 'CURRENT_TIMESTAMP' },
              ],
              timestamps: false,
              softDeletes: false,
              color: '#fef2f2'
          },
           {
              name: 'jobs',
              columns: [
                   { id: generateId(), name: 'id', type: LaravelColumnType.ID, nullable: false, unique: false },
                   { id: generateId(), name: 'queue', type: LaravelColumnType.STRING, nullable: false, unique: false, index: true },
                   { id: generateId(), name: 'payload', type: LaravelColumnType.LONG_TEXT, nullable: false, unique: false },
                   { id: generateId(), name: 'attempts', type: LaravelColumnType.TINY_INTEGER, nullable: false, unique: false, unsigned: true },
                   { id: generateId(), name: 'reserved_at', type: LaravelColumnType.INTEGER, nullable: true, unique: false, unsigned: true },
                   { id: generateId(), name: 'available_at', type: LaravelColumnType.INTEGER, nullable: false, unique: false, unsigned: true },
                   { id: generateId(), name: 'created_at', type: LaravelColumnType.INTEGER, nullable: false, unique: false, unsigned: true },
              ],
              timestamps: false,
              softDeletes: false,
              color: '#fef2f2'
          }
      ];

      const newNodes: Node[] = coreTables.map((t, idx) => ({
          id: generateId(),
          type: 'table',
          position: { x: 50 + (idx * 320), y: 100 },
          data: {
              ...t,
              onEdit: (id: string) => setSelectedTableId(id),
              onDelete: (id: string) => handleDeleteTable(id),
          }
      }));

      setNodes(nds => [...nds, ...newNodes]);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const files: { name: string; content: string; type: 'migration' | 'model' | 'seeder' | 'controller' | 'config' | 'markdown' }[] = [];
      
      // Global files
      files.push({
          name: 'composer.json',
          content: generateComposerJson(nodes),
          type: 'config'
      });
      files.push({
          name: 'README.md',
          content: generateReadme(nodes),
          type: 'markdown'
      });
      if(nodes.length > 0) {
          files.push({
              name: 'api.php',
              content: generateApiRoutes(nodes),
              type: 'controller'
          });
      }

      nodes.forEach(node => {
          // Migration
          files.push({
              name: `create_${node.data.name}_table.php`,
              content: generateMigration(node, nodes, edges),
              type: 'migration'
          });
          
          const modelName = node.data.name.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase()).replace(/\s+/g, '').replace(/_/g, '').replace(/s$/, '');
          
          // Model
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
          // Factory
           files.push({
              name: `${modelName}Factory.php`,
              content: generateFactory(node),
              type: 'seeder'
          });
          // Controller
          files.push({
              name: `${modelName}Controller.php`,
              content: generateController(node),
              type: 'controller'
          });
          // Form Requests
          files.push({
              name: `Store${modelName}Request.php`,
              content: generateStoreRequest(node),
              type: 'controller'
          });
          files.push({
              name: `Update${modelName}Request.php`,
              content: generateUpdateRequest(node),
              type: 'controller'
          });
          // Resources
           files.push({
              name: `${modelName}Resource.php`,
              content: generateResource(node),
              type: 'controller'
          });
           // TypeScript Types
           files.push({
              name: `${modelName}.ts`,
              content: generateTypeScript(node),
              type: 'model'
          });
      });
      return files;
  }, [nodes, edges]);

  const sourceNodeForWizard = useMemo(() => nodes.find(n => n.id === relationshipWizard?.sourceId), [nodes, relationshipWizard]);
  const targetNodeForWizard = useMemo(() => nodes.find(n => n.id === relationshipWizard?.targetId), [nodes, relationshipWizard]);

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
                <MiniMap style={{background: '#1e293b'}} nodeColor={(n) => n.data.color || '#6366f1'} />
                
                {/* Top Toolbar */}
                <Panel position="top-center" className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex gap-2 items-center mt-4 flex-wrap justify-center mx-4 animate-in slide-in-from-top-4 duration-500 z-40">
                    <button 
                        onClick={() => handleAddTable()}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-indigo-500/30"
                    >
                        <Plus size={16} />
                        New Table
                    </button>

                     <button 
                        onClick={handleAddCoreTables}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl text-sm font-bold transition-all"
                    >
                        <Layers size={16} />
                        Add Core Tables
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
        
        {/* Relationship Wizard */}
        {relationshipWizard && sourceNodeForWizard && targetNodeForWizard && (
            <RelationshipModal 
                sourceNode={sourceNodeForWizard}
                targetNode={targetNodeForWizard}
                onClose={() => setRelationshipWizard(null)}
                onSubmit={handleCreateRelationship}
            />
        )}
        
      </ReactFlowProvider>
    </div>
  );
}