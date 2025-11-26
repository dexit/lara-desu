
import { Node, Edge } from "reactflow";
import { TableData, Column, LaravelColumnType } from "../types";

// --- Helpers ---

const toPascalCase = (str: string) => {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
    .replace(/\s+/g, '')
    .replace(/_/g, '')
    .replace(/s$/, ''); // Singularize simplistic
}

const toCamelCase = (str: string) => {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

const getModelName = (tableName: string) => toPascalCase(tableName);

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
  
  let line = `            $table->`;
  
  // Handle Special Types
  if (col.type === LaravelColumnType.ENUM && col.enumValues) {
      const values = col.enumValues.split(',').map(v => `'${v.trim()}'`).join(', ');
      line += `enum('${col.name}', [${values}])`;
  } else if (col.type === LaravelColumnType.MORPHS) {
      line += `morphs('${col.name}')`;
  } else if (col.type === LaravelColumnType.DECIMAL) {
       line += `decimal('${col.name}', 10, 2)`;
  } else if (col.type === LaravelColumnType.FLOAT || col.type === LaravelColumnType.DOUBLE) {
       line += `${col.type}('${col.name}')`;
  } else if ((col.type === LaravelColumnType.STRING || col.type === LaravelColumnType.CHAR) && col.length) {
       line += `${col.type}('${col.name}', ${col.length})`;
  } else {
      line += `${col.type}('${col.name}')`;
  }

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
        
        // On Delete
        if (col.onDelete) {
            if (col.onDelete === 'cascade') line += `->cascadeOnDelete()`;
            else if (col.onDelete === 'set null') line += `->nullOnDelete()`;
            else if (col.onDelete === 'restrict') line += `->restrictOnDelete()`;
        } else {
            line += `->cascadeOnDelete()`;
        }
        
        // On Update
        if (col.onUpdate) {
            if (col.onUpdate === 'cascade') line += `->cascadeOnUpdate()`;
            else if (col.onUpdate === 'set null') line += `->nullOnUpdate()`;
            else if (col.onUpdate === 'restrict') line += `->restrictOnUpdate()`;
        }
    }
  } else if (col.type === LaravelColumnType.FOREIGN_ID) {
      // Auto-infer
      const inferredTable = col.name.replace(/_id$/, 's'); 
      if (inferredTable !== col.name) {
          line += `->constrained('${inferredTable}')`;
          
          if (col.onDelete === 'cascade' || !col.onDelete) line += `->cascadeOnDelete()`;
          else if (col.onDelete === 'set null') line += `->nullOnDelete()`;
          else if (col.onDelete === 'restrict') line += `->restrictOnDelete()`;

          if (col.onUpdate === 'cascade') line += `->cascadeOnUpdate()`;
          else if (col.onUpdate === 'set null') line += `->nullOnUpdate()`;
          else if (col.onUpdate === 'restrict') line += `->restrictOnUpdate()`;
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
    const modelName = getModelName(table.name);
    
    const fillableCols = table.columns
        .filter(c => c.type !== LaravelColumnType.ID && c.type !== LaravelColumnType.MORPHS)
        .map(c => `'${c.name}'`)
        .join(',\n        ');

    const casts = table.columns
        .filter(c => ['boolean', 'date', 'datetime', 'timestamp', 'json', 'decimal', 'double', 'float'].includes(c.type))
        .map(c => `'${c.name}' => '${getCastType(c.type)}'`)
        .join(',\n        ');

    // Relationships
    const outgoingEdges = allEdges.filter(e => e.source === node.id);
    const belongsToMethods = outgoingEdges.map(edge => {
        const targetNode = allNodes.find(n => n.id === edge.target);
        if(!targetNode) return '';
        const targetModel = getModelName(targetNode.data.name);
        const col = table.columns.find(c => `src-${c.id}` === edge.sourceHandle);
        const methodName = col ? col.name.replace(/_id$/, '') : targetModel.toLowerCase();

        return `
    /**
     * Get the ${methodName} that owns the ${modelName}.
     */
    public function ${toCamelCase(methodName)}(): BelongsTo
    {
        return $this->belongsTo(${targetModel}::class);
    }`;
    }).join('\n');

    const incomingEdges = allEdges.filter(e => e.target === node.id);
    const hasManyMethods = incomingEdges.map(edge => {
        const sourceNode = allNodes.find(n => n.id === edge.source);
        if(!sourceNode) return '';
        
        // Check if the relationship is One-to-One (source column is unique)
        const sourceCol = sourceNode.data.columns.find(c => `src-${c.id}` === edge.sourceHandle);
        const isOneToOne = sourceCol?.unique;
        
        const sourceModel = getModelName(sourceNode.data.name);
        const methodName = toCamelCase(sourceNode.data.name); 
        // For HasOne, usually singular name
        const finalMethodName = isOneToOne ? methodName.replace(/s$/, '') : methodName;
        const relationClass = isOneToOne ? 'HasOne' : 'HasMany';
        const relationMethod = isOneToOne ? 'hasOne' : 'hasMany';
        const description = isOneToOne ? `Get the ${sourceModel.toLowerCase()} associated with the ${modelName}.` : `Get the ${sourceModel.toLowerCase()}s for the ${modelName}.`;

        return `
    /**
     * ${description}
     */
    public function ${finalMethodName}(): ${relationClass}
    {
        return $this->${relationMethod}(${sourceModel}::class);
    }`;
    }).join('\n');
    
    // Add HasOne import if needed
    const hasOneImport = hasManyMethods.includes('HasOne') ? 'use Illuminate\\Database\\Eloquent\\Relations\\HasOne;' : '';

    return `<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
use Illuminate\\Database\\Eloquent\\Model;
use Illuminate\\Database\\Eloquent\\Relations\\BelongsTo;
use Illuminate\\Database\\Eloquent\\Relations\\HasMany;
${hasOneImport}
${table.softDeletes ? 'use Illuminate\\Database\\Eloquent\\SoftDeletes;' : ''}

class ${modelName} extends Model
{
    /** @use HasFactory<\\Database\\Factories\\${modelName}Factory> */
    use HasFactory${table.softDeletes ? ', SoftDeletes' : ''};

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = '${table.name}';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        ${fillableCols}
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
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
    const modelName = getModelName(table.name);
    
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

// --- Factory Generator ---
export const generateFactory = (node: Node<TableData>): string => {
    const table = node.data;
    const modelName = getModelName(table.name);

    const definitions = table.columns
        .filter(c => c.type !== LaravelColumnType.ID && c.type !== LaravelColumnType.TIMESTAMP && !c.name.endsWith('_at'))
        .map(c => {
             let fakerMethod = `word()`;
             if (c.name.includes('email')) fakerMethod = `unique()->safeEmail()`;
             else if (c.name.includes('name')) fakerMethod = `name()`;
             else if (c.name.includes('address')) fakerMethod = `address()`;
             else if (c.name.includes('phone')) fakerMethod = `phoneNumber()`;
             else if (c.name.includes('image')) fakerMethod = `imageUrl()`;
             else if (c.name.includes('description') || c.type === 'text') fakerMethod = `text()`;
             else if (c.type === 'boolean') fakerMethod = `boolean()`;
             else if (c.type === 'integer' || c.type === 'bigInteger') fakerMethod = `randomNumber()`;
             else if (c.type === 'date') fakerMethod = `date()`;
             else if (c.type === 'dateTime' || c.type === 'timestamp') fakerMethod = `dateTime()`;
             else if (c.type === 'decimal' || c.type === 'float') fakerMethod = `randomFloat(2, 1, 1000)`;
             else if (c.type === 'ipAddress') fakerMethod = `ipv4()`;
             else if (c.type === 'macAddress') fakerMethod = `macAddress()`;
             
             if (c.type === LaravelColumnType.ENUM && c.enumValues) {
                 const opts = c.enumValues.split(',').map(s => s.trim()).filter(Boolean);
                 fakerMethod = `randomElement([${opts.map(o => `'${o}'`).join(', ')}])`;
             }
             
             return `'${c.name}' => $this->faker->${fakerMethod}`;
        }).join(',\n            ');

    return `<?php

namespace Database\\Factories;

use Illuminate\\Database\\Eloquent\\Factories\\Factory;

/**
 * @extends \\Illuminate\\Database\\Eloquent\\Factories\\Factory<\\App\\Models\\${modelName}>
 */
class ${modelName}Factory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            ${definitions}
        ];
    }
}
`;
};

// --- Validation Rules Helper ---
const getValidationRules = (col: Column): string => {
    const rules = [];
    
    // Required / Nullable
    if (col.nullable) rules.push('nullable'); else rules.push('required');
    
    // Type specific
    if (['string', 'text', 'char'].includes(col.type)) rules.push('string');
    if (['integer', 'bigInteger', 'tinyInteger', 'smallInteger'].includes(col.type)) rules.push('integer');
    if (['boolean'].includes(col.type)) rules.push('boolean');
    if (['date', 'dateTime', 'timestamp'].includes(col.type)) rules.push('date');
    if (['decimal', 'float', 'double'].includes(col.type)) rules.push('numeric');
    if (['json'].includes(col.type)) rules.push('array');
    if (['ipAddress'].includes(col.type)) rules.push('ip');
    if (['macAddress'].includes(col.type)) rules.push('mac_address');
    if (['uuid'].includes(col.type)) rules.push('uuid');

    // Content specific
    if (col.name.includes('email')) rules.push('email');
    if (col.type === LaravelColumnType.ENUM && col.enumValues) {
        rules.push(`in:${col.enumValues}`);
    }
    
    // Max Length
    if (col.type === 'string' && col.length) rules.push(`max:${col.length}`);
    else if (col.type === 'string') rules.push('max:255');
    
    return rules.map(r => `'${r}'`).join(', ');
};

// --- Request Generators ---

export const generateStoreRequest = (node: Node<TableData>): string => {
    const table = node.data;
    const modelName = getModelName(table.name);

    const rules = table.columns
        .filter(c => c.type !== LaravelColumnType.ID && c.type !== LaravelColumnType.TIMESTAMP && c.type !== LaravelColumnType.MORPHS && !c.name.endsWith('_at'))
        .map(c => {
             let ruleString = getValidationRules(c);
             if (c.unique) ruleString += `, 'unique:${table.name},${c.name}'`;
             return `'${c.name}' => [${ruleString}]`;
        }).join(',\n            ');

    return `<?php

