import { Node, Edge } from "reactflow";
import { TableData, Column, LaravelColumnType } from "../types";

export const generateMigration = (
  node: Node<TableData>, 
  allNodes: Node<TableData>[], 
  allEdges: Edge[]
): string => {
  const table = node.data;
  const className = `Create${toPascalCase(table.name)}Table`;

  // Filter edges where this table is the source (i.e., this table has the FK column)
  const outgoingEdges = allEdges.filter(e => e.source === node.id);

  const columnLines = table.columns.map(col => {
    return generateColumnLine(col, outgoingEdges, allNodes);
  }).join('\n');
  
  const softDeletes = table.softDeletes ? `            $table->softDeletes();\n` : '';
  const timestamps = table.timestamps ? `            $table->timestamps();\n` : '';

  return `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('${table.name}', function (Blueprint $table) {
${columnLines}
${timestamps}${softDeletes}        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('${table.name}');
    }
};`;
};

const generateColumnLine = (
  col: Column, 
  outgoingEdges: Edge[], 
  allNodes: Node<TableData>[]
): string => {
  if (col.type === LaravelColumnType.ID) {
    return `            $table->id();`;
  }

  // Check if there is an edge connected to this column source handle
  const edge = outgoingEdges.find(e => e.sourceHandle === `src-${col.id}`);
  
  let line = `            $table->${col.type}('${col.name}'`;

  // Arguments for specific types
  if (col.type === LaravelColumnType.DECIMAL) {
     line += `, 8, 2`; // Default precision
  } else if (col.type === LaravelColumnType.STRING && col.length) {
     line += `, ${col.length}`;
  }
  
  line += `)`;

  if (col.nullable) line += `->nullable()`;
  if (col.unique) line += `->unique()`;
  if (col.default !== undefined && col.default !== '') {
      const isNum = !isNaN(Number(col.default)) && col.type !== LaravelColumnType.STRING;
      line += `->default(${isNum ? col.default : `'${col.default}'`})`;
  }
  if (col.index) line += `->index()`;
  if (col.unsigned) line += `->unsigned()`;
  if (col.comment) line += `->comment('${col.comment}')`;

  // Relationship Constraint
  if (edge) {
    // Find target table
    const targetNode = allNodes.find(n => n.id === edge.target);
    // Find target column (usually id, but could be others)
    const targetCol = targetNode?.data.columns.find(c => `tgt-${c.id}` === edge.targetHandle);
    
    if (targetNode) {
        if (targetCol && targetCol.name !== 'id') {
             // Custom FK column on target
             line += `->constrained(table: '${targetNode.data.name}', column: '${targetCol.name}')`;
        } else {
             // Standard FK (assumes target PK is id)
             line += `->constrained('${targetNode.data.name}')`;
        }

        // OnDelete / OnUpdate logic could be added here if we stored it in edge data
        line += `->cascadeOnDelete()`; 
    }
  } else if (col.type === LaravelColumnType.FOREIGN_ID) {
      // Fallback: inferred from name if no explicit edge
      // e.g., user_id -> users
      const inferredTable = col.name.replace(/_id$/, 's'); 
      if (inferredTable !== col.name) {
          line += `->constrained('${inferredTable}')`;
      }
  }

  line += `;`;
  return line;
};

const toPascalCase = (str: string) => {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => word.toUpperCase())
    .replace(/\s+/g, '')
    .replace(/_/g, '');
}