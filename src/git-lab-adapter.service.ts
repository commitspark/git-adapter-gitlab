import { GraphqlQueryFactoryService } from './graphql-query-factory.service'
import {
  Commit,
  CommitDraft,
  ContentEntry,
  ENTRY_EXTENSION,
  GitAdapter,
  PATH_ENTRY_FOLDER,
  PATH_SCHEMA_FILE,
} from '@commitspark/git-adapter'
import { ContentEntriesToActionsConverterService } from './content-entries-to-actions-converter.service'
import { ActionModel } from './action.model'
import { parse } from 'yaml'
import { AxiosCacheInstance } from 'axios-cache-interceptor'
import { GitLabRepositoryOptions } from './index'
import * as path from 'path'
import { PathFactoryService } from './path-factory.service'

export class GitLabAdapterService implements GitAdapter {
  static readonly QUERY_CACHE_SECONDS = 10 * 60

  private gitRepositoryOptions: GitLabRepositoryOptions | undefined

  constructor(
    private readonly cachedHttpAdapter: AxiosCacheInstance,
    private graphqlQueryFactory: GraphqlQueryFactoryService,
    private contentEntriesToActionsConverter: ContentEntriesToActionsConverterService,
    private pathFactory: PathFactoryService,
  ) {}

  public async setRepositoryOptions(
    repositoryOptions: GitLabRepositoryOptions,
  ): Promise<void> {
    this.gitRepositoryOptions = repositoryOptions
  }

  public async getContentEntries(commitHash: string): Promise<ContentEntry[]> {
    if (this.gitRepositoryOptions === undefined) {
      throw new Error('Repository options must be set before reading')
    }

    const projectPath = this.gitRepositoryOptions.projectPath
    const token = this.gitRepositoryOptions.token
    const pathEntryFolder = this.pathFactory.getPathEntryFolder(
      this.gitRepositoryOptions,
    )

    const queryBlobs = this.graphqlQueryFactory.createBlobQuery()
    const filesResponse = await this.cachedHttpAdapter.post(
      'https://gitlab.com/api/graphql',
      {
        query: queryBlobs,
        variables: {
          projectFullPath: projectPath,
          ref: commitHash,
          path: pathEntryFolder,
        },
      },
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    )
    const allFilePaths: string[] =
      filesResponse.data.data.project.repository.tree.blobs.nodes.map(
        (blob: any) => blob.path,
      )

    const entryFilePaths = allFilePaths.filter((filename: string) =>
      filename.endsWith(ENTRY_EXTENSION),
    )

    const queryContent = this.graphqlQueryFactory.createBlobContentQuery()
    const contentResponse = await this.cachedHttpAdapter.post(
      'https://gitlab.com/api/graphql',
      {
        query: queryContent,
        variables: {
          projectFullPath: projectPath,
          ref: commitHash,
          paths: entryFilePaths,
        },
      },
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    )
    const edges = contentResponse.data.data.project.repository.blobs.edges

    return edges
      .map((edge: any) => edge.node)
      .map((node: any) => {
        const content = parse(node.rawBlob)
        const id = path.parse(node.path).name
        return {
          id: id,
          metadata: content.metadata,
          data: content.data,
        } as ContentEntry
      })
  }

  public async getSchema(commitHash: string): Promise<string> {
    if (this.gitRepositoryOptions === undefined) {
      throw new Error('Repository options must be set before reading')
    }

    const projectPath = this.gitRepositoryOptions.projectPath
    const token = this.gitRepositoryOptions.token
    const schemaFilePath = this.pathFactory.getPathSchema(
      this.gitRepositoryOptions,
    )

    const queryContent = this.graphqlQueryFactory.createBlobContentQuery()
    const response = await this.cachedHttpAdapter.post(
      'https://gitlab.com/api/graphql',
      {
        query: queryContent,
        variables: {
          projectFullPath: projectPath,
          ref: commitHash,
          paths: [schemaFilePath],
        },
      },
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    )
    const edges = response.data.data.project.repository.blobs.edges

    if (edges.length === 0) {
      throw new Error(
        `"${schemaFilePath}" not found in Git repository "${projectPath}" at commit "${commitHash}"`,
      )
    }

    return edges[0].node.rawBlob
  }

  public async getLatestCommitHash(ref: string): Promise<string> {
    if (this.gitRepositoryOptions === undefined) {
      throw new Error('Repository options must be set before reading')
    }

    const projectPath = this.gitRepositoryOptions.projectPath
    const token = this.gitRepositoryOptions.token

    const queryLatestCommit = this.graphqlQueryFactory.createLatestCommitQuery()

    const response = await this.cachedHttpAdapter.post(
      'https://gitlab.com/api/graphql',
      {
        query: queryLatestCommit,
        variables: {
          projectFullPath: projectPath,
          ref: ref,
        },
      },
      {
        cache: false, // must not use cache, so we always get the branch's current head
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    )

    const lastCommit = response.data.data.project.repository.tree.lastCommit
    if (!lastCommit) {
      throw new Error(`No commit found for branch "${ref}"`)
    }

    return lastCommit.sha
  }

  public async createCommit(commitDraft: CommitDraft): Promise<Commit> {
    if (this.gitRepositoryOptions === undefined) {
      throw new Error('Repository options must be set before committing')
    }

    const projectPath = this.gitRepositoryOptions.projectPath
    const token = this.gitRepositoryOptions.token
    const pathEntryFolder = this.pathFactory.getPathEntryFolder(
      this.gitRepositoryOptions,
    )

    // assumes branch/ref already exists
    const existingContentEntries = await this.getContentEntries(commitDraft.ref)
    const existingIdMap = new Map<string, boolean>()
    existingContentEntries.forEach((entry) => existingIdMap.set(entry.id, true))

    const actions: ActionModel[] =
      this.contentEntriesToActionsConverter.convert(
        commitDraft.contentEntries,
        existingIdMap,
        commitDraft.parentSha,
        pathEntryFolder,
      )

    const mutateCommit = this.graphqlQueryFactory.createCommitMutation()
    const response: any = await this.cachedHttpAdapter.post(
      'https://gitlab.com/api/graphql',
      {
        query: mutateCommit,
        variables: {
          actions,
          branch: commitDraft.ref, // if `ref` is a hash and not a branch, commits are rejected by GitLab
          message: commitDraft.message ?? '-',
          projectPath: projectPath,
        },
      },
      {
        cache: false,
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    )

    const mutationResult = response.data.data.commitCreate

    if (mutationResult.errors.length > 0) {
      throw new Error(mutationResult.errors)
    }

    return { ref: mutationResult.commit.sha }
  }
}
