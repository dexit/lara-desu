
export interface Column {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  unique: boolean;
  default?: string;
  comment?: string;
  unsigned?: boolean;
  index?: boolean;
  onUpdate?: string;
  onDelete?: string;
  length?: number; // For varchar
  enumValues?: string; // Comma separated values for enums
}

export interface TableData {
  name: string;
  comment?: string;
  columns: Column[];
  softDeletes: boolean;
  timestamps: boolean;
  color?: string;
  generatePolicy?: boolean;
  generateObserver?: boolean;
  generateAdminUI?: boolean; // Legacy Blade UI
  generateSlug?: boolean; // New for Sluggable
}

export type FrontendStack = 'blade' | 'livewire' | 'inertia-vue' | 'inertia-react';

export interface ProjectSettings {
  frontend: {
      stack: FrontendStack;
      installJetstream: boolean;
  };
  authentication: {
    breeze: boolean;
    socialite: boolean;
  };
  saas: {
      filamentAdmin: boolean;
      cashier: boolean;
      tenancy: boolean;
  };
  api: {
    rateLimitRequests: number;
    rateLimitPeriod: number; // in minutes
    generateDtos: boolean;
    generateApiResources: boolean;
    generateDocs: boolean; // Scramble
  };
  devTools: {
      telescope: boolean;
      horizon: boolean;
      debugbar: boolean;
  };
  testing: {
      pest: boolean;
      dusk: boolean;
  };
  packages: {
    sanctum: boolean;
    spatiePermissions: boolean;
    spatieActivityLog: boolean;
    spatieMediaLibrary: boolean;
    spatieBackup: boolean;
    spatieSluggable: boolean;
    spatieHealth: boolean;
    spatieWebhookClient: boolean;
    spatieWebhookServer: boolean;
  };
}

export const AVAILABLE_PACKAGES = {
  // Auth
  BREEZE: { id: 'breeze', name: 'Laravel Breeze', description: 'Complete authentication scaffolding (login, registration).', category: 'Authentication' },
  SOCIALITE: { id: 'socialite', name: 'Laravel Socialite', description: 'OAuth authentication (Google, Facebook, GitHub).', category: 'Authentication' },
  
  // SaaS
  FILAMENT: { id: 'filamentAdmin', name: 'FilamentPHP Admin', description: 'The TALL stack admin panel. Replaces custom Blade views with a pro-grade dashboard.', category: 'SaaS' },
  CASHIER: { id: 'cashier', name: 'Laravel Cashier (Stripe)', description: 'Subscription billing interface for Stripe.', category: 'SaaS' },
  TENANCY: { id: 'tenancy', name: 'Single-DB Multi-tenancy', description: 'Scaffolds a Team model and traits for scoping data.', category: 'SaaS' },

  // Spatie & Utils
  SANCTUM: { id: 'sanctum', name: 'Laravel Sanctum', description: 'API token authentication.', category: 'Packages' },
  SPATIE_PERMISSIONS: { id: 'spatiePermissions', name: 'Spatie Permissions', description: 'Associate users with roles and permissions.', category: 'Packages' },
  SPATIE_ACTIVITYLOG: { id: 'spatieActivityLog', name: 'Spatie Activity Log', description: 'Log activity inside your app.', category: 'Packages' },
  SPATIE_MEDIALIBRARY: { id: 'spatieMediaLibrary', name: 'Spatie Media Library', description: 'Associate files with Eloquent models.', category: 'Packages' },
  SPATIE_BACKUP: { id: 'spatieBackup', name: 'Spatie Backup', description: 'Backup your application files and database.', category: 'Packages' },
  SPATIE_SLUGGABLE: { id: 'spatieSluggable', name: 'Spatie Sluggable', description: 'Create SEO-friendly slugs for models.', category: 'Packages' },
  SPATIE_HEALTH: { id: 'spatieHealth', name: 'Spatie Health', description: 'Monitor the health of your application.', category: 'Packages' },
  SPATIE_WEBHOOK_CLIENT: { id: 'spatieWebhookClient', name: 'Spatie Webhook Client', description: 'Receive webhooks in your app.', category: 'Packages' },
  SPATIE_WEBHOOK_SERVER: { id: 'spatieWebhookServer', name: 'Spatie Webhook Server', description: 'Send webhooks from your app.', category: 'Packages' },
};


export interface SchemaState {
  projectTitle: string;
  nodes: any[];
  edges: any[];
  settings: ProjectSettings;
}

export enum LaravelColumnType {
  // Numeric
  ID = 'id',
  FOREIGN_ID = 'foreignId',
  INTEGER = 'integer',
  BIG_INTEGER = 'bigInteger',
  TINY_INTEGER = 'tinyInteger',
  SMALL_INTEGER = 'smallInteger',
  MEDIUM_INTEGER = 'mediumInteger',
  DECIMAL = 'decimal',
  FLOAT = 'float',
  DOUBLE = 'double',
  
  // String & Text
  STRING = 'string',
  TEXT = 'text',
  MEDIUM_TEXT = 'mediumText',
  LONG_TEXT = 'longText',
  CHAR = 'char',
  
  // Date & Time
  DATE = 'date',
  DATETIME = 'dateTime',
  TIMESTAMP = 'timestamp',
  TIME = 'time',
  YEAR = 'year',
  
  // Logic & Json
  BOOLEAN = 'boolean',
  JSON = 'json',
  ENUM = 'enum',
  
  // Binary & identifiers
  UUID = 'uuid',
  ULID = 'ulid',
  BINARY = 'binary',
  
  // Network & Geo
  MAC_ADDRESS = 'macAddress',
  IP_ADDRESS = 'ipAddress',
  GEOMETRY = 'geometry',
  POINT = 'point',
  
  // Relationships
  MORPHS = 'morphs',
}

export const COL_TYPES = Object.values(LaravelColumnType);

export const DEFAULT_COLUMN: Column = {
  id: '',
  name: 'new_column',
  type: LaravelColumnType.STRING,
  nullable: false,
  unique: false,
};

export interface AiSettings {
    model: string;
    temperature: number;
    topP?: number;
    topK?: number;
    database: 'mysql' | 'sqlite' | 'mariadb' | 'pgsql';
}

export const AVAILABLE_MODELS = [
    { 
        id: 'gemini-flash-latest', 
        name: 'Gemini 2.5 Flash', 
        description: 'Optimized for speed and efficiency. Best for standard schema generation.' 
    },
    { 
        id: 'gemini-2.5-pro', 
        name: 'Gemini 2.5 Pro', 
        description: 'Highest reasoning capability. Ideal for complex domains.' 
    },
    { 
        id: 'chrome-builtin', 
        name: 'Chrome Built-in AI (Nano)', 
        description: 'Runs locally in browser. Zero latency, no API key required. (Experimental)' 
    },
];
