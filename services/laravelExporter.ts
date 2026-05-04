
import { Node, Edge } from "reactflow";
import { TableData, Column, LaravelColumnType, ProjectSettings } from "../types";

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
const getVariableName = (tableName: string) => toCamelCase(getModelName(tableName)).toLowerCase();

const PHP_HEADER = `<?php

declare(strict_types=1);

`;

/**
 * Maps a column to its Eloquent cast type.
 */
const getCastType = (col: Column): string => {
    if (col.name === 'password') {
        return 'hashed';
    }
    
    if (col.name === 'payload' || col.type === LaravelColumnType.JSON) {
        return 'array';
    }
    
    switch (col.type) {
        case LaravelColumnType.BOOLEAN:
            return 'boolean';
        case LaravelColumnType.DECIMAL:
            return 'decimal:2';
        case LaravelColumnType.DATE:
            return 'date';
        case LaravelColumnType.DATETIME:
        case LaravelColumnType.TIMESTAMP:
            return 'datetime';
        case LaravelColumnType.FLOAT:
        case LaravelColumnType.DOUBLE:
            return 'float';
        case LaravelColumnType.INTEGER:
        case LaravelColumnType.BIG_INTEGER:
        case LaravelColumnType.TINY_INTEGER:
        case LaravelColumnType.SMALL_INTEGER:
        case LaravelColumnType.MEDIUM_INTEGER:
            return 'integer';
        case LaravelColumnType.JSON:
             return 'array';
        default:
            return 'string';
    }
};

// --- Migration Generator ---

