

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
}

export interface ProjectSettings {
  packages: {
    sanctum: boolean;
    spatiePermissions: boolean;
  };
}

export const AVAILABLE_PACKAGES = {
  SANCTUM: { id: 'sanctum', name: 'Laravel Sanctum', description: 'API token authentication.' },
  SPATIE_PERMISSIONS: { id: 'spatiePermissions', name: 'Spatie Permissions', description: 'Role and permission management.' },
};


export interface SchemaState {
  tables: Record<string, TableData>; 
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
        description: 'Optimized for speed and efficiency. Best for standard schema generation and rapid prototyping.' 
    },
    { 
        id: 'gemini-2.5-pro', 
        name: 'Gemini 2.5 Pro', 
        description: 'Highest reasoning capability. Ideal for complex domains, intricate relationships, and advanced logic.' 
    },
    { 
        id: 'gemini-3-pro-preview', 
        name: 'Gemini 3.0 Pro (Preview)', 
        description: 'Highest reasoning capability. Ideal for complex domains, intricate relationships, and advanced logic.' 
    },
];