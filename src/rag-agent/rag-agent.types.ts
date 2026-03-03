export interface RagSearchParams {
  readonly question: string;
  readonly projectId?: string;
  readonly limit?: number;
}

export interface RagSearchResult {
  readonly text: string;
  readonly projectId: string;
  readonly docType: string;
  readonly source: string;
  readonly score: number;
}

export interface WeaviateAdditional {
  readonly distance?: number;
}

export interface WeaviateDocument {
  readonly text?: string;
  readonly projectId?: string;
  readonly docType?: string;
  readonly source?: string;
  readonly _additional?: WeaviateAdditional;
}

export interface WeaviateGraphqlResponse {
  readonly data?: {
    readonly Get?: {
      readonly [key: string]: WeaviateDocument[];
    };
  };
}

export interface WeaviateWhereFilter {
  readonly path: string[];
  readonly operator: 'Equal';
  readonly valueString: string;
}