namespace App\\Http\\Requests;

use Illuminate\\Foundation\\Http\\FormRequest;

class Store${modelName}Request extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \\Illuminate\\Contracts\\Validation\\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ${rules}
        ];
    }
}
`;
};

export const generateUpdateRequest = (node: Node<TableData>): string => {
    const table = node.data;
    const modelName = getModelName(table.name);

    const rules = table.columns
        .filter(c => c.type !== LaravelColumnType.ID && c.type !== LaravelColumnType.TIMESTAMP && c.type !== LaravelColumnType.MORPHS && !c.name.endsWith('_at'))
        .map(c => {
             let ruleString = getValidationRules(c);
             // Unique rule needs ignore for update
             if (c.unique) {
                 // We assume the route parameter is the singular table name
                 const routeParam = table.name.replace(/s$/, ''); 
                 ruleString += `, 'unique:${table.name},${c.name},' . $this->route('${routeParam}')->id`;
             }
             return `'${c.name}' => [${ruleString}]`;
        }).join(',\n            ');

    return `<?php

namespace App\\Http\\Requests;

use Illuminate\\Foundation\\Http\\FormRequest;

class Update${modelName}Request extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \\Illuminate\\Contracts\\Validation\\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ${rules}
        ];
    }
}
`;
};

// --- Resource Generator ---
export const generateResource = (node: Node<TableData>): string => {
    const table = node.data;
    const modelName = getModelName(table.name);
    
    const fields = table.columns.map(c => {
        return `'${c.name}' => $this->${c.name}`;
    }).join(',\n            ');

    return `<?php

