import { GitLabRepositoryOptions } from '../index.ts'
import { PATH_ENTRY_FOLDER, PATH_SCHEMA_FILE } from './types.ts'

export function getPathSchema(
  gitRepositoryOptions: GitLabRepositoryOptions,
): string {
  return gitRepositoryOptions.pathSchemaFile ?? PATH_SCHEMA_FILE
}

export function getPathEntryFolder(
  gitRepositoryOptions: GitLabRepositoryOptions,
): string {
  const pathEntryFolder =
    gitRepositoryOptions.pathEntryFolder ?? PATH_ENTRY_FOLDER

  if (!pathEntryFolder.endsWith('/')) {
    return pathEntryFolder + '/'
  }

  return pathEntryFolder
}
