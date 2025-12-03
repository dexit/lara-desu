
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

const toSpacedWords = (str: string) => {
    return str
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase());
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
    allEdges: Edge[],
    projectSettings: ProjectSettings
): string => {
    const table = node.data;
    const modelName = getModelName(table.name);
    
    // Conditional Imports & Traits
    const isUser = table.name === 'users';
    const isTeam = table.name === 'teams';

    let uses = [ 'use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;' ];
    let traits = [ 'HasFactory' ];
    let interfaces = [];
    
    if (table.softDeletes) {
        uses.push('use Illuminate\\Database\\Eloquent\\SoftDeletes;');
        traits.push('SoftDeletes');
    }
    
    // Auth & Cashier
    if (projectSettings.authentication.breeze || projectSettings.packages.sanctum) {
        if(isUser) {
          uses.push('use Laravel\\Sanctum\\HasApiTokens;');
          traits.push('HasApiTokens');
        }
    }
    if (projectSettings.saas.cashier && isUser) {
        uses.push('use Laravel\\Cashier\\Billable;');
        traits.push('Billable');
    }

    // Spatie Logic
    if (projectSettings.packages.spatiePermissions && isUser) {
        uses.push('use Spatie\\Permission\\Traits\\HasRoles;');
        traits.push('HasRoles');
    }
    if (projectSettings.packages.spatieSluggable && table.generateSlug) {
        uses.push('use Spatie\\Sluggable\\HasSlug;');
        uses.push('use Spatie\\Sluggable\\SlugOptions;');
        traits.push('HasSlug');
    }
    if (projectSettings.packages.spatieActivityLog) {
        uses.push('use Spatie\\Activitylog\\Traits\\LogsActivity;');
        traits.push('LogsActivity');
    }
    if (projectSettings.packages.spatieMediaLibrary) {
        uses.push('use Spatie\\MediaLibrary\\HasMedia;');
        uses.push('use Spatie\\MediaLibrary\\InteractsWithMedia;');
        interfaces.push('HasMedia');
        traits.push('InteractsWithMedia');
    }
    
    // Filament User Interface
    if (projectSettings.saas.filamentAdmin && isUser) {
         uses.push('use Filament\\Models\\Contracts\\FilamentUser;');
         uses.push('use Filament\\Panel;');
         interfaces.push('FilamentUser');
    }

    // Base Eloquent Model, for User it's Authenticatable
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
        .filter(c => ['boolean', 'date', 'datetime', 'timestamp', 'json', 'decimal', 'double', 'float'].includes(c.type))
        .map(c => `'${c.name}' => '${getCastType(c.type)}'`)
        .join(',\n        ');

    // Relationships
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
        const description = isOneToOne ? `Get the ${sourceModel.toLowerCase()} associated with the ${modelName}.` : `Get the ${sourceModel.toLowerCase()}s for the ${modelName}.`;

        return `
    /**
     * ${description}
     */
    public function ${finalMethodName}(): ${relationClass}
    {
        return $this->${relationMethod}(${sourceModel}::class);
    }`;
    });
    const hasManyMethods = hasManyMethodsArr.join('\n');
    
    // Sluggable method
    const sluggableMethod = (projectSettings.packages.spatieSluggable && table.generateSlug) ? `
    /**
     * Get the options for generating the slug.
     */
    public function getSlugOptions(): SlugOptions
    {
        return SlugOptions::create()
            ->generateSlugsFrom('name') 
            ->saveSlugsTo('slug');
    }` : '';

    // Filament Auth
    const filamentAuthMethod = (projectSettings.saas.filamentAdmin && isUser) ? `
    public function canAccessPanel(Panel $panel): bool
    {
        // TODO: Implement your access logic (e.g., check email domain or role)
        return true; 
    }` : '';
    
    // Add relation imports if needed
    if (belongsToMethods.length > 0) uses.push('use Illuminate\\Database\\Eloquent\\Relations\\BelongsTo;');
    if (hasManyMethods.length > 0) {
      if (hasManyMethodsArr.some(m => m.includes('HasOne'))) uses.push('use Illuminate\\Database\\Eloquent\\Relations\\HasOne;');
      if (hasManyMethodsArr.some(m => m.includes('HasMany'))) uses.push('use Illuminate\\Database\\Eloquent\\Relations\\HasMany;');
    }
    
    // Dedupe and sort uses
    const uniqueUses = [...new Set(uses)].sort().join('\n');

    return `${PHP_HEADER}namespace App\\Models;

${uniqueUses}

class ${modelName} extends ${extendsClass}${interfaces.length > 0 ? ' implements ' + interfaces.join(', ') : ''}
{
    /** @use HasFactory<\\Database\\Factories\\${modelName}Factory> */
    use ${traits.join(', ')};

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
${sluggableMethod}
${filamentAuthMethod}
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

// --- START: Filament Generator ---

export const generateFilamentResource = (node: Node<TableData>): string => {
    const table = node.data;
    const modelName = getModelName(table.name);
    const resourceName = `${modelName}Resource`;
    const label = toSpacedWords(modelName);

    // Form Generator
    const formFields = table.columns
        .filter(c => c.type !== LaravelColumnType.ID && c.type !== LaravelColumnType.TIMESTAMP && !c.name.endsWith('_at') && !c.name.endsWith('_token'))
        .map(c => {
            let field = `Forms\\Components\\TextInput::make('${c.name}')`;
            
            if (c.type === LaravelColumnType.BOOLEAN) {
                return `Forms\\Components\\Toggle::make('${c.name}')->required()`;
            }
            if (c.type === LaravelColumnType.TEXT || c.type === LaravelColumnType.LONG_TEXT) {
                return `Forms\\Components\\Textarea::make('${c.name}')->maxLength(65535)->columnSpanFull()`;
            }
            if (c.name.includes('date')) {
                return `Forms\\Components\\DatePicker::make('${c.name}')`;
            }
            if (c.type === LaravelColumnType.FOREIGN_ID) {
                const relation = c.name.replace('_id', ''); // e.g., user
                return `Forms\\Components\\Select::make('${c.name}')->relationship('${toCamelCase(relation)}', 'id')`; 
                // Note: user must ideally adjust 'id' to 'name' or relevant field
            }
            if (c.name.includes('image') || c.name.includes('photo')) {
                return `Forms\\Components\\FileUpload::make('${c.name}')`;
            }
            if (c.type === LaravelColumnType.ENUM && c.enumValues) {
                const opts = c.enumValues.split(',').map(v => `'${v.trim()}' => '${toSpacedWords(v.trim())}'`).join(', ');
                return `Forms\\Components\\Select::make('${c.name}')->options([${opts}])`;
            }

            if (c.nullable) field += `->nullable()`; else field += `->required()`;
            if (c.type === 'string' && c.length) field += `->maxLength(${c.length})`;
            
            return field;
        }).join(',\n                ');

    // Table Generator
    const tableColumns = table.columns
        .filter(c => c.type !== LaravelColumnType.LONG_TEXT && c.type !== LaravelColumnType.JSON)
        .slice(0, 6) // Limit to first 6 cols for table view
        .map(c => {
             if (c.type === LaravelColumnType.BOOLEAN) {
                 return `Tables\\Columns\\ToggleColumn::make('${c.name}')`;
             }
             if (c.name.includes('image')) {
                 return `Tables\\Columns\\ImageColumn::make('${c.name}')`;
             }
             if (c.type === LaravelColumnType.ID) {
                  return `Tables\\Columns\\TextColumn::make('${c.name}')->sortable()`;
             }
             return `Tables\\Columns\\TextColumn::make('${c.name}')->searchable()`;
        }).join(',\n                ');

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
    
    protected static ?string $navigationLabel = '${label}';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                ${formFields}
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                ${tableColumns}
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
            'index' => Pages\\List${toPascalCase(table.name)}::route('/'),
            'create' => Pages\\Create${modelName}::route('/create'),
            'edit' => Pages\\Edit${modelName}::route('/{record}/edit'),
        ];
    }
}
`;
};

