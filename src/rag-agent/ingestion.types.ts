export interface IngestionParams {
  readonly rawText: string;
  readonly projectId: string;
  readonly docType: string;
  readonly source: string;
}

export interface IngestionSourceParams {
  readonly rawText?: string;
  readonly externalUrl?: string;
  readonly source?: string;
  readonly file?: Express.Multer.File;
  readonly projectId: string;
  readonly docType: string;
}

export interface UpdateIngestionSourceParams {
  readonly projectId: string;
  readonly currentDocType: string;
  readonly currentSource: string;
  readonly newDocType?: string;
  readonly newSource?: string;
  readonly rawText?: string;
  readonly externalUrl?: string;
  readonly file?: Express.Multer.File;
}

export interface IngestionResult {
  readonly message: string;
  readonly chunks: number;
  /** Chunks deleted in Weaviate before insert (same projectId + source + docType). */
  readonly previousChunksRemoved: number;
}

export interface VectorizedDocument {
  readonly id: string;
  readonly text: string;
  readonly projectId: string;
  readonly docType: string;
  readonly source: string;
}

