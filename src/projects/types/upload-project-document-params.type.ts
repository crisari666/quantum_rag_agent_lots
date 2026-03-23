import { ProjectDocumentField } from './project-document-field.type';

export type UploadProjectDocumentParams = {
  projectId: string;
  file: Express.Multer.File;
  field: ProjectDocumentField;
  fileType: string;
};