namespace App\\Http\\Resources;

use Illuminate\\Http\\Request;
use Illuminate\\Http\\Resources\\Json\\JsonResource;

class ${modelName}Resource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ${fields},
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
`;
};

// --- API Route Generator ---
export const generateApiRoutes = (nodes: Node<TableData>[]): string => {
    const routes = nodes.map(node => {
        const modelName = getModelName(node.data.name);
        return `Route::apiResource('${node.data.name.replace(/_/g, '-')}', App\\Http\\Controllers\\${modelName}Controller::class);`;
    }).join('\n');

    return `<?php

use Illuminate\\Support\\Facades\\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

${routes}
`;
};

// --- TypeScript Interface Generator ---
export const generateTypeScript = (node: Node<TableData>): string => {
    const table = node.data;
    const modelName = getModelName(table.name);

    const fields = table.columns.map(c => {
        let tsType = 'string';
        if (['integer', 'bigInteger', 'tinyInteger', 'float', 'double', 'decimal'].includes(c.type)) tsType = 'number';
        if (c.type === 'boolean') tsType = 'boolean';
        if (c.type === 'json') tsType = 'any[] | Record<string, any>';
        
        return `    ${c.name}${c.nullable ? '?' : ''}: ${tsType};`;
    }).join('\n');

    return `export interface ${modelName} {
    id: number;
${fields}
    created_at?: string;
    updated_at?: string;
    deleted_at?: string | null;
}
`;
}


// --- Controller Generator (Basic CRUD) ---
export const generateController = (node: Node<TableData>): string => {
    const table = node.data;
    const modelName = getModelName(table.name);
    
    return `<?php

