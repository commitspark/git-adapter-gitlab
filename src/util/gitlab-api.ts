import { AxiosError, AxiosInstance } from 'axios'
import { ErrorCode, GitAdapterError } from '@commitspark/git-adapter'
import { GitLabRepositoryOptions } from '../index.ts'

const GITLAB_GRAPHQL_API_URL = 'https://gitlab.com/api/graphql'

const httpStatusErrorCodes: Record<number, ErrorCode> = {
  400: ErrorCode.BAD_REQUEST,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  429: ErrorCode.TOO_MANY_REQUESTS,
}

/**
 * Sends a query to the GitLab GraphQL API and returns its `data`. Failed requests and GraphQL errors are thrown as
 * `GitAdapterError`. GitLab's GraphQL errors have no documented types, so they are reported as `INTERNAL_ERROR`.
 */
export async function postGraphQL<T>(
  gitRepositoryOptions: GitLabRepositoryOptions,
  axiosInstance: AxiosInstance,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  let response
  try {
    response = await axiosInstance.post<{ data?: T; errors?: unknown }>(
      GITLAB_GRAPHQL_API_URL,
      { query, variables },
      {
        headers: { authorization: `Bearer ${gitRepositoryOptions.token}` },
      },
    )
  } catch (error) {
    if (error instanceof AxiosError) {
      const status = error.response?.status
      throw new GitAdapterError(
        (status !== undefined && httpStatusErrorCodes[status]) ||
          ErrorCode.INTERNAL_ERROR,
        `GitLab request failed: ${error.message}`,
      )
    }
    throw new GitAdapterError(
      ErrorCode.INTERNAL_ERROR,
      `GitLab request failed: ${(error as Error).message}`,
    )
  }

  if (response.data.errors) {
    throw new GitAdapterError(
      ErrorCode.INTERNAL_ERROR,
      `GitLab request failed: ${JSON.stringify(response.data.errors)}`,
    )
  }
  return response.data.data as T
}

export interface ProjectResponse<R> {
  project: { repository: R | null } | null
}

/**
 * Returns the repository of a query response. GitLab returns `null` without an error if the project does not exist or
 * the token may not read it or its repository, so these cases cannot be told apart.
 */
export function getRepository<R>(
  gitRepositoryOptions: GitLabRepositoryOptions,
  data: ProjectResponse<R>,
): R {
  const repository = data.project?.repository
  if (!repository) {
    throw new GitAdapterError(
      ErrorCode.NOT_FOUND,
      `Repository of GitLab project "${gitRepositoryOptions.projectPath}" not found or not readable with the given token`,
    )
  }
  return repository
}

/**
 * Throws `NOT_FOUND` if the commit queried together with files does not exist, as GitLab then returns no files instead
 * of an error.
 */
export function assertCommitFound(
  gitRepositoryOptions: GitLabRepositoryOptions,
  commit: { sha: string } | null,
  commitHash: string,
): void {
  if (!commit) {
    throw new GitAdapterError(
      ErrorCode.NOT_FOUND,
      `Commit "${commitHash}" not found in GitLab project "${gitRepositoryOptions.projectPath}"`,
    )
  }
}