export const generateMigration = (
  node: Node<TableData>, 
  allNodes: Node<TableData>[], 
  allEdges: Edge[]
): string => {
  const table = node.data;
  
  const outgoingEdges = allEdges.filter(e => e.source === node.id);

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

  if (edge) {
    const targetNode = allNodes.find(n => n.id === edge.target);
    if (targetNode) {
        const cleanTargetHandle = edge.targetHandle?.replace(/^(src-|tgt-)/, '').replace(/-(r|l)$/, '');
        const targetCol = targetNode.data.columns.find(c => c.id === cleanTargetHandle);

        if (targetCol && targetCol.name !== 'id') {
             line += `->constrained(table: '${targetNode.data.name}', column: '${targetCol.name}')`;
        } else {
             line += `->constrained('${targetNode.data.name}')`;
        }
        
        if (col.onDelete) {
            if (col.onDelete === 'cascade') line += `->cascadeOnDelete()`;
            else if (col.onDelete === 'set null') line += `->nullOnDelete()`;
            else if (col.onDelete === 'restrict') line += `->restrictOnDelete()`;
        } else {
            line += `->cascadeOnDelete()`;
        }
        
        if (col.onUpdate) {
            if (col.onUpdate === 'cascade') line += `->cascadeOnUpdate()`;
            else if (col.onUpdate === 'set null') line += `->nullOnUpdate()`;
            else if (col.onUpdate === 'restrict') line += `->restrictOnUpdate()`;
        }
    }
  } else if (col.type === LaravelColumnType.FOREIGN_ID) {
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
    allEdges: Edge[],
    projectSettings: ProjectSettings
): string => {
    const table = node.data;
    const modelName = getModelName(table.name);
    const isUser = table.name === 'users';
    
    let uses = [ 'use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;' ];
    let traits = [ 'HasFactory' ];
    let interfaces: string[] = [];
    let extraMethods: string[] = [];
    
    // -- Soft Deletes --
    if (table.softDeletes) {
        uses.push('use Illuminate\\Database\\Eloquent\\SoftDeletes;');
        traits.push('SoftDeletes');
    }
    
    // -- Authentication --
    if (projectSettings.authentication.breeze || projectSettings.packages.sanctum) {
        if(isUser) {
          uses.push('use Laravel\\Sanctum\\HasApiTokens;');
          traits.push('HasApiTokens');
        }
    }

    // -- Spatie Packages Integration --

    // 1. Sluggable
    if (projectSettings.packages.spatieSluggable && table.generateSlug) {
        uses.push('use Spatie\\Sluggable\\HasSlug;');
        uses.push('use Spatie\\Sluggable\\SlugOptions;');
        traits.push('HasSlug');
        extraMethods.push(`
    /**
     * Get the options for generating the slug.
     */
    public function getSlugOptions(): SlugOptions
    {
        return SlugOptions::create()
            ->generateSlugsFrom('name')
            ->saveSlugsTo('slug');
    }`);
    }

    // 2. Activity Log
    if (projectSettings.packages.spatieActivityLog) {
        uses.push('use Spatie\\Activitylog\\Traits\\LogsActivity;');
        uses.push('use Spatie\\Activitylog\\LogOptions;');
        traits.push('LogsActivity');
        extraMethods.push(`
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
        ->logOnly(['*']);
    }`);
    }

    // 3. Media Library
    if (projectSettings.packages.spatieMediaLibrary) {
        uses.push('use Spatie\\MediaLibrary\\HasMedia;');
        uses.push('use Spatie\\MediaLibrary\\InteractsWithMedia;');
        interfaces.push('HasMedia');
        traits.push('InteractsWithMedia');
    }

    // -- Inheritance --
    const extendsClass = isUser ? 'Authenticatable' : 'Model';
    if(isUser) {
        uses.push('use Illuminate\\Foundation\\Auth\\User as Authenticatable;');
    } else {
        uses.push('use Illuminate\\Database\\Eloquent\\Model;');
    }

    const fillableCols = table.columns
        .filter(c => c.type !== LaravelColumnType.ID && c.type !== LaravelColumnType.MORPHS)
        .map(c => `'${c.name}'`)
        .join(',\n        ');

    const casts = table.columns
        .filter(c => ['boolean', 'date', 'datetime', 'timestamp', 'json', 'decimal', 'double', 'float', 'tinyInteger', 'integer'].includes(c.type) || c.name === 'payload' || c.name === 'password')
        .map(c => `'${c.name}' => '${getCastType(c)}'`)
        .join(',\n        ');

    // -- Relationships --
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
    const hasManyMethodsArr = incomingEdges.map(edge => {
        const sourceNode = allNodes.find(n => n.id === edge.source);
        if(!sourceNode) return '';
        const cleanSourceHandle = edge.sourceHandle?.replace(/^(src-|tgt-)/, '').replace(/-(r|l)$/, '');
        const sourceCol = sourceNode.data.columns.find(c => c.id === cleanSourceHandle);
        const isOneToOne = sourceCol?.unique;
        const sourceModel = getModelName(sourceNode.data.name);
        const methodName = toCamelCase(sourceNode.data.name); 
        const finalMethodName = isOneToOne ? methodName.replace(/s$/, '') : methodName;
        const relationClass = isOneToOne ? 'HasOne' : 'HasMany';
        const relationMethod = isOneToOne ? 'hasOne' : 'hasMany';

        return `
    /**
     * Relationship with ${sourceModel}.
     */
    public function ${finalMethodName}(): ${relationClass}
    {
        return $this->${relationMethod}(${sourceModel}::class);
    }`;
    });

    if (belongsToMethods.length > 0) uses.push('use Illuminate\\Database\\Eloquent\\Relations\\BelongsTo;');
    if (hasManyMethodsArr.some(m => m.includes('HasOne'))) uses.push('use Illuminate\\Database\\Eloquent\\Relations\\HasOne;');
    if (hasManyMethodsArr.some(m => m.includes('HasMany'))) uses.push('use Illuminate\\Database\\Eloquent\\Relations\\HasMany;');
    
    const uniqueUses = [...new Set(uses)].sort().join('\n');
    const timestampsProp = table.timestamps === false ? `\n    /**\n     * Indicates if the model should be timestamped.\n     *\n     * @var bool\n     */\n    public $timestamps = false;\n` : '';

    return `${PHP_HEADER}namespace App\\Models;

${uniqueUses}

class ${modelName} extends ${extendsClass}${interfaces.length > 0 ? ' implements ' + interfaces.join(', ') : ''}
{
    /** @use HasFactory<\\Database\\Factories\\${modelName}Factory> */
    use ${traits.join(', ')};

    protected $table = '${table.name}';
${timestampsProp}
    protected $fillable = [
        ${fillableCols}
    ];

    protected $casts = [
        ${casts}
    ];
${belongsToMethods}
${hasManyMethodsArr.join('\n')}${extraMethods.join('\n')}
}
`;
}

// --- DTO Generator ---

export const generateDto = (node: Node<TableData>): string => {
    const table = node.data;
    const modelName = getModelName(table.name);
    const className = `${modelName}Data`;

    const properties = table.columns
        .filter(c => c.type !== LaravelColumnType.ID && c.type !== LaravelColumnType.TIMESTAMP && !['created_at', 'updated_at', 'deleted_at'].includes(c.name))
        .map(c => {
             let typeHint = 'mixed';
             if (['string', 'text', 'longText'].includes(c.type)) typeHint = 'string';
             else if (['integer', 'bigInteger', 'tinyInteger'].includes(c.type)) typeHint = 'int';
             else if (c.type === 'boolean') typeHint = 'bool';
             else if (c.type === 'decimal' || c.type === 'float') typeHint = 'float';
             
             if (c.nullable) typeHint = `?${typeHint}`;
             return `        public ${typeHint} $${c.name},`;
        }).join('\n');

    return `${PHP_HEADER}namespace App\\DTOs;

readonly class ${className}
{
    public function __construct(
${properties}
    ) {}

    public static function fromRequest($request): self
    {
        return new self(...$request->validated());
    }

    public function toArray(): array
    {
        return get_object_vars($this);
    }
}
`;
}

// --- Seeder & Factory ---

export const generateSeeder = (node: Node<TableData>): string => {
    const table = node.data;
    const modelName = getModelName(table.name);
    return `${PHP_HEADER}namespace Database\\Seeders;
use Illuminate\\Database\\Seeder;
use App\\Models\\${modelName};

class ${modelName}Seeder extends Seeder
{
    public function run(): void
    {
        ${modelName}::factory()->count(10)->create();
    }
}
`;
}

export const generateFactory = (
    node: Node<TableData>,
    allNodes: Node<TableData>[],
    allEdges: Edge[]
): string => {
    const table = node.data;
    const modelName = getModelName(table.name);

    const definitions = table.columns
        .filter(c => c.type !== LaravelColumnType.ID && c.type !== LaravelColumnType.TIMESTAMP && !['created_at', 'updated_at', 'deleted_at', 'remember_token'].includes(c.name))
        .map(c => {
             const outgoingEdge = allEdges.find(e => {
                 const cleanSource = e.sourceHandle?.replace(/^(src-|tgt-)/, '').replace(/-(r|l)$/, '');
                 return e.source === node.id && cleanSource === c.id;
             });

             if (outgoingEdge) {
                 const targetNode = allNodes.find(n => n.id === outgoingEdge.target);
                 if (targetNode) return `'${c.name}' => \\App\\Models\\${getModelName(targetNode.data.name)}::factory()`;
             }

             if (c.type === LaravelColumnType.FOREIGN_ID || c.name.endsWith('_id')) {
                  const potentialModelName = getModelName(c.name.replace(/_id$/, 's'));
                  const exists = allNodes.some(n => getModelName(n.data.name) === potentialModelName);
                  if (exists) {
                      return `'${c.name}' => \\App\\Models\\${potentialModelName}::factory()`;
                  }
                  return `'${c.name}' => 1`; 
             }

             if (c.type === LaravelColumnType.ENUM && c.enumValues) {
                 const options = c.enumValues.split(',').map(s => `'${s.trim()}'`).join(', ');
                 return `'${c.name}' => $this->faker->randomElement([${options}])`;
             }

             let fakerMethod = `word()`;
             const name = c.name.toLowerCase();

             if (c.type === LaravelColumnType.STRING || c.type === LaravelColumnType.CHAR) {
                 if (name.includes('email')) fakerMethod = `unique()->safeEmail()`;
                 else if (name.includes('name') && (name.includes('first') || name.includes('last'))) fakerMethod = `firstName()`;
                 else if (name === 'name' || name.includes('full_name')) fakerMethod = `name()`;
                 else if (name.includes('phone')) fakerMethod = `phoneNumber()`;
                 else if (name.includes('address')) fakerMethod = `address()`;
                 else if (name.includes('city')) fakerMethod = `city()`;
                 else if (name.includes('state')) fakerMethod = `state()`;
                 else if (name.includes('zip') || name.includes('postal')) fakerMethod = `postcode()`;
                 else if (name.includes('country')) fakerMethod = `country()`;
                 else if (name.includes('company')) fakerMethod = `company()`;
                 else if (name.includes('title')) fakerMethod = `sentence(4)`;
                 else if (name.includes('slug')) fakerMethod = `slug()`;
                 else if (name.includes('url') || name.includes('website')) fakerMethod = `url()`;
                 else if (name.includes('ip')) fakerMethod = `ipv4()`;
                 else if (name.includes('mac')) fakerMethod = `macAddress()`;
                 else if (name.includes('password')) fakerMethod = `password()`;
                 else if (name.includes('uuid') || name.includes('guid')) fakerMethod = `uuid()`;
                 else if (name.includes('token')) fakerMethod = `sha256()`;
                 else fakerMethod = `word()`;
             }
             else if (['text', 'mediumText', 'longText'].includes(c.type)) {
                 fakerMethod = `paragraph()`;
             }
             else if (['integer', 'bigInteger', 'tinyInteger', 'smallInteger'].includes(c.type)) {
                 if (c.unsigned) fakerMethod = `numberBetween(1, 1000)`;
                 else fakerMethod = `numberBetween(-1000, 1000)`;
             }
             else if (['decimal', 'float', 'double'].includes(c.type)) {
                 if (name.includes('price') || name.includes('amount') || name.includes('cost')) {
                     fakerMethod = `randomFloat(2, 10, 1000)`;
                 } else {
                     fakerMethod = `randomFloat(2, 0, 100)`;
                 }
             }
             else if (c.type === LaravelColumnType.BOOLEAN) {
                 fakerMethod = `boolean()`;
             }
             else if (c.type === LaravelColumnType.DATE) {
                 if (name.includes('birth')) fakerMethod = `date('Y-m-d', '-18 years')`;
                 else fakerMethod = `date()`;
             }
             else if (c.type === LaravelColumnType.TIME) {
                 fakerMethod = `time()`;
             }
             else if (['dateTime', 'timestamp'].includes(c.type)) {
                 fakerMethod = `dateTime()`;
             }
             else if (c.type === LaravelColumnType.JSON || name === 'payload') {
                 return `'${c.name}' => ['key' => $this->faker->word(), 'value' => $this->faker->randomNumber()]`;
             }
             else if (c.type === LaravelColumnType.UUID) fakerMethod = `uuid()`;
             else if (c.type === LaravelColumnType.ULID) fakerMethod = `ulid()`;
             else if (c.type === LaravelColumnType.IP_ADDRESS) fakerMethod = `ipv4()`;
             else if (c.type === LaravelColumnType.MAC_ADDRESS) fakerMethod = `macAddress()`;

             return `'${c.name}' => $this->faker->${fakerMethod}`;
        }).join(',\n            ');

    return `${PHP_HEADER}namespace Database\\Factories;
use Illuminate\\Database\\Eloquent\\Factories\\Factory;
use Illuminate\\Support\\Facades\\Hash;
use Illuminate\\Support\\Str;

class ${modelName}Factory extends Factory
{
    public function definition(): array
    {
        return [
            ${definitions}
        ];
    }
}
`;
};

// --- Controllers & Routes ---

export const generateApiRoutes = (nodes: Node<TableData>[], settings: ProjectSettings) => {
    const routes = nodes.map(n => {
        const routeName = n.data.name.replace(/_/g, '-');
        const controllerClass = `\\App\\Http\\Controllers\\Api\\${getModelName(n.data.name)}Controller::class`;
        return `    Route::apiResource('${routeName}', ${controllerClass});`;
    }).join('\n');

    const throttle = `throttle:${settings.api.rateLimitRequests},${settings.api.rateLimitPeriod}`;
    
    // Only apply auth:sanctum if the package is enabled in settings
    const middleware = [];
    if (settings.packages.sanctum) middleware.push('auth:sanctum');
    middleware.push(throttle);
    const middlewareString = middleware.map(m => `'${m}'`).join(', ');

    let extras = '';
    if (settings.packages.spatieWebhookClient) {
        extras = `\n\n// Webhook Receiver Endpoint\nRoute::webhooks('webhooks');`;
    }

    return `${PHP_HEADER}use Illuminate\\Support\\Facades\\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

Route::middleware([${middlewareString}])->group(function () {
${routes}
});${extras}`;
}

export const generateWebRoutes = (nodes: Node<TableData>[], settings: ProjectSettings) => {
    let routes = nodes.map(n => {
        const routeName = n.data.name.replace(/_/g, '-');
        const controllerClass = `\\App\\Http\\Controllers\\${getModelName(n.data.name)}Controller::class`;
        return `    Route::resource('${routeName}', ${controllerClass});`;
    }).join('\n');
    
    const middleware = ['auth'];
    if (settings.authentication.breeze) middleware.push('verified');

    return `${PHP_HEADER}use Illuminate\\Support\\Facades\\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::middleware(['${middleware.join("', '")}'])->group(function () {
    Route::get('/dashboard', function () {
        return view('dashboard');
    })->name('dashboard');

${routes}
});

require __DIR__.'/auth.php';
`;
}

export const generateApiController = (node: Node<TableData>, settings: ProjectSettings) => {
    const table = node.data;
    const modelName = getModelName(table.name);
    const variableName = getVariableName(table.name);
    
    const useDto = settings.api.generateDtos;
    const dtoImport = useDto ? `use App\\DTOs\\${modelName}Data;\n` : '';

    let storeBody = `$${variableName} = ${modelName}::create($request->validated());`;
    let updateBody = `$${variableName}->update($request->validated());`;
    
    if (useDto) {
        storeBody = `$data = ${modelName}Data::fromRequest($request);\n        $${variableName} = ${modelName}::create($data->toArray());`;
        updateBody = `$data = ${modelName}Data::fromRequest($request);\n        $${variableName}->update($data->toArray());`;
    }

    return `${PHP_HEADER}namespace App\\Http\\Controllers\\Api;

use App\\Http\\Controllers\\Controller;
use App\\Models\\${modelName};
use App\\Http\\Requests\\Store${modelName}Request;
use App\\Http\\Requests\\Update${modelName}Request;
use App\\Http\\Resources\\${modelName}Resource;
${dtoImport}use Illuminate\\Http\\Resources\\Json\\AnonymousResourceCollection;
use Illuminate\\Http\\JsonResponse;

class ${modelName}Controller extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return ${modelName}Resource::collection(${modelName}::paginate());
    }

    public function store(Store${modelName}Request $request): ${modelName}Resource
    {
        ${storeBody}
        return new ${modelName}Resource($${variableName});
    }

    public function show(${modelName} $${variableName}): ${modelName}Resource
    {
        return new ${modelName}Resource($${variableName});
    }

    public function update(Update${modelName}Request $request, ${modelName} $${variableName}): ${modelName}Resource
    {
        ${updateBody}
        return new ${modelName}Resource($${variableName});
    }

    public function destroy(${modelName} $${variableName}): JsonResponse
    {
        $${variableName}->delete();
        return response()->json(null, 204);
    }
}`;
}

export const generateWebController = (node: Node<TableData>, settings: ProjectSettings) => {
    const table = node.data;
    const modelName = getModelName(table.name);
    const variableName = getVariableName(table.name);
    const viewPrefix = table.name.replace(/_/g, '-');

    return `${PHP_HEADER}namespace App\\Http\\Controllers;

use App\\Models\\${modelName};
use App\\Http\\Requests\\Store${modelName}Request;
use App\\Http\\Requests\\Update${modelName}Request;
use Illuminate\\Http\\RedirectResponse;
use Illuminate\\View\\View;

class ${modelName}Controller extends Controller
{
    public function index(): View
    {
        $${table.name} = ${modelName}::paginate(10);
        return view('${viewPrefix}.index', compact('${table.name}'));
    }

    public function create(): View
    {
        return view('${viewPrefix}.create');
    }

    public function store(Store${modelName}Request $request): RedirectResponse
    {
        ${modelName}::create($request->validated());
        return redirect()->route('${viewPrefix}.index')->with('success', '${modelName} created successfully.');
    }

    public function show(${modelName} $${variableName}): View
    {
        return view('${viewPrefix}.show', compact('${variableName}'));
    }

    public function edit(${modelName} $${variableName}): View
    {
        return view('${viewPrefix}.edit', compact('${variableName}'));
    }

    public function update(Update${modelName}Request $request, ${modelName} $${variableName}): RedirectResponse
    {
        $${variableName}->update($request->validated());
        return redirect()->route('${viewPrefix}.index')->with('success', '${modelName} updated successfully.');
    }

    public function destroy(${modelName} $${variableName}): RedirectResponse
    {
        $${variableName}->delete();
        return redirect()->route('${viewPrefix}.index')->with('success', '${modelName} deleted successfully.');
    }
}`;
}

const getValidationRules = (col: Column, table: TableData, isUpdate: boolean = false): string[] => {
    const rules: string[] = [];

    // Nullable/Required
    if (col.nullable) {
        rules.push(`'nullable'`);
    } else {
        if (isUpdate) {
            rules.push(`'sometimes'`);
            rules.push(`'required'`);
        } else {
            rules.push(`'required'`);
        }
    }
    
    // Type validation
    if (['string', 'text', 'longText', 'char'].includes(col.type)) {
        rules.push(`'string'`);
        if (col.length) rules.push(`'max:${col.length}'`);
        else if (col.type === 'string' || col.type === 'char') rules.push(`'max:255'`);
    }

    if (['integer', 'bigInteger', 'tinyInteger', 'smallInteger', 'mediumInteger', 'foreignId'].includes(col.type)) {
        rules.push(`'integer'`);
    }
    
    if (col.type === 'boolean') rules.push(`'boolean'`);
    
    if (['decimal', 'float', 'double'].includes(col.type)) rules.push(`'numeric'`);
    
    if (col.type === LaravelColumnType.JSON) rules.push(`'array'`);
    
    if (['date', 'dateTime', 'timestamp'].includes(col.type)) rules.push(`'date'`);
    
    if (col.name.includes('email') && col.type === 'string') rules.push(`'email'`);
    if (col.type === LaravelColumnType.IP_ADDRESS) rules.push(`'ip'`);
    if (col.type === LaravelColumnType.MAC_ADDRESS) rules.push(`'mac_address'`);
    if (col.type === LaravelColumnType.UUID) rules.push(`'uuid'`);
    if (col.type === LaravelColumnType.ULID) rules.push(`'ulid'`);
    
    // Enums
    if (col.type === LaravelColumnType.ENUM && col.enumValues) {
        const options = col.enumValues.split(',').map(v => v.trim()).join(',');
        rules.push(`'in:${options}'`);
    }

    // Unique validation
    if (col.unique) {
        if (isUpdate) {
             const paramName = table.name.replace(/_/g, '-');
             rules.push(`Rule::unique('${table.name}', '${col.name}')->ignore($this->route('${paramName}'))`);
        } else {
             rules.push(`'unique:${table.name},${col.name}'`);
        }
    }
    
    return rules;
};

export const generateStoreRequest = (node: Node<TableData>) => {
     const table = node.data; 
     const modelName = getModelName(table.name);
     const rules = table.columns
        .filter(c => c.type !== LaravelColumnType.ID && c.type !== LaravelColumnType.TIMESTAMP && !['created_at', 'updated_at', 'deleted_at'].includes(c.name))
        .map(c => `'${c.name}' => [${getValidationRules(c, table, false).join(', ')}],`)
        .join('\n            ');

     return `${PHP_HEADER}namespace App\\Http\\Requests;
use Illuminate\\Foundation\\Http\\FormRequest;
use Illuminate\\Validation\\Rule;

class Store${modelName}Request extends FormRequest 
{
    public function authorize(): bool { return true; }
    public function rules(): array { return [ 
            ${rules} 
    ]; }
}`;
}

export const generateUpdateRequest = (node: Node<TableData>) => {
     const table = node.data; 
     const modelName = getModelName(table.name);
     const rules = table.columns
        .filter(c => c.type !== LaravelColumnType.ID && c.type !== LaravelColumnType.TIMESTAMP && !['created_at', 'updated_at', 'deleted_at'].includes(c.name))
        .map(c => `'${c.name}' => [${getValidationRules(c, table, true).join(', ')}],`)
        .join('\n            ');

     return `${PHP_HEADER}namespace App\\Http\\Requests;
use Illuminate\\Foundation\\Http\\FormRequest;
use Illuminate\\Validation\\Rule;

class Update${modelName}Request extends FormRequest 
{
    public function authorize(): bool { return true; }
    public function rules(): array { return [ 
            ${rules} 
    ]; }
}`;
}

export const generateResource = (node: Node<TableData>) => {
    const modelName = getModelName(node.data.name);
    return `${PHP_HEADER}namespace App\\Http\\Resources;
use Illuminate\\Http\\Request;
use Illuminate\\Http\\Resources\\Json\\JsonResource;

class ${modelName}Resource extends JsonResource 
{
    public function toArray(Request $request): array { return parent::toArray($request); }
}`;
}

// --- Filament Resource Generator ---

const getFilamentFormComponents = (columns: Column[]) => {
    return columns
    .filter(c => c.type !== LaravelColumnType.ID && c.type !== LaravelColumnType.TIMESTAMP && !['created_at', 'updated_at', 'deleted_at'].includes(c.name))
    .map(c => {
        let component = `Forms\\Components\\TextInput::make('${c.name}')`;
        let methods: string[] = [];

        if (c.type === LaravelColumnType.BOOLEAN) {
            component = `Forms\\Components\\Toggle::make('${c.name}')`;
        } else if (['text', 'longText', 'mediumText'].includes(c.type)) {
            component = `Forms\\Components\\Textarea::make('${c.name}')`;
            methods.push("columnSpanFull()");
        } else if (c.type === LaravelColumnType.DATE) {
            component = `Forms\\Components\\DatePicker::make('${c.name}')`;
        } else if (c.type === LaravelColumnType.DATETIME || c.type === LaravelColumnType.TIMESTAMP) {
            component = `Forms\\Components\\DateTimePicker::make('${c.name}')`;
        } else if (c.type === LaravelColumnType.JSON) {
            component = `Forms\\Components\\KeyValue::make('${c.name}')`;
        } else if (c.type === LaravelColumnType.ENUM && c.enumValues) {
            component = `Forms\\Components\\Select::make('${c.name}')`;
            const options = c.enumValues.split(',').map(s => `'${s.trim()}' => '${s.trim()}'`).join(', ');
            methods.push(`options([${options}])`);
        } else if (c.type === LaravelColumnType.FOREIGN_ID || c.name.endsWith('_id')) {
            const relName = c.name.replace('_id', '');
            const relMethod = toCamelCase(relName);
            component = `Forms\\Components\\Select::make('${c.name}')`;
            methods.push(`relationship('${relMethod}', 'name')`); // Assumption: related model has 'name'
        }

        if (!c.nullable) methods.push("required()");
        if (c.type === 'string' && c.length) methods.push(`maxLength(${c.length})`);
        
        return `                ${component}${methods.length > 0 ? '\n                    ->' + methods.join('\n                    ->') : ''},`;
    }).join('\n');
}

const getFilamentTableColumns = (columns: Column[]) => {
    return columns.map(c => {
        let colDef = `Tables\\Columns\\TextColumn::make('${c.name}')`;
        let methods: string[] = [];
        
        if (c.type === LaravelColumnType.BOOLEAN) {
            colDef = `Tables\\Columns\\IconColumn::make('${c.name}')`;
            methods.push("boolean()");
        }

        if (c.type === LaravelColumnType.ID) {
            methods.push("sortable()");
        } else {
            methods.push("searchable()");
        }

        if (['created_at', 'updated_at'].includes(c.name)) {
            methods.push("dateTime()");
            methods.push("sortable()");
            methods.push("toggleable(isToggledHiddenByDefault: true)");
        }

        return `                ${colDef}${methods.length > 0 ? '\n                    ->' + methods.join('\n                    ->') : ''},`;
    }).join('\n');
}

export const generateFilamentResource = (node: Node<TableData>) => {
    const table = node.data;
    const modelName = getModelName(table.name);
    const resourceName = `${modelName}Resource`;

    return `${PHP_HEADER}namespace App\\Filament\\Resources;

use App\\Filament\\Resources\\${resourceName}\\Pages;
use App\\Models\\${modelName};
use Filament\\Forms;
use Filament\\Forms\\Form;
use Filament\\Resources\\Resource;
use Filament\\Tables;
use Filament\\Tables\\Table;
use Illuminate\\Database\\Eloquent\\Builder;
use Illuminate\\Database\\Eloquent\\SoftDeletingScope;

class ${resourceName} extends Resource
{
    protected static ?string $model = ${modelName}::class;

    protected static ?string $navigationIcon = 'heroicon-o-rectangle-stack';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
${getFilamentFormComponents(table.columns)}
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
${getFilamentTableColumns(table.columns)}
            ])
            ->filters([
                //
            ])
            ->actions([
                Tables\\Actions\\EditAction::make(),
            ])
            ->bulkActions([
                Tables\\Actions\\BulkActionGroup::make([
                    Tables\\Actions\\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\\List${modelName}s::route('/'),
            'create' => Pages\\Create${modelName}::route('/create'),
            'edit' => Pages\\Edit${modelName}::route('/{record}/edit'),
        ];
    }
}
`;
}

// --- Blade Views Generator ---

export const generateBladeIndex = (node: Node<TableData>) => {
    const table = node.data;
    const modelName = getModelName(table.name);
    const viewPrefix = table.name.replace(/_/g, '-');
    const variableName = table.name; // e.g. users

    return `<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ __('${modelName}s') }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg">
                <div class="p-6 text-gray-900">
                    <div class="flex justify-end mb-4">
                        <a href="{{ route('${viewPrefix}.create') }}" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                            Create ${modelName}
                        </a>
                    </div>
                    
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                ${table.columns.slice(0, 5).map(c => `<th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${c.name}</th>`).join('\n                                ')}
                                <th class="px-6 py-3 bg-gray-50"></th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            @foreach ($${variableName} as $item)
                                <tr>
                                    ${table.columns.slice(0, 5).map(c => `<td class="px-6 py-4 whitespace-nowrap">{{ $item->${c.name} }}</td>`).join('\n                                    ')}
                                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <a href="{{ route('${viewPrefix}.show', $item) }}" class="text-indigo-600 hover:text-indigo-900 mr-3">View</a>
                                        <a href="{{ route('${viewPrefix}.edit', $item) }}" class="text-blue-600 hover:text-blue-900 mr-3">Edit</a>
                                        <form action="{{ route('${viewPrefix}.destroy', $item) }}" method="POST" class="inline">
                                            @csrf
                                            @method('DELETE')
                                            <button type="submit" class="text-red-600 hover:text-red-900" onclick="return confirm('Are you sure?')">Delete</button>
                                        </form>
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                    <div class="mt-4">
                        {{ $${variableName}->links() }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</x-app-layout>`;
}

export const generateDatabaseSeeder = (nodes: Node<TableData>[]) => {
     const calls = nodes.map(n => `            ${getModelName(n.data.name)}Seeder::class,`).join('\n');
     return `${PHP_HEADER}namespace Database\\Seeders;\nuse Illuminate\\Database\\Seeder;\nclass DatabaseSeeder extends Seeder {\n    public function run(): void {\n        $this->call([\n${calls}\n        ]);\n    }\n}`;
}

// --- Webhook Generators ---

export const generateWebhookServerConfig = () => {
    return `${PHP_HEADER}return [
    'queue' => 'default',
    'http_verb' => 'post',
    'timeout_in_seconds' => 3,
    'tries' => 3,
    'backoff_in_seconds' => 0,
    'signature_header_name' => 'Signature',
    'signing_secret' => env('WEBHOOK_SERVER_SECRET'),
    'verify_ssl' => true,
    'tags' => [],
];`;
};

export const generateWebhookClientConfig = () => {
    return `${PHP_HEADER}return [
    'configs' => [
        [
            'name' => 'default',
            'signing_secret' => env('WEBHOOK_CLIENT_SECRET'),
            'signature_header_name' => 'Signature',
            'signature_validator' => \\Spatie\\WebhookClient\\SignatureValidator\\DefaultSignatureValidator::class,
            'webhook_profile' => \\Spatie\\WebhookClient\\WebhookProfile\\ProcessEverythingWebhookProfile::class,
            'webhook_response' => \\Spatie\\WebhookClient\\WebhookResponse\\DefaultRespondsTo::class,
            'webhook_model' => \\Spatie\\WebhookClient\\Models\\WebhookCall::class,
            'process_webhook_job' => \\App\\Jobs\\ProcessWebhookJob::class,
        ],
    ],
    'delete_after_days' => 30,
];`;
};

export const generateProcessWebhookJob = () => {
    return `${PHP_HEADER}namespace App\\Jobs;

use Spatie\\WebhookClient\\Jobs\\ProcessWebhookJob as SpatieProcessWebhookJob;

class ProcessWebhookJob extends SpatieProcessWebhookJob
{
    public function handle()
    {
        // $this->webhookCall // contains the stored webhook data
        
        // Process the webhook here
        // logger()->info("Webhook received: " . $this->webhookCall->id);
    }
}`;
};

export const generateWebhookCallMigration = () => {
    return `${PHP_HEADER}use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('webhook_calls', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('url');
            $table->json('headers')->nullable();
            $table->json('payload')->nullable();
            $table->text('exception')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('webhook_calls');
    }
};`;
};

export const generateComposerJson = (settings: ProjectSettings) => {
    const require = {
        "php": "^8.2",
        "laravel/framework": "^11.0",
        "laravel/tinker": "^2.9",
    };
    
    // @ts-ignore
    if (settings.authentication.breeze) require["laravel/breeze"] = "^2.0";
    // @ts-ignore
    if (settings.saas.filamentAdmin) require["filament/filament"] = "^3.2";
    // @ts-ignore
    if (settings.packages.spatiePermissions) require["spatie/laravel-permission"] = "^6.0";
    // @ts-ignore
    if (settings.packages.spatieMediaLibrary) require["spatie/laravel-medialibrary"] = "^11.0";
    // @ts-ignore
    if (settings.packages.spatieWebhookClient) require["spatie/laravel-webhook-client"] = "^3.2";
    // @ts-ignore
    if (settings.packages.spatieWebhookServer) require["spatie/laravel-webhook-server"] = "^3.4";
    
    return JSON.stringify({
        "name": "laravel/laravel",
        "type": "project",
        "description": "The skeleton application for the Laravel framework.",
        "keywords": ["laravel", "framework"],
        "license": "MIT",
        "require": require,
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
                "App\\": "app/",
                "Database\\Factories\\": "database/factories/",
                "Database\\Seeders\\": "database/seeders/"
            }
        }
    }, null, 4);
}