namespace App\\Http\\Controllers;

use App\\Models\\${modelName};
use App\\Http\\Requests\\Store${modelName}Request;
use App\\Http\\Requests\\Update${modelName}Request;
use App\\Http\\Resources\\${modelName}Resource;
use Illuminate\\Support\\Facades\\DB;

class ${modelName}Controller extends Controller
{
    public function index()
    {
        return ${modelName}Resource::collection(${modelName}::paginate());
    }

    public function store(Store${modelName}Request $request)
    {
        return DB::transaction(function () use ($request) {
            $model = ${modelName}::create($request->validated());
            return new ${modelName}Resource($model);
        });
    }

    public function show(${modelName} $${table.name.replace(/s$/,'')})
    {
        return new ${modelName}Resource($${table.name.replace(/s$/,'')});
    }

    public function update(Update${modelName}Request $request, ${modelName} $${table.name.replace(/s$/,'')})
    {
        return DB::transaction(function () use ($${table.name.replace(/s$/,'')}, $request) {
            $${table.name.replace(/s$/,'')}->update($request->validated());
            return new ${modelName}Resource($${table.name.replace(/s$/,'')});
        });
    }

    public function destroy(${modelName} $${table.name.replace(/s$/,'')})
    {
        return DB::transaction(function () use ($${table.name.replace(/s$/,'')}) {
            $${table.name.replace(/s$/,'')}->delete();
            return response()->noContent();
        });
    }
}
`;
}

const getCastType = (type: string) => {
    switch(type) {
        case 'boolean': return 'boolean';
        case 'json': return 'array';
        case 'decimal': return 'decimal:2';
        case 'double': return 'double';
        case 'float': return 'float';
        case 'date': return 'date';
        case 'dateTime': return 'datetime';
        case 'timestamp': return 'datetime';
        default: return 'string';
    }
}
