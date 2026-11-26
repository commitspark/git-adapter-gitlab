import { GitAdapter } from '@commitspark/git-adapter'
import axios from 'axios'
import {
  createCommit as createCommitFn,
  getEntriesByIds as getEntriesByIdsFn,
  getEntryHashes as getEntryHashesFn,
  getLatestCommitHash as getLatestCommitHashFn,
  getSchema as getSchemaFn,
} from './git-lab-adapter.ts'

export interface GitLabRepositoryOptions {
  projectPath: string
  token: string
  pathSchemaFile?: string
  pathEntryFolder?: string
}

export function createAdapter(options: GitLabRepositoryOptions): GitAdapter {
  const axiosInstance = axios.create()

  return {
    async getEntryHashes(commitHash: string) {
      return getEntryHashesFn(options, axiosInstance, commitHash)
    },
    async getEntriesByIds(commitHash: string, ids: string[]) {
      return getEntriesByIdsFn(options, axiosInstance, commitHash, ids)
    },
    async getSchema(commitHash: string) {
      return getSchemaFn(options, axiosInstance, commitHash)
    },
    async getLatestCommitHash(ref: string) {
      return getLatestCommitHashFn(options, axiosInstance, ref)
    },
    async createCommit(commitDraft) {
      return createCommitFn(options, axiosInstance, commitDraft)
    },
  }
}
