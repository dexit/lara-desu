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

const PHP_HEADER = `<?php

declare(strict_types=1);

`;

// --- Migration Generator ---

export const generateMigration = (
  node: Node<TableData>, 
  allNodes: Node<TableData>[], 
  allEdges: Edge[]
): string => {
  const table = node.data;
  
  const outgoingEdges = allEdges.filter(e => e.source === node.id);

  // Normalize handle ID for checking connections
  const checkEdgeConnection = (colId: string) => {
      return outgoingEdges.find(e => {
          const cleanSource = e.sourceHandle?.replace(/^(src-|tgt-)/, '').replace(/-(r|l)$/, '');
          return cleanSource === colId;
      });
  }

  const columnLines = table.columns.map(col => {
    return generateColumnLine(col, checkEdgeConnection(col.id), allNodes);
  }).join('\n');
  
  const softDeletes = table.softDeletes ? `            $table->softDeletes();\n` : '';
  const timestamps = table.timestamps ? `            $table->timestamps();\n` : '';

  return `${PHP_HEADER}use Illuminate\\Database\\Migrations\\Migration;
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
  edge: Edge | undefined, 
  allNodes: Node<TableData>[]
): string => {
  if (col.type === LaravelColumnType.ID) {
    return `            $table->id();`;
  }

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
      if (col.default === 'CURRENT_TIMESTAMP') {
          line += `->useCurrent()`;
      } else {
          const isNum = !isNaN(Number(col.default)) && col.type !== LaravelColumnType.STRING;
          line += `->default(${isNum ? col.default : `'${col.default}'`})`;
      }
  }
  if (col.index) line += `->index()`;
  if (col.unsigned) line += `->unsigned()`;
  if (col.comment) line += `->comment('${col.comment}')`;

  // Relationship Constraint
  if (edge) {
    const targetNode = allNodes.find(n => n.id === edge.target);
    if (targetNode) {
        // Attempt to find the specific column connected to
        const cleanTargetHandle = edge.targetHandle?.replace(/^(src-|tgt-)/, '').replace(/-(r|l)$/, '');
        const targetCol = targetNode.data.columns.find(c => c.id === cleanTargetHandle);

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
            // Default to cascade if implied by relationship tool
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
      // Auto-infer if not connected explicitly
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
    // Clean edge source handling
    const outgoingEdges = allEdges.filter(e => e.source === node.id);
    const belongsToMethods = outgoingEdges.map(edge => {
        const targetNode = allNodes.find(n => n.id === edge.target);
        if(!targetNode) return '';
        const targetModel = getModelName(targetNode.data.name);
        
        const cleanSourceHandle = edge.sourceHandle?.replace(/^(src-|tgt-)/, '').replace(/-(r|l)$/, '');
        const col = table.columns.find(c => c.id === cleanSourceHandle);
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
        const cleanSourceHandle = edge.sourceHandle?.replace(/^(src-|tgt-)/, '').replace(/-(r|l)$/, '');
        const sourceCol = sourceNode.data.columns.find(c => c.id === cleanSourceHandle);
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

    return `${PHP_HEADER}namespace App\\Models;

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
    
    return `${PHP_HEADER}namespace Database\\Seeders;

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

    return `${PHP_HEADER}namespace Database\\Factories;

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

    return `${PHP_HEADER}namespace App\\Http\\Requests;

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

    return `${PHP_HEADER}namespace App\\Http\\Requests;

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

    return `${PHP_HEADER}namespace App\\Http\\Resources;

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

    return `${PHP_HEADER}use Illuminate\\Support\\Facades\\Route;

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
    
    return `${PHP_HEADER}namespace App\\Http\\Controllers;

use App\\Models\\${modelName};
use App\\Http\\Requests\\Store${modelName}Request;
use App\\Http\\Requests\\Update${modelName}Request;
use App\\Http\\Resources\\${modelName}Resource;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Http\\Resources\\Json\\AnonymousResourceCollection;
use Illuminate\\Http\\Response;

class ${modelName}Controller extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return ${modelName}Resource::collection(${modelName}::paginate());
    }

    public function store(Store${modelName}Request $request): ${modelName}Resource
    {
        return DB::transaction(function () use ($request) {
            $model = ${modelName}::create($request->validated());
            return new ${modelName}Resource($model);
        });
    }

    public function show(${modelName} $${table.name.replace(/s$/,'')}): ${modelName}Resource
    {
        return new ${modelName}Resource($${table.name.replace(/s$/,'')});
    }

    public function update(Update${modelName}Request $request, ${modelName} $${table.name.replace(/s$/,'')}): ${modelName}Resource
    {
        return DB::transaction(function () use ($${table.name.replace(/s$/,'')}, $request) {
            $${table.name.replace(/s$/,'')}->update($request->validated());
            return new ${modelName}Resource($${table.name.replace(/s$/,'')});
        });
    }

    public function destroy(${modelName} $${table.name.replace(/s$/,'')}): Response
    {
        DB::transaction(function () use ($${table.name.replace(/s$/,'')}) {
            $${table.name.replace(/s$/,'')}->delete();
        });
        
        return response()->noContent();
    }
}
`;
}

