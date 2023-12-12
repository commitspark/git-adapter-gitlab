import { GitLabRepositoryOptions } from './index'
import { PATH_ENTRY_FOLDER, PATH_SCHEMA_FILE } from '@commitspark/git-adapter'

export class PathFactoryService {
  public getPathSchema(gitRepositoryOptions: GitLabRepositoryOptions) {
    return gitRepositoryOptions.pathSchemaFile ?? PATH_SCHEMA_FILE
  }

  public getPathEntryFolder(
    gitRepositoryOptions: GitLabRepositoryOptions,
  ): string {
    const pathEntryFolder =
      gitRepositoryOptions.pathEntryFolder ?? PATH_ENTRY_FOLDER

    if (pathEntryFolder.endsWith('/')) {
      return pathEntryFolder.substring(0, pathEntryFolder.length - 1)
    }

    return pathEntryFolder
  }
}
