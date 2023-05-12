import { GitAdapter, GitRepositoryOptions } from '@commitspark/git-adapter'
import { gitLabAdapterService } from './container'

export { GitLabAdapterService } from './git-lab-adapter.service'

export interface GitLabRepositoryOptions extends GitRepositoryOptions {
  projectPath: string
  token: string
  pathSchemaFile?: string
  pathEntryFolder?: string
}

export function createAdapter(): GitAdapter {
  return gitLabAdapterService
}
