import { GitAdapter } from '@commitspark/git-adapter'
import axios from 'axios'
import { setupCache } from 'axios-cache-interceptor'
import {
  createCommit as createCommitFn,
  getEntries as getEntriesFn,
  getLatestCommitHash as getLatestCommitHashFn,
  getSchema as getSchemaFn,
} from './git-lab-adapter.ts'

export interface GitLabRepositoryOptions {
  projectPath: string
  token: string
  pathSchemaFile?: string
  pathEntryFolder?: string
}

const QUERY_CACHE_SECONDS = 10 * 60

export function createAdapter(options: GitLabRepositoryOptions): GitAdapter {
  const axiosCacheInstance = setupCache(axios.create(), {
    ttl: QUERY_CACHE_SECONDS * 1000,
    methods: ['get', 'post'],
  })

  return {
    async getEntries(commitHash: string) {
      return getEntriesFn(options, axiosCacheInstance, commitHash)
    },
    async getSchema(commitHash: string) {
      return getSchemaFn(options, axiosCacheInstance, commitHash)
    },
    async getLatestCommitHash(ref: string) {
      return getLatestCommitHashFn(options, axiosCacheInstance, ref)
    },
    async createCommit(commitDraft) {
      return createCommitFn(options, axiosCacheInstance, commitDraft)
    },
  }
}