export const prepareZipData = (nodes: Node<TableData>[], edges: Edge[], projectSettings: ProjectSettings) => {
    const files: Record<string, string> = {};
    
    // Config
    files['composer.json'] = generateComposerJson(projectSettings);
    files['config/cors.php'] = `${PHP_HEADER}return ['paths' => ['api/*', 'sanctum/csrf-cookie', 'webhooks'], 'allowed_methods' => ['*'], 'allowed_origins' => ['*'], 'allowed_origins_patterns' => [], 'allowed_headers' => ['*'], 'exposed_headers' => [], 'max_age' => 0, 'supports_credentials' => false,];`;

    // Global
    files['routes/api.php'] = generateApiRoutes(nodes, projectSettings);
    files['database/seeders/DatabaseSeeder.php'] = generateDatabaseSeeder(nodes);

    if (projectSettings.frontend.stack === 'blade') {
        files['routes/web.php'] = generateWebRoutes(nodes, projectSettings);
    }

    if (projectSettings.packages.spatieWebhookServer) {
        files['config/webhook-server.php'] = generateWebhookServerConfig();
    }

    if (projectSettings.packages.spatieWebhookClient) {
        files['config/webhook-client.php'] = generateWebhookClientConfig();
        files['app/Jobs/ProcessWebhookJob.php'] = generateProcessWebhookJob();
        
        // Add migration
        const baseTs = parseInt(new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14));
        const migrationTs = baseTs + (nodes.length + 5) * 10; // Ensure it's after node migrations
        files[`database/migrations/${migrationTs}_create_webhook_calls_table.php`] = generateWebhookCallMigration();
    }

    nodes.forEach((node, idx) => {
        const modelName = getModelName(node.data.name);
        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
        const uniqueTs = parseInt(timestamp) + idx * 10;
        
        // Database
        files[`database/migrations/${uniqueTs}_create_${node.data.name}_table.php`] = generateMigration(node, nodes, edges);
        files[`database/seeders/${modelName}Seeder.php`] = generateSeeder(node);
        files[`database/factories/${modelName}Factory.php`] = generateFactory(node, nodes, edges);
        
        // Models
        files[`app/Models/${modelName}.php`] = generateModel(node, nodes, edges, projectSettings);
        
        // Requests
        files[`app/Http/Requests/Store${modelName}Request.php`] = generateStoreRequest(node);
        files[`app/Http/Requests/Update${modelName}Request.php`] = generateUpdateRequest(node);
        
        // API
        files[`app/Http/Controllers/Api/${modelName}Controller.php`] = generateApiController(node, projectSettings);
        files[`app/Http/Resources/${modelName}Resource.php`] = generateResource(node);
        
        if (projectSettings.api.generateDtos) {
            files[`app/DTOs/${modelName}Data.php`] = generateDto(node);
        }

        // Filament Admin
        if (projectSettings.saas.filamentAdmin) {
            files[`app/Filament/Resources/${modelName}Resource.php`] = generateFilamentResource(node);
            files[`app/Filament/Resources/${modelName}Resource/Pages/List${modelName}s.php`] = `${PHP_HEADER}namespace App\\Filament\\Resources\\${modelName}Resource\\Pages;\nuse App\\Filament\\Resources\\${modelName}Resource;\nuse Filament\\Actions;\nuse Filament\\Resources\\Pages\\ListRecords;\nclass List${modelName}s extends ListRecords { protected static string $resource = ${modelName}Resource::class; protected function getHeaderActions(): array { return [ Actions\\CreateAction::make(), ]; } }`;
            files[`app/Filament/Resources/${modelName}Resource/Pages/Create${modelName}.php`] = `${PHP_HEADER}namespace App\\Filament\\Resources\\${modelName}Resource\\Pages;\nuse App\\Filament\\Resources\\${modelName}Resource;\nuse Filament\\Resources\\Pages\\CreateRecord;\nclass Create${modelName} extends CreateRecord { protected static string $resource = ${modelName}Resource::class; }`;
            files[`app/Filament/Resources/${modelName}Resource/Pages/Edit${modelName}.php`] = `${PHP_HEADER}namespace App\\Filament\\Resources\\${modelName}Resource\\Pages;\nuse App\\Filament\\Resources\\${modelName}Resource;\nuse Filament\\Resources\\Pages\\EditRecord;\nclass Edit${modelName} extends EditRecord { protected static string $resource = ${modelName}Resource::class; }`;
        }

        // Blade Frontend (if enabled)
        if (projectSettings.frontend.stack === 'blade') {
            files[`app/Http/Controllers/${modelName}Controller.php`] = generateWebController(node, projectSettings);
            const viewPath = `resources/views/${node.data.name.replace(/_/g, '-')}`;
            files[`${viewPath}/index.blade.php`] = generateBladeIndex(node);
            files[`${viewPath}/create.blade.php`] = `<!-- Create Form for ${modelName} -->`;
            files[`${viewPath}/edit.blade.php`] = `<!-- Edit Form for ${modelName} -->`;
            files[`${viewPath}/show.blade.php`] = `<!-- View Details for ${modelName} -->`;
        }
    });
    return files;
};
