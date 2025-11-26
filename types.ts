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
}

export interface TableData {
  name: string;
  comment?: string;
  columns: Column[];
  softDeletes: boolean;
  timestamps: boolean;
  color?: string;
}

export interface SchemaState {
  tables: Record<string, TableData>; 
}

export enum LaravelColumnType {
  ID = 'id',
  FOREIGN_ID = 'foreignId',
  STRING = 'string',
  TEXT = 'text',
  INTEGER = 'integer',
  BIG_INTEGER = 'bigInteger',
  BOOLEAN = 'boolean',
  DECIMAL = 'decimal',
  FLOAT = 'float',
  DATE = 'date',
  DATETIME = 'dateTime',
  TIMESTAMP = 'timestamp',
  JSON = 'json',
  UUID = 'uuid',
  BINARY = 'binary',
  ENUM = 'enum',
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
    database: 'mysql' | 'sqlite' | 'mariadb' | 'pgsql';
}

export const AVAILABLE_MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fastest)', description: 'Best for quick schema drafts' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Reasoning)', description: 'Best for complex logic and relationships' },
];