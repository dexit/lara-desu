
import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
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
  MarkerType,
  ConnectionMode,
} from 'reactflow';
import JSZip from 'jszip';
import saveAs from 'file-saver';
import TableNode from './TableNode';
import Sidebar from './Sidebar';
import ContextMenu from './ContextMenu';
import CodeViewer from './CodeViewer';
import AiAssistantModal from './AiAssistantModal';
import RelationshipModal from './RelationshipModal';
import ProjectSettingsModal from './ProjectSettingsModal';
import { ToastContainer, ToastMessage, ToastType } from './Toast';
import { TableData, LaravelColumnType, AiSettings, Column, ProjectSettings, SchemaState } from '../types';
import { 
    prepareZipData
} from '../services/laravelExporter';
import { suggestSchema, suggestSchemaFromJson } from '../services/geminiService';
import { getLayoutedElements } from '../services/layout';
import { 
    Code, Download, Plus, Sparkles, X, Share2, Layout, Layers, FileArchive, Settings, 
    Save, Clock, RotateCcw, Pen, Check
} from 'lucide-react';

const nodeTypes = {
  table: TableNode,
};

const STORAGE_KEY = 'lara-schema-v1-state';

// Helper to create a new unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

export default function Editor() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [projectTitle, setProjectTitle] = useState('My Laravel Project');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  
  // Storage & Feedback State
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const [projectSettings, setProjectSettings] = useState<ProjectSettings>({
      frontend: {
          stack: 'blade',
          installJetstream: false,
      },
      authentication: {
          breeze: true,
          socialite: false,
      },
      saas: {
          filamentAdmin: false,
          cashier: false,
          tenancy: false,
      },
      api: {
        rateLimitRequests: 60,
        rateLimitPeriod: 1,
        generateDtos: false,
        generateApiResources: false,
        generateDocs: false,
      },
      devTools: {
        telescope: false,
        horizon: false,
        debugbar: false,
      },
      testing: {
        pest: true,
        dusk: false,
      },
      packages: {
          sanctum: true,
          spatiePermissions: false,
          spatieActivityLog: false,
          spatieMediaLibrary: false,
          spatieBackup: false,
          spatieSluggable: false,
          spatieHealth: false,
          spatieWebhookClient: false,
          spatieWebhookServer: false,
      }
  });

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  const [showCodePreview, setShowCodePreview] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Relationship Modal State
  const [relationshipWizard, setRelationshipWizard] = useState<{ sourceId: string, targetId: string } | null>(null);

  const [menu, setMenu] = useState<{ id: string; top: number; left: number; right: number; bottom: number; type: 'node' | 'edge' | 'pane' } | null>(null);
  
  const ref = useRef<HTMLDivElement>(null);

  // --- Toast Helper ---
  const addToast = (type: ToastType, message: string) => {
      const id = generateId();
      setToasts(prev => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
      setToasts(prev => prev.filter(t => t.id !== id));
  };

  // -- State Persistence --
  useEffect(() => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
          try {
              const parsed: SchemaState = JSON.parse(saved);
              setNodes(parsed.nodes || []);
              setEdges(parsed.edges || []);
              if (parsed.settings) setProjectSettings(parsed.settings);
              if (parsed.projectTitle) setProjectTitle(parsed.projectTitle);
              setLastSaved(new Date());
              addToast('success', 'Project restored from last session');
          } catch(e) {
              console.error('Failed to load state', e);
          }
      }
  }, []);

  // Debounced Save
  useEffect(() => {
      if (nodes.length === 0 && edges.length === 0) return;

      setSaveStatus('saving');
      const timer = setTimeout(() => {
          const state: SchemaState = {
              projectTitle,
              nodes,
              edges,
              settings: projectSettings
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          setSaveStatus('saved');
          setLastSaved(new Date());
      }, 1000); // 1s debounce

      return () => clearTimeout(timer);
  }, [nodes, edges, projectSettings, projectTitle]);

  // --- Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            exportProject();
            addToast('success', 'Project exported to JSON');
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, projectTitle]);


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
      addToast('info', 'Relationship connected');
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
                  onDelete: config.cascade ? 'cascade' : 'restrict'
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
                   onDelete: config.cascade ? 'cascade' : 'restrict'
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
      addToast('success', `${type} relationship created`);
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
      addToast('success', 'Core tables added');
  };

  const handleAddSpatieTables = () => {
    // Check if user table exists, to position tables relative to it.
    const userNode = nodes.find(n => n.data.name === 'users');
    const basePos = userNode?.position || { x: 100, y: 100 };

    const spatieTables: TableData[] = [
        { name: 'roles', columns: [ {id: generateId(), name: 'id', type: LaravelColumnType.ID, nullable: false, unique: false}, {id: generateId(), name: 'name', type: LaravelColumnType.STRING, nullable: false, unique: true}, {id: generateId(), name: 'guard_name', type: LaravelColumnType.STRING, nullable: false, unique: true} ], timestamps: true, softDeletes: false, color: '#f5f3ff' },
        { name: 'permissions', columns: [ {id: generateId(), name: 'id', type: LaravelColumnType.ID, nullable: false, unique: false}, {id: generateId(), name: 'name', type: LaravelColumnType.STRING, nullable: false, unique: true}, {id: generateId(), name: 'guard_name', type: LaravelColumnType.STRING, nullable: false, unique: true} ], timestamps: true, softDeletes: false, color: '#f5f3ff' },
        { name: 'model_has_permissions', columns: [ {id: generateId(), name: 'permission_id', type: LaravelColumnType.FOREIGN_ID, nullable: false, unique: false}, {id: generateId(), name: 'model_type', type: LaravelColumnType.STRING, nullable: false, unique: false}, {id: generateId(), name: 'model_id', type: LaravelColumnType.BIG_INTEGER, nullable: false, unique: false, unsigned: true} ], timestamps: false, softDeletes: false, color: '#f0fdf4' },
        { name: 'model_has_roles', columns: [ {id: generateId(), name: 'role_id', type: LaravelColumnType.FOREIGN_ID, nullable: false, unique: false}, {id: generateId(), name: 'model_type', type: LaravelColumnType.STRING, nullable: false, unique: false}, {id: generateId(), name: 'model_id', type: LaravelColumnType.BIG_INTEGER, nullable: false, unique: false, unsigned: true} ], timestamps: false, softDeletes: false, color: '#f0fdf4' },
        { name: 'role_has_permissions', columns: [ {id: generateId(), name: 'permission_id', type: LaravelColumnType.FOREIGN_ID, nullable: false, unique: false}, {id: generateId(), name: 'role_id', type: LaravelColumnType.FOREIGN_ID, nullable: false, unique: false} ], timestamps: false, softDeletes: false, color: '#f0fdf4' },
    ];
    
    const newNodes: Node[] = spatieTables.map((t, idx) => ({
        id: t.name, // Use name as ID for easy linking
        type: 'table',
        position: { x: basePos.x + 350, y: basePos.y + (idx * 200) },
        data: { ...t, onEdit: setSelectedTableId, onDelete: handleDeleteTable }
    }));

    setNodes(nds => [...nds, ...newNodes]);
    
    // Add edges automatically (simplified)
    const newEdges = [
        { id: 'e-mhr-roles', source: 'model_has_roles', sourceHandle: `src-${newNodes[3].data.columns[0].id}`, target: 'roles', targetHandle: `tgt-${newNodes[0].data.columns[0].id}` },
        { id: 'e-rhp-roles', source: 'role_has_permissions', sourceHandle: `src-${newNodes[4].data.columns[1].id}`, target: 'roles', targetHandle: `tgt-${newNodes[0].data.columns[0].id}` },
        { id: 'e-rhp-permissions', source: 'role_has_permissions', sourceHandle: `src-${newNodes[4].data.columns[0].id}`, target: 'permissions', targetHandle: `tgt-${newNodes[1].data.columns[0].id}` },
    ];
    
    // @ts-ignore
    setEdges(eds => [...eds, ...newEdges]);
    addToast('success', 'Spatie Permission tables configured');
  };

  const handleSettingsChange = (newSettings: ProjectSettings) => {
    // If spatie permissions was just turned on, offer to add tables
    if (newSettings.packages.spatiePermissions && !projectSettings.packages.spatiePermissions) {
        if(confirm("Spatie Permissions enabled. Do you want to add the required roles and permissions tables to the canvas?")) {
            handleAddSpatieTables();
        }
    }
    // If breeze was just turned on, and there's no users table, add core tables
    if (newSettings.authentication.breeze && !projectSettings.authentication.breeze) {
        const userTableExists = nodes.some(n => n.data.name === 'users');
        if (!userTableExists) {
            if(confirm("Laravel Breeze enabled. Do you want to add the standard authentication tables (users, password_resets) to the canvas?")) {
                handleAddCoreTables();
            }
        }
    }
    setProjectSettings(newSettings);
    addToast('success', 'Settings saved');
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
      addToast('success', 'Table duplicated');
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
      addToast('success', 'Layout updated');
  }, [nodes, edges, setNodes, setEdges]);
  
  const handleResetCanvas = () => {
      if (confirm('Are you sure you want to clear the entire canvas? This action cannot be undone.')) {
          setNodes([]);
          setEdges([]);
          addToast('info', 'Canvas cleared');
      }
  };

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
      addToast('success', `${suggestedTables.length} tables generated`);
  };

  const handleAiGenerateText = async (prompt: string, settings: AiSettings) => {
    setIsAiLoading(true);
    try {
      const suggestedTables = await suggestSchema(prompt, settings);
      processAiNodes(suggestedTables);
    } catch (e) {
      console.error(e);
      addToast('error', 'Failed to generate schema via AI');
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
           addToast('error', 'Failed to parse API JSON');
      } finally {
          setIsAiLoading(false);
      }
  };

  // Export JSON (Project State)
  const exportProject = () => {
    const data: SchemaState = { projectTitle, nodes, edges, settings: projectSettings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectTitle.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    addToast('success', 'Project exported to JSON');
  };
  
  // Export ZIP (PHP Code)
  const handleDownloadCode = async () => {
      const zip = new JSZip();
      const files = prepareZipData(nodes, edges, projectSettings);
      
      Object.entries(files).forEach(([path, content]) => {
          zip.file(path, content);
      });
      
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${projectTitle.toLowerCase().replace(/\s+/g, '-')}-laravel.zip`);
      addToast('success', 'Laravel application code exported!');
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
            if (json.settings) setProjectSettings(json.settings);
            if (json.projectTitle) setProjectTitle(json.projectTitle);
            addToast('success', 'Project imported successfully');
          } catch (err) {
              addToast('error', 'Invalid file format');
          }
      };
      reader.readAsText(file);
  };

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedTableId), [nodes, selectedTableId]);
  
  const generatedFiles = useMemo(() => {
      if (nodes.length === 0) return [];
      const allFiles = prepareZipData(nodes, edges, projectSettings);

      const getFileType = (path: string): 'migration' | 'model' | 'seeder' | 'controller' | 'config' | 'markdown' => {
          if (path.startsWith('database/migrations')) return 'migration';
          if (path.startsWith('app/Models')) return 'model';
          if (path.startsWith('database/seeders') || path.startsWith('database/factories')) return 'seeder';
          if (path.startsWith('app/Http') || path.startsWith('app/Policies') || path.startsWith('app/Observers')) return 'controller'; // Treat policies/observers as controllers for icon
          if (path.endsWith('.md')) return 'markdown';
          return 'config';
      }

      return Object.entries(allFiles).map(([path, content]) => ({
          name: path.split('/').pop() || path,
          content: content,
          type: getFileType(path)
      }));
  }, [nodes, edges, projectSettings]);

  const sourceNodeForWizard = useMemo(() => nodes.find(n => n.id === relationshipWizard?.sourceId), [nodes, relationshipWizard]);
  const targetNodeForWizard = useMemo(() => nodes.find(n => n.id === relationshipWizard?.targetId), [nodes, relationshipWizard]);

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans" ref={ref}>
      <ReactFlowProvider>
        <Sidebar 
            selectedNode={selectedNode} 
            projectSettings={projectSettings} 
            allNodes={nodes} // Pass all nodes for validation
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
                
                {/* 2026 Style Dynamic Floating Toolbar */}
                <div className="absolute top-4 left-4 right-4 z-40 flex justify-between items-start pointer-events-none">
                    
                    {/* Left: Project Info & Persistence */}
                    <div className="pointer-events-auto bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex gap-4 items-center animate-in slide-in-from-top-4 duration-500">
                        <div className="flex flex-col px-2">
                             <div className="flex items-center gap-2 group">
                                {isEditingTitle ? (
                                    <input 
                                        type="text" 
                                        value={projectTitle} 
                                        onChange={(e) => setProjectTitle(e.target.value)} 
                                        onBlur={() => setIsEditingTitle(false)}
                                        onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                                        autoFocus
                                        className="bg-transparent border-b border-indigo-500 outline-none text-sm font-bold text-slate-800 dark:text-white w-32"
                                    />
                                ) : (
                                    <span 
                                        onClick={() => setIsEditingTitle(true)}
                                        className="text-sm font-bold text-slate-800 dark:text-white cursor-pointer hover:text-indigo-500 transition-colors truncate max-w-[150px]"
                                    >
                                        {projectTitle}
                                    </span>
                                )}
                                {!isEditingTitle && <Pen size={10} className="opacity-0 group-hover:opacity-50 text-slate-400" />}
                             </div>
                             <div className="flex items-center gap-1.5 mt-0.5">
                                 {saveStatus === 'saving' ? (
                                     <>
                                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                                        <span className="text-[10px] text-slate-500 font-medium">Saving...</span>
                                     </>
                                 ) : saveStatus === 'unsaved' ? (
                                     <>
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                        <span className="text-[10px] text-slate-500 font-medium">Unsaved</span>
                                     </>
                                 ) : (
                                     <>
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span className="text-[10px] text-slate-500 font-medium">Saved {lastSaved && `at ${lastSaved.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`}</span>
                                     </>
                                 )}
                             </div>
                        </div>
                    </div>

                    {/* Center: Creation Tools */}
                    <div className="pointer-events-auto bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex gap-2 items-center animate-in slide-in-from-top-4 duration-500 delay-75">
                         <button 
                            onClick={() => handleAddTable()}
                            className="group flex flex-col items-center justify-center w-10 h-10 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all relative"
                            title="New Table"
                        >
                            <Plus size={20} className="text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                        </button>

                         <button 
                            onClick={handleAddCoreTables}
                            className="group flex flex-col items-center justify-center w-10 h-10 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all relative"
                            title="Add Core Tables"
                        >
                            <Layers size={20} className="text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                        </button>
                        
                         <button 
                            onClick={handleLayout}
                            className="group flex flex-col items-center justify-center w-10 h-10 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all relative"
                            title="Auto Layout"
                        >
                            <Layout size={20} className="text-slate-700 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
                        </button>
                        
                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

                        <button 
                            onClick={() => setShowAiModal(true)}
                             className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40"
                        >
                            <Sparkles size={16} />
                            <span>AI Architect</span>
                        </button>
                    </div>

                    {/* Right: System & Actions */}
                    <div className="pointer-events-auto bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex gap-2 items-center animate-in slide-in-from-top-4 duration-500 delay-150">
                        <button 
                            onClick={() => setShowSettingsModal(true)}
                            className="w-9 h-9 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                            title="Project Settings"
                        >
                            <Settings size={18} />
                        </button>
                        
                         <button 
                            onClick={handleResetCanvas}
                            className="w-9 h-9 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                            title="Reset Canvas"
                        >
                            <RotateCcw size={18} />
                        </button>

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

                         <button 
                            onClick={() => setShowCodePreview(true)}
                            className="w-9 h-9 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                            title="Open Code Viewer"
                        >
                            <Code size={18} />
                        </button>

                         <button 
                            onClick={exportProject}
                            className="w-9 h-9 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                            title="Export JSON State"
                        >
                            <Download size={18} />
                        </button>
                         <label className="w-9 h-9 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl cursor-pointer transition-colors" title="Import JSON State">
                            <span className="sr-only">Import</span>
                            <Share2 size={18} className="transform rotate-90" />
                            <input type="file" className="hidden" accept=".json" onChange={importProject} />
                        </label>

                        <button 
                            onClick={handleDownloadCode}
                            className="ml-2 flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20"
                            title="Export PHP Code (ZIP)"
                        >
                            <FileArchive size={16} />
                            <span>Export</span>
                        </button>
                    </div>
                </div>
                
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
                             <span className="ml-4 text-xs font-semibold text-slate-400">LaraSchema - {projectTitle}</span>
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

        {/* Project Settings Modal */}
        {showSettingsModal && (
            <ProjectSettingsModal
                settings={projectSettings}
                onClose={() => setShowSettingsModal(false)}
                onSave={handleSettingsChange}
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

        <ToastContainer toasts={toasts} removeToast={removeToast} />
        
      </ReactFlowProvider>
    </div>
  );
}
