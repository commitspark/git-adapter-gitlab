import {
  createBlobContentQuery,
  createBlobQuery,
  createCommitMutation,
  createLatestCommitQuery,
} from './util/graphql-query-factory.ts'
import {
  Commit,
  CommitDraft,
  Entry,
  EntryHash,
  isHiddenPath,
  validateEntryId,
} from '@commitspark/git-adapter'
import { convertEntriesToActions } from './util/entries-to-actions-converter.ts'
import { ActionModel } from './model/action.model.ts'
import { parse } from 'yaml'
import { AxiosCacheInstance } from 'axios-cache-interceptor'
import { GitLabRepositoryOptions } from './index.ts'
import {
  getEntryIdFromPath,
  getPathEntry,
  getPathEntryFolder,
  getPathSchema,
} from './util/path-factory.ts'
import { ENTRY_EXTENSION } from './util/types.ts'

// symbolic links are stored as blobs, but are not files
const SYMBOLIC_LINK_MODE = '120000'
// number of blob paths requested at once; the complexity score of a blob query grows by about 2 per path, and GitLab
// rejects queries scoring above 200 (unauthenticated) or 250 (authenticated)
const BLOB_PATHS_BATCH_SIZE = 50

interface Connection<T> {
  nodes: T[]
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
}

async function fetchAllNodes<T>(
  fetchPage: (after: string | null) => Promise<Connection<T>>,
): Promise<T[]> {
  const nodes: T[] = []
  let after: string | null = null
  do {
    const connection: Connection<T> = await fetchPage(after)
    nodes.push(...connection.nodes)
    after = connection.pageInfo.hasNextPage
      ? connection.pageInfo.endCursor
      : null
  } while (after !== null)
  return nodes
}

export async function getEntryHashes(
  gitRepositoryOptions: GitLabRepositoryOptions,
  axiosCacheInstance: AxiosCacheInstance,
  commitHash: string,
): Promise<EntryHash[]> {
  const projectPath = gitRepositoryOptions.projectPath
  const token = gitRepositoryOptions.token
  const pathEntryFolder = getPathEntryFolder(gitRepositoryOptions)

  const queryBlobs = createBlobQuery()
  const blobs = await fetchAllNodes<{
    path: string
    sha: string
    mode: string
  }>(async (after) => {
    const filesResponse = await axiosCacheInstance.post(
      'https://gitlab.com/api/graphql',
      {
        query: queryBlobs,
        variables: {
          projectFullPath: projectPath,
          ref: commitHash,
          path: pathEntryFolder,
          after: after,
        },
      },
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    )
    return filesResponse.data.data.project.repository.tree.blobs
  })

  return blobs
    .filter(
      (blob) =>
        blob.mode !== SYMBOLIC_LINK_MODE &&
        blob.path.startsWith(pathEntryFolder) &&
        blob.path.endsWith(ENTRY_EXTENSION) &&
        !isHiddenPath(blob.path.substring(pathEntryFolder.length)),
    )
    .map((blob) => ({
      id: getEntryIdFromPath(gitRepositoryOptions, blob.path),
      hash: blob.sha,
    }))
}

async function getBlobContents(
  gitRepositoryOptions: GitLabRepositoryOptions,
  axiosCacheInstance: AxiosCacheInstance,
  commitHash: string,
  paths: string[],
): Promise<{ path: string; rawBlob: string }[]> {
  const queryContent = createBlobContentQuery()
  const blobs: { path: string; rawBlob: string }[] = []
  for (let index = 0; index < paths.length; index += BLOB_PATHS_BATCH_SIZE) {
    const batchPaths = paths.slice(index, index + BLOB_PATHS_BATCH_SIZE)
    blobs.push(
      ...(await fetchAllNodes<{ path: string; rawBlob: string }>(
        async (after) => {
          const contentResponse = await axiosCacheInstance.post(
            'https://gitlab.com/api/graphql',
            {
              query: queryContent,
              variables: {
                projectFullPath: gitRepositoryOptions.projectPath,
                ref: commitHash,
                paths: batchPaths,
                after: after,
              },
            },
            {
              headers: {
                authorization: `Bearer ${gitRepositoryOptions.token}`,
              },
            },
          )
          return contentResponse.data.data.project.repository.blobs
        },
      )),
    )
  }
  return blobs
}

export async function getEntriesByIds(
  gitRepositoryOptions: GitLabRepositoryOptions,
  axiosCacheInstance: AxiosCacheInstance,
  commitHash: string,
  ids: string[],
): Promise<Entry[]> {
  ids.forEach(validateEntryId)
  if (ids.length === 0) {
    return []
  }

  const blobs = await getBlobContents(
    gitRepositoryOptions,
    axiosCacheInstance,
    commitHash,
    ids.map((id) => getPathEntry(gitRepositoryOptions, id)),
  )

  return blobs.map((blob) => {
    const content = parse(blob.rawBlob)
    return {
      id: getEntryIdFromPath(gitRepositoryOptions, blob.path),
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
  const schemaFilePath = getPathSchema(gitRepositoryOptions)

  const blobs = await getBlobContents(
    gitRepositoryOptions,
    axiosCacheInstance,
    commitHash,
    [schemaFilePath],
  )

  if (blobs.length === 0) {
    throw new Error(
      `"${schemaFilePath}" not found in Git repository "${projectPath}" at commit "${commitHash}"`,
    )
  }

  return blobs[0].rawBlob
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
  commitDraft.entries.forEach((entryDraft) => validateEntryId(entryDraft.id))
  const projectPath = gitRepositoryOptions.projectPath
  const token = gitRepositoryOptions.token
  const pathEntryFolder = getPathEntryFolder(gitRepositoryOptions)

  // assumes branch/ref already exists
  const existingEntryHashes = await getEntryHashes(
    gitRepositoryOptions,
    axiosCacheInstance,
    commitDraft.ref,
  )
  const existingIdMap = new Map<string, boolean>()
  existingEntryHashes.forEach((entryHash) =>
    existingIdMap.set(entryHash.id, true),
  )

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
