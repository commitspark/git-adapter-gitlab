import {
  createBlobContentQuery,
  createBlobQuery,
  createCommitMutation,
  createLatestCommitQuery,
} from './util/graphql-query-factory.ts'
import { Commit, CommitDraft, Entry } from '@commitspark/git-adapter'
import { convertEntriesToActions } from './util/entries-to-actions-converter.ts'
import { ActionModel } from './model/action.model.ts'
import { parse } from 'yaml'
import { AxiosCacheInstance } from 'axios-cache-interceptor'
import { GitLabRepositoryOptions } from './index.ts'
import * as path from 'path'
import { getPathEntryFolder, getPathSchema } from './util/path-factory.ts'
import { ENTRY_EXTENSION } from './util/types.ts'

export async function getEntries(
  gitRepositoryOptions: GitLabRepositoryOptions,
  axiosCacheInstance: AxiosCacheInstance,
  commitHash: string,
): Promise<Entry[]> {
  const projectPath = gitRepositoryOptions.projectPath
  const token = gitRepositoryOptions.token
  const pathEntryFolder = getPathEntryFolder(gitRepositoryOptions)

  const queryBlobs = createBlobQuery()
  const filesResponse = await axiosCacheInstance.post(
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

  const queryContent = createBlobContentQuery()
  const contentResponse = await axiosCacheInstance.post(
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
      } as Entry
    })
}

export async function getSchema(
  gitRepositoryOptions: GitLabRepositoryOptions,
  axiosCacheInstance: AxiosCacheInstance,
  commitHash: string,
): Promise<string> {
  const projectPath = gitRepositoryOptions.projectPath
  const token = gitRepositoryOptions.token
  const schemaFilePath = getPathSchema(gitRepositoryOptions)

  const queryContent = createBlobContentQuery()
  const response = await axiosCacheInstance.post(
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

export async function getLatestCommitHash(
  gitRepositoryOptions: GitLabRepositoryOptions,
  axiosCacheInstance: AxiosCacheInstance,
  ref: string,
): Promise<string> {
  const projectPath = gitRepositoryOptions.projectPath
  const token = gitRepositoryOptions.token

  const queryLatestCommit = createLatestCommitQuery()

  const response = await axiosCacheInstance.post(
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

export async function createCommit(
  gitRepositoryOptions: GitLabRepositoryOptions,
  axiosCacheInstance: AxiosCacheInstance,
  commitDraft: CommitDraft,
): Promise<Commit> {
  const projectPath = gitRepositoryOptions.projectPath
  const token = gitRepositoryOptions.token
  const pathEntryFolder = getPathEntryFolder(gitRepositoryOptions)

  // assumes branch/ref already exists
  const existingContentEntries = await getEntries(
    gitRepositoryOptions,
    axiosCacheInstance,
    commitDraft.ref,
  )
  const existingIdMap = new Map<string, boolean>()
  existingContentEntries.forEach((entry) => existingIdMap.set(entry.id, true))

  const actions: ActionModel[] = convertEntriesToActions(
    commitDraft.entries,
    existingIdMap,
    commitDraft.parentSha,
    pathEntryFolder,
  )

  const mutateCommit = createCommitMutation()
  const response: any = await axiosCacheInstance.post(
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

  return { commitHash: mutationResult.commit.sha }
}
