/**
 * Core Domain Types and Interfaces for Mycelium Mind
 */

export interface SourceReference {
  resource: string;
  title: string;
}

export interface GenerationMetadata {
  by: string;
  at: string;
}

export interface SummaryFrontmatter {
  type: 'Summary';
  title: string;
  generated?: GenerationMetadata;
  status?: 'draft' | 'stable' | 'deprecated';
  sources?: SourceReference[];
  assets?: string[];
  tags?: string[];
  [key: string]: any;
}

export interface EntityCardMetadata {
  type: string;
  title?: string;
  name?: string;
  description?: string;
  generated?: GenerationMetadata;
  status?: 'draft' | 'stable' | 'deprecated';
  sources?: SourceReference[];
  tags?: string[];
  [key: string]: any;
}

export interface IngestionAsset {
  fileName: string;
  baseName: string;
  extension: string;
  isMarkdown: boolean;
  filePath: string;
  hasCompanionMarkdown: boolean;
  companionMarkdownPath?: string;
}

export interface ExtractedAssetContent {
  rawText: string;
  companionMetadata?: string;
  referencedAssets: string[];
}

export interface CompilerStats {
  summariesSuccess: number;
  summariesFailed: number;
  entitiesSuccess: Record<string, number>;
  entitiesFailed: Record<string, number>;
  overviewsSuccess: number;
  overviewsFailed: number;
  indexesSuccess: number;
  indexesFailed: number;
}

export interface IngestionConfig {
  concurrency?: number;
  inbox_chunk_size?: number;
  inboxChunkSize?: number;
  max_summaries_per_entity?: number;
  maxSummariesPerEntity?: number;
}

export interface NotebookModelEntryConfig {
  name?: string;
  provider?: string;
  apiUrl?: string;
  api_url?: string;
  apiKey?: string;
  api_key?: string;
}

export interface NotebookModelsConfig {
  chat?: string | NotebookModelEntryConfig;
  summary?: string | NotebookModelEntryConfig;
  transformation?: string | NotebookModelEntryConfig;
  embedding?: string | NotebookModelEntryConfig;
  stt?: string | NotebookModelEntryConfig;
  tts?: string | NotebookModelEntryConfig;
  podcast?: string | NotebookModelEntryConfig;
  provider?: string;
  apiUrl?: string;
  api_url?: string;
  apiKey?: string;
  api_key?: string;
}

export interface WikiConfig {
  parallelPromptExecution?: boolean;
  ingestion?: IngestionConfig;
  baseModelName?: string;
  baseModelApiUrl?: string;
  baseModelApiKey?: string;
  ocrModelName?: string;
  ocrModelApiUrl?: string;
  ocrModelApiKey?: string;
  overviews?: {
    script_timeout_ms?: number;
  };
  rag?: {
    transport?: 'stdio' | 'sse';
    host?: string;
    port?: number;
    chromadb_wal?: boolean;
    rate_limiting?: {
      enabled?: boolean;
      requests_per_minute?: number;
      burst?: number;
    };
    prometheus?: {
      enabled?: boolean;
      port?: number;
    };
  };
  notebook?: {
    url?: string;
    apiKey?: string;
    api_key?: string;
    name?: string;
    target?: string;
    id?: string;
    notebook_id?: string;
    filter?: {
      collections?: boolean;
      summaries?: boolean;
      overviews?: boolean;
    };
    concurrency?: number;
    model_api_url?: string;
    modelApiUrl?: string;
    model_api_key?: string;
    modelApiKey?: string;
    model_provider?: string;
    modelProvider?: string;
    models?: NotebookModelsConfig;
  };
  [key: string]: any;
}

export interface CliFlags {
  pr: boolean;
  verbose: boolean;
  force: boolean;
  from?: string;
  transport?: string;
  port?: number;
  host?: string;
  rateLimit?: number;
  prometheusPort?: number;
  chromadbWal?: boolean;
  collection?: string;
  notebook?: string;
  notebookId?: string;
  notebookUrl?: string;
  apiKey?: string;
  prune?: boolean;
  dryRun?: boolean;
  filter?: string;
  colima?: boolean;
  concurrency?: number;
  configure?: boolean;
}


