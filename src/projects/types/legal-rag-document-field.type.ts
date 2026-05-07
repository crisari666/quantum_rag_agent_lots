export const MAX_LEGAL_RAG_DOC_FILENAME_LENGTH = 512 as const;

/**
 * Ingestion `docType` values that sync a stored RAG filename onto `Project`.
 */
export const LEGAL_RAG_INGESTION_DOC_TYPES = [
  'rut',
  'business_registration',
  'bank_certificate',
  'libertarian_certificate',
] as const;

export type LegalRagIngestionDocType =
  (typeof LEGAL_RAG_INGESTION_DOC_TYPES)[number];

export type ProjectLegalRagDocumentField =
  | 'legalRut'
  | 'legalBusinessRegistration'
  | 'legalBankCertificate'
  | 'legalLibertarianCertificate';

export function isLegalRagIngestionDocType(
  docType: string,
): docType is LegalRagIngestionDocType {
  return (LEGAL_RAG_INGESTION_DOC_TYPES as readonly string[]).includes(
    docType,
  );
}

export function projectFieldForLegalRagDocType(
  docType: LegalRagIngestionDocType,
): ProjectLegalRagDocumentField {
  switch (docType) {
    case 'rut':
      return 'legalRut';
    case 'business_registration':
      return 'legalBusinessRegistration';
    case 'bank_certificate':
      return 'legalBankCertificate';
    case 'libertarian_certificate':
      return 'legalLibertarianCertificate';
    default: {
      const _exhaustive: never = docType;
      return _exhaustive;
    }
  }
}