// --- Composer Generator ---
export const generateComposerJson = (nodes: Node<TableData>[]): string => {
    return `{
    "name": "laravel/laravel",
    "type": "project",
    "description": "The skeleton application for the Laravel framework.",
    "keywords": ["laravel", "framework"],
    "license": "MIT",
    "require": {
        "php": "^8.2",
        "laravel/framework": "^11.0",
        "laravel/tinker": "^2.9",
        "doctrine/dbal": "^3.0"
    },
    "require-dev": {
        "fakerphp/faker": "^1.23",
        "laravel/pint": "^1.13",
        "laravel/sail": "^1.26",
        "mockery/mockery": "^1.6",
        "nunomaduro/collision": "^8.0",
        "phpunit/phpunit": "^10.5",
        "spatie/laravel-ignition": "^2.4"
    },
    "autoload": {
        "psr-4": {
            "App\\\\": "app/",
            "Database\\\\Factories\\\\": "database/factories/",
            "Database\\\\Seeders\\\\": "database/seeders/"
        }
    },
    "autoload-dev": {
        "psr-4": {
            "Tests\\\\": "tests/"
        }
    },
    "scripts": {
        "post-autoload-dump": [
            "Illuminate\\\\Foundation\\\\ComposerScripts::postAutoloadDump",
            "@php artisan package:discover --ansi"
        ],
        "post-update-cmd": [
            "@php artisan vendor:publish --tag=laravel-assets --ansi --force"
        ]
    },
    "extra": {
        "laravel": {
            "dont-discover": []
        }
    },
    "config": {
        "optimize-autoloader": true,
        "preferred-install": "dist",
        "sort-packages": true,
        "allow-plugins": {
            "pestphp/pest-plugin": true,
            "php-http/discovery": true
        }
    },
    "minimum-stability": "stable",
    "prefer-stable": true
}
`;
}

export const generateReadme = (nodes: Node<TableData>[]): string => {
    const tableList = nodes.map(n => `- ${n.data.name}`).join('\n');
    return `# Laravel Application Schema

Generated by LaraSchema Architect.

## Database Structure

This application contains ${nodes.length} tables:

${tableList}

## Installation

1. Clone the repository
2. Run \`composer install\`
3. Run \`php artisan migrate\`
4. Run \`php artisan db:seed\`

## Features

- **Models**: Full Eloquent models with strict typing.
- **API**: Full REST API controllers and resources.
- **Tests**: Factories included for robust testing.
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

// --- ZIP Structure Helper ---
export const prepareZipData = (nodes: Node<TableData>[], edges: Edge[]) => {
    const files: Record<string, string> = {};
    
    // Config
    files['composer.json'] = generateComposerJson(nodes);
    files['README.md'] = generateReadme(nodes);
    files['routes/api.php'] = generateApiRoutes(nodes);
    
    // Code
    nodes.forEach(node => {
        const modelName = getModelName(node.data.name);
        
        // Migrations: Add timestamp prefix for valid migration order
        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
        // Add random seconds to ensure uniqueness in zip
        const uniqueTs = parseInt(timestamp) + Math.floor(Math.random() * 1000);
        files[`database/migrations/${uniqueTs}_create_${node.data.name}_table.php`] = generateMigration(node, nodes, edges);
        
        files[`app/Models/${modelName}.php`] = generateModel(node, nodes, edges);
        files[`app/Http/Controllers/${modelName}Controller.php`] = generateController(node);
        files[`app/Http/Requests/Store${modelName}Request.php`] = generateStoreRequest(node);
        files[`app/Http/Requests/Update${modelName}Request.php`] = generateUpdateRequest(node);
        files[`app/Http/Resources/${modelName}Resource.php`] = generateResource(node);
        files[`database/seeders/${modelName}Seeder.php`] = generateSeeder(node);
        files[`database/factories/${modelName}Factory.php`] = generateFactory(node);
        files[`resources/js/types/${modelName}.ts`] = generateTypeScript(node);
    });

    return files;
};