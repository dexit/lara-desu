import { Node, Edge } from "reactflow";
import { TableData, Column, LaravelColumnType } from "../types";

// --- Migration Generator ---

export const generateMigration = (
  node: Node<TableData>, 
  allNodes: Node<TableData>[], 
  allEdges: Edge[]
): string => {
  const table = node.data;
  
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

  // Check connection
  const edge = outgoingEdges.find(e => e.sourceHandle === `src-${col.id}`);
  
  let line = `            $table->${col.type}('${col.name}'`;

  if (col.type === LaravelColumnType.DECIMAL) {
     line += `, 8, 2`;
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
    const targetNode = allNodes.find(n => n.id === edge.target);
    const targetCol = targetNode?.data.columns.find(c => `tgt-${c.id}` === edge.targetHandle);
    
    if (targetNode) {
        if (targetCol && targetCol.name !== 'id') {
             line += `->constrained(table: '${targetNode.data.name}', column: '${targetCol.name}')`;
        } else {
             line += `->constrained('${targetNode.data.name}')`;
        }
        line += `->cascadeOnDelete()`; 
    }
  } else if (col.type === LaravelColumnType.FOREIGN_ID) {
      // Auto-infer
      const inferredTable = col.name.replace(/_id$/, 's'); 
      if (inferredTable !== col.name) {
          line += `->constrained('${inferredTable}')`;
      }
  }

  line += `;`;
  return line;
};

// --- Model Generator ---

export const generateModel = (
    node: Node<TableData>,
    allNodes: Node<TableData>[],
    allEdges: Edge[]
): string => {
    const table = node.data;
    const modelName = toPascalCase(table.name).replace(/s$/, ''); // singularize
    
    const fillableCols = table.columns
        .filter(c => c.type !== LaravelColumnType.ID)
        .map(c => `'${c.name}'`)
        .join(',\n        ');

    const casts = table.columns
        .filter(c => ['boolean', 'date', 'datetime', 'timestamp', 'json', 'decimal'].includes(c.type))
        .map(c => `'${c.name}' => '${getCastType(c.type)}'`)
        .join(',\n        ');

    // Relationships
    const outgoingEdges = allEdges.filter(e => e.source === node.id);
    const belongsToMethods = outgoingEdges.map(edge => {
        const targetNode = allNodes.find(n => n.id === edge.target);
        if(!targetNode) return '';
        const targetModel = toPascalCase(targetNode.data.name).replace(/s$/, '');
        const col = table.columns.find(c => `src-${c.id}` === edge.sourceHandle);
        const methodName = col ? col.name.replace(/_id$/, '') : targetModel.toLowerCase();

        return `
    public function ${toCamelCase(methodName)}(): BelongsTo
    {
        return $this->belongsTo(${targetModel}::class);
    }`;
    }).join('\n');

    const incomingEdges = allEdges.filter(e => e.target === node.id);
    const hasManyMethods = incomingEdges.map(edge => {
        const sourceNode = allNodes.find(n => n.id === edge.source);
        if(!sourceNode) return '';
        const sourceModel = toPascalCase(sourceNode.data.name).replace(/s$/, '');
        const methodName = toCamelCase(sourceNode.data.name);

        return `
    public function ${methodName}(): HasMany
    {
        return $this->hasMany(${sourceModel}::class);
    }`;
    }).join('\n');

    return `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
use Illuminate\\Database\\Eloquent\\Model;
use Illuminate\\Database\\Eloquent\\Relations\\BelongsTo;
use Illuminate\\Database\\Eloquent\\Relations\\HasMany;
${table.softDeletes ? 'use Illuminate\\Database\\Eloquent\\SoftDeletes;' : ''}

class ${modelName} extends Model
{
    use HasFactory${table.softDeletes ? ', SoftDeletes' : ''};

    protected $table = '${table.name}';

    protected $fillable = [
        ${fillableCols}
    ];

    protected $casts = [
        ${casts}
    ];
${belongsToMethods}
${hasManyMethods}
}
`;
}

// --- Seeder Generator ---

export const generateSeeder = (node: Node<TableData>): string => {
    const table = node.data;
    const modelName = toPascalCase(table.name).replace(/s$/, '');
    
    return `<?php

namespace Database\\Seeders;

use Illuminate\\Database\\Seeder;
use App\\Models\\${modelName};

class ${modelName}Seeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        ${modelName}::factory()->count(10)->create();
    }
}
`;
}

// --- Controller Generator (Basic CRUD) ---
export const generateController = (node: Node<TableData>): string => {
    const table = node.data;
    const modelName = toPascalCase(table.name).replace(/s$/, '');
    
    return `<?php

namespace App\\Http\\Controllers;

use App\\Models\\${modelName};
use Illuminate\\Http\\Request;

class ${modelName}Controller extends Controller
{
    public function index()
    {
        return ${modelName}::all();
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            // TODO: Add validation rules
        ]);

        return ${modelName}::create($validated);
    }

    public function show(${modelName} $${table.name.replace(/s$/,'')})
    {
        return $${table.name.replace(/s$/,'')};
    }

    public function update(Request $request, ${modelName} $${table.name.replace(/s$/,'')})
    {
        $validated = $request->validate([
            // TODO: Add validation rules
        ]);

        $${table.name.replace(/s$/,'')}->update($validated);

        return $${table.name.replace(/s$/,'')};
    }

    public function destroy(${modelName} $${table.name.replace(/s$/,'')})
    {
        $${table.name.replace(/s$/,'')}->delete();

        return response()->noContent();
    }
}
`;
}

const getCastType = (type: string) => {
    switch(type) {
        case 'boolean': return 'boolean';
        case 'json': return 'array';
        case 'decimal': return 'decimal:2';
        case 'date': return 'date';
        case 'dateTime': return 'datetime';
        case 'timestamp': return 'datetime';
        default: return 'string';
    }
}

const toPascalCase = (str: string) => {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
    .replace(/\s+/g, '')
    .replace(/_/g, '');
}

const toCamelCase = (str: string) => {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}