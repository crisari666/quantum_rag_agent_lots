export interface IngestionParams {
  readonly rawText: string;
  readonly projectId: string;
  readonly docType: string;
  readonly source: string;
}

export interface IngestionResult {
  readonly message: string;
  readonly chunks: number;
}