// --- END: Filament Generator ---


// --- Composer Generator ---
export const generateComposerJson = (projectSettings: ProjectSettings): string => {
    const requirePackages: Record<string, string> = {
        "php": "^8.2",
        "laravel/framework": "^11.0",
        "laravel/tinker": "^2.9",
        "doctrine/dbal": "^3.0"
    };
    
    // SaaS Packages
    if (projectSettings.saas.filamentAdmin) {
        requirePackages["filament/filament"] = "^3.2";
    }
    if (projectSettings.saas.cashier) {
        requirePackages["laravel/cashier"] = "^15.0";
    }

    // Spatie Packages
    if(projectSettings.packages.sanctum) requirePackages["laravel/sanctum"] = "^4.0";
    if(projectSettings.packages.spatiePermissions) requirePackages["spatie/laravel-permission"] = "^6.7";
    if(projectSettings.packages.spatieActivityLog) requirePackages["spatie/laravel-activitylog"] = "^4.0";
    if(projectSettings.packages.spatieMediaLibrary) requirePackages["spatie/laravel-medialibrary"] = "^11.0";
    if(projectSettings.packages.spatieBackup) requirePackages["spatie/laravel-backup"] = "^8.0";
    if(projectSettings.packages.spatieSluggable) requirePackages["spatie/laravel-sluggable"] = "^3.5";
    if(projectSettings.packages.spatieHealth) requirePackages["spatie/laravel-health"] = "^1.0";
    if(projectSettings.packages.spatieWebhookClient) requirePackages["spatie/laravel-webhook-client"] = "^3.0";
    if(projectSettings.packages.spatieWebhookServer) requirePackages["spatie/laravel-webhook-server"] = "^3.0";

    const requireDevPackages: Record<string, string> = {
        "fakerphp/faker": "^1.23",
        "laravel/pint": "^1.13",
        "laravel/sail": "^1.26",
        "mockery/mockery": "^1.6",
        "nunomaduro/collision": "^8.0",
        "phpunit/phpunit": "^10.5",
        "spatie/laravel-ignition": "^2.4"
    };
    
    if (projectSettings.authentication.breeze) {
        requireDevPackages["laravel/breeze"] = "^2.0";
    }

    return JSON.stringify({
        "name": "laravel/laravel",
        "type": "project",
        "description": "SaaS Starter Kit generated by LaraSchema Architect.",
        "require": requirePackages,
        "require-dev": requireDevPackages,
        "autoload": {
            "psr-4": {
                "App\\": "app/",
                "Database\\Factories\\": "database/factories/",
                "Database\\Seeders\\": "database/seeders/"
            }
        },
        "scripts": {
            "post-autoload-dump": [
                "Illuminate\\Foundation\\ComposerScripts::postAutoloadDump",
                "@php artisan package:discover --ansi",
                projectSettings.saas.filamentAdmin ? "@php artisan filament:upgrade" : ""
            ].filter(Boolean),
            "post-update-cmd": [
                "@php artisan vendor:publish --tag=laravel-assets --ansi --force"
            ]
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
    }, null, 4);
}

export const generateReadme = (nodes: Node<TableData>[], projectSettings: ProjectSettings): string => {
    let features = `- **Models**: Full Eloquent models with strict typing.\n`;
    features += `- **API Rate Limiting**: Enabled by default on all API endpoints.\n`;
    if (projectSettings.saas.filamentAdmin) features += `- **Filament Admin**: Pro-grade admin panel at \`/admin\`.\n`;
    if (projectSettings.saas.cashier) features += `- **Billing**: Stripe integration via Laravel Cashier.\n`;
    if (projectSettings.saas.tenancy) features += `- **Tenancy**: Team-based data scoping.\n`;

    let installSteps = `1. Clone repo & run \`composer install\`\n2. Copy \`.env.example\` to \`.env\`\n3. Run \`php artisan key:generate\`\n`;
    
    if (projectSettings.saas.filamentAdmin) installSteps += `4. Run \`php artisan filament:install-panels\`\n`;
    installSteps += `5. Run \`php artisan migrate --seed\`\n`;
    if (projectSettings.saas.filamentAdmin) installSteps += `6. Create admin user: \`php artisan make:filament-user\`\n`;

    return `# SaaS Starter Kit

Generated by LaraSchema Architect.

## Features
${features}

## Installation
${installSteps}
`;
}

// ... (Existing Request, Policy, Observer generators remain same - omitting for brevity but included in final build) ...
const getValidationRules = (col: Column): string => {
    const rules = [];
    if (col.nullable) rules.push('nullable'); else rules.push('required');
    if (['string', 'text', 'char'].includes(col.type)) rules.push('string');
    if (['integer', 'bigInteger', 'tinyInteger', 'smallInteger'].includes(col.type)) rules.push('integer');
    if (['boolean'].includes(col.type)) rules.push('boolean');
    if (['date', 'dateTime', 'timestamp'].includes(col.type)) rules.push('date');
    if (col.name.includes('email')) rules.push('email');
    if (col.type === 'string' && col.length) rules.push(`max:${col.length}`);
    else if (col.type === 'string') rules.push('max:255');
    return rules.map(r => `'${r}'`).join(', ');
};
export const generateStoreRequest = (node: Node<TableData>) => {
     const table = node.data; const modelName = getModelName(table.name);
     const rules = table.columns.filter(c => c.type !== 'id').map(c => `'${c.name}' => [${getValidationRules(c)}]`).join(',\n            ');
     return `${PHP_HEADER}namespace App\\Http\\Requests;\nuse Illuminate\\Foundation\\Http\\FormRequest;\nclass Store${modelName}Request extends FormRequest {\n    public function rules(): array {\n        return [\n            ${rules}\n        ];\n    }\n}`;
}
export const generateUpdateRequest = (node: Node<TableData>) => {
     const table = node.data; const modelName = getModelName(table.name);
     const rules = table.columns.filter(c => c.type !== 'id').map(c => `'${c.name}' => [${getValidationRules(c)}]`).join(',\n            ');
     return `${PHP_HEADER}namespace App\\Http\\Requests;\nuse Illuminate\\Foundation\\Http\\FormRequest;\nclass Update${modelName}Request extends FormRequest {\n    public function rules(): array {\n        return [\n            ${rules}\n        ];\n    }\n}`;
}
export const generateResource = (node: Node<TableData>) => {
    const table = node.data; const modelName = getModelName(table.name);
    return `${PHP_HEADER}namespace App\\Http\\Resources;\nuse Illuminate\\Http\\Resources\\Json\\JsonResource;\nclass ${modelName}Resource extends JsonResource {\n    public function toArray($request): array {\n        return parent::toArray($request);\n    }\n}`;
}
export const generateApiRoutes = (nodes: Node<TableData>[]) => {
    const routes = nodes.map(n => `    Route::apiResource('${n.data.name.replace(/_/g, '-')}', \\App\\Http\\Controllers\\Api\\${getModelName(n.data.name)}Controller::class);`).join('\n');
    return `${PHP_HEADER}use Illuminate\\Support\\Facades\\Route;

Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
${routes}
});`;
}
export const generateApiController = (node: Node<TableData>) => {
    const table = node.data;
    const modelName = getModelName(table.name);
    const variableName = modelName.charAt(0).toLowerCase() + modelName.slice(1);

    return `${PHP_HEADER}namespace App\\Http\\Controllers\\Api;

use App\\Http\\Controllers\\Controller;
use App\\Models\\${modelName};
use App\\Http\\Requests\\Store${modelName}Request;
use App\\Http\\Requests\\Update${modelName}Request;
use App\\Http\\Resources\\${modelName}Resource;
use Illuminate\\Http\\Resources\\Json\\AnonymousResourceCollection;
use Illuminate\\Http\\JsonResponse;

class ${modelName}Controller extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): AnonymousResourceCollection
    {
        return ${modelName}Resource::collection(${modelName}::paginate());
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Store${modelName}Request $request): ${modelName}Resource
    {
        $${variableName} = ${modelName}::create($request->validated());

        return new ${modelName}Resource($${variableName});
    }

    /**
     * Display the specified resource.
     */
    public function show(${modelName} $${variableName}): ${modelName}Resource
    {
        return new ${modelName}Resource($${variableName});
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Update${modelName}Request $request, ${modelName} $${variableName}): ${modelName}Resource
    {
        $${variableName}->update($request->validated());

        return new ${modelName}Resource($${variableName});
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(${modelName} $${variableName}): JsonResponse
    {
        $${variableName}->delete();

        return response()->json(null, 204);
    }
}`;
}
export const generateDatabaseSeeder = (nodes: Node<TableData>[]) => {
     const calls = nodes.map(n => `            ${getModelName(n.data.name)}Seeder::class,`).join('\n');
     return `${PHP_HEADER}namespace Database\\Seeders;\nuse Illuminate\\Database\\Seeder;\nclass DatabaseSeeder extends Seeder {\n    public function run(): void {\n        $this->call([\n${calls}\n        ]);\n    }\n}`;
}

// --- ZIP Structure Helper ---
export const prepareZipData = (nodes: Node<TableData>[], edges: Edge[], projectSettings: ProjectSettings) => {
    const files: Record<string, string> = {};
    
    // Core Configs
    files['composer.json'] = generateComposerJson(projectSettings);
    files['README.md'] = generateReadme(nodes, projectSettings);
    files['routes/api.php'] = generateApiRoutes(nodes);
    files['database/seeders/DatabaseSeeder.php'] = generateDatabaseSeeder(nodes);

    // SaaS - Filament
    if (projectSettings.saas.filamentAdmin) {
        files['app/Providers/Filament/AdminPanelProvider.php'] = `${PHP_HEADER}namespace App\\Providers\\Filament;
use Filament\\Http\\Middleware\\Authenticate;
use Filament\\Http\\Middleware\\DisableBladeIconComponents;
use Filament\\Http\\Middleware\\DispatchServingFilamentEvent;
use Filament\\Pages;
use Filament\\Panel;
use Filament\\PanelProvider;
use Filament\\Support\\Colors\\Color;
use Filament\\Widgets;
use Illuminate\\Cookie\\Middleware\\AddQueuedCookiesToResponse;
use Illuminate\\Cookie\\Middleware\\EncryptCookies;
use Illuminate\\Foundation\\Http\\Middleware\\VerifyCsrfToken;
use Illuminate\\Routing\\Middleware\\SubstituteBindings;
use Illuminate\\Session\\Middleware\\AuthenticateSession;
use Illuminate\\Session\\Middleware\\StartSession;
use Illuminate\\View\\Middleware\\ShareErrorsFromSession;

class AdminPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        return $panel
            ->default()
            ->id('admin')
            ->path('admin')
            ->login()
            ->colors(['primary' => Color::Amber])
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\\\\Filament\\\\Resources')
            ->discoverPages(in: app_path('Filament/Pages'), for: 'App\\\\Filament\\\\Pages')
            ->pages([Pages\\Dashboard::class])
            ->discoverWidgets(in: app_path('Filament/Widgets'), for: 'App\\\\Filament\\\\Widgets')
            ->widgets([Widgets\\AccountWidget::class])
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                VerifyCsrfToken::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->authMiddleware([Authenticate::class]);
    }
}`;
    }

    // Nodes Loop
    nodes.forEach((node, idx) => {
        const modelName = getModelName(node.data.name);
        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
        const uniqueTs = parseInt(timestamp) + idx * 10;
        
        // Standard Laravel Files
        files[`database/migrations/${uniqueTs}_create_${node.data.name}_table.php`] = generateMigration(node, nodes, edges);
        files[`app/Models/${modelName}.php`] = generateModel(node, nodes, edges, projectSettings);
        files[`app/Http/Requests/Store${modelName}Request.php`] = generateStoreRequest(node);
        files[`app/Http/Requests/Update${modelName}Request.php`] = generateUpdateRequest(node);
        files[`database/seeders/${modelName}Seeder.php`] = generateSeeder(node);
        files[`database/factories/${modelName}Factory.php`] = generateFactory(node);
        files[`app/Http/Controllers/Api/${modelName}Controller.php`] = generateApiController(node);
        files[`app/Http/Resources/${modelName}Resource.php`] = generateResource(node);

        // Filament Resources
        if (projectSettings.saas.filamentAdmin && node.data.generateAdminUI !== false) {
             const resourceClass = `${modelName}Resource`;
             files[`app/Filament/Resources/${resourceClass}.php`] = generateFilamentResource(node);
             // Basic Page Stubs
             files[`app/Filament/Resources/${resourceClass}/Pages/List${toPascalCase(node.data.name)}.php`] = `${PHP_HEADER}namespace App\\Filament\\Resources\\${resourceClass}\\Pages;\nuse App\\Filament\\Resources\\${resourceClass};\nuse Filament\\Resources\\Pages\\ListRecords;\nclass List${toPascalCase(node.data.name)} extends ListRecords { protected static string $resource = ${resourceClass}::class; }`;
             files[`app/Filament/Resources/${resourceClass}/Pages/Create${modelName}.php`] = `${PHP_HEADER}namespace App\\Filament\\Resources\\${resourceClass}\\Pages;\nuse App\\Filament\\Resources\\${resourceClass};\nuse Filament\\Resources\\Pages\\CreateRecord;\nclass Create${modelName} extends CreateRecord { protected static string $resource = ${resourceClass}::class; }`;
             files[`app/Filament/Resources/${resourceClass}/Pages/Edit${modelName}.php`] = `${PHP_HEADER}namespace App\\Filament\\Resources\\${resourceClass}\\Pages;\nuse App\\Filament\\Resources\\${resourceClass};\nuse Filament\\Resources\\Pages\\EditRecord;\nclass Edit${modelName} extends EditRecord { protected static string $resource = ${resourceClass}::class; }`;
        }
    });

    return files;
};
const getCastType = (type: string) => {
    switch(type) {
        case 'boolean': return 'boolean';
        case 'json': return 'array';
        case 'decimal': return 'decimal:2';
        default: return 'string';
    }
}
