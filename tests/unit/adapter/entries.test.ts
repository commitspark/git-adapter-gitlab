import { AxiosCacheInstance } from 'axios-cache-interceptor'
import { AxiosResponse } from 'axios'
import { ErrorCode } from '@commitspark/git-adapter'
import {
  createCommit,
  getEntriesByIds,
  getEntryHashes,
  getLatestCommitHash,
  getSchema,
} from '../../../src/git-lab-adapter.ts'
import { GitLabRepositoryOptions } from '../../../src/index.ts'

describe('Entries', () => {
  const mockOptions: GitLabRepositoryOptions = {
    projectPath: 'group/project',
    token: 'test-token',
  }

  let mockAxiosInstance: jest.Mocked<AxiosCacheInstance>

  const treeResponse = (
    nodes: { path: string; sha: string; mode: string }[],
    endCursor: string | null = null,
  ) =>
    ({
      data: {
        data: {
          project: {
            repository: {
              tree: {
                blobs: {
                  nodes,
                  pageInfo: { hasNextPage: endCursor !== null, endCursor },
                },
              },
            },
          },
        },
      },
    }) as Partial<AxiosResponse> as AxiosResponse

  const blobsResponse = (
    nodes: { path: string; rawBlob: string }[],
    endCursor: string | null = null,
  ) =>
    ({
      data: {
        data: {
          project: {
            repository: {
              blobs: {
                nodes,
                pageInfo: { hasNextPage: endCursor !== null, endCursor },
              },
            },
          },
        },
      },
    }) as Partial<AxiosResponse> as AxiosResponse

  const postedVariables = (callIndex: number) =>
    (
      mockAxiosInstance.post.mock.calls[callIndex][1] as {
        variables: Record<string, unknown>
      }
    ).variables

  beforeEach(() => {
    mockAxiosInstance = {
      post: jest.fn(),
    } as unknown as jest.Mocked<AxiosCacheInstance>
  })

  describe('getEntryHashes', () => {
    it('should list entry files in subfolders with their path as ID', async () => {
      mockAxiosInstance.post.mockResolvedValue(
        treeResponse([
          { path: 'commitspark/entries/a.yaml', sha: 'sha-a', mode: '100644' },
          {
            path: 'commitspark/entries/blog/2024/b.yaml',
            sha: 'sha-b',
            mode: '100644',
          },
          {
            path: 'commitspark/entries/README.md',
            sha: 'sha-r',
            mode: '100644',
          },
        ]),
      )

      await expect(
        getEntryHashes(mockOptions, mockAxiosInstance, 'abc123'),
      ).resolves.toEqual([
        { id: 'a', hash: 'sha-a' },
        { id: 'blog/2024/b', hash: 'sha-b' },
      ])
      expect(postedVariables(0)).toMatchObject({
        ref: 'abc123',
        path: 'commitspark/entries/',
        after: null,
      })
      expect(
        (mockAxiosInstance.post.mock.calls[0][1] as { query: string }).query,
      ).toContain('recursive: true')
    })

    it('should ignore hidden files and folders and symbolic links', async () => {
      mockAxiosInstance.post.mockResolvedValue(
        treeResponse([
          { path: 'commitspark/entries/.a.yaml', sha: 'sha-a', mode: '100644' },
          { path: 'commitspark/entries/.yaml', sha: 'sha-e', mode: '100644' },
          {
            path: 'commitspark/entries/.hidden/b.yaml',
            sha: 'sha-b',
            mode: '100644',
          },
          {
            path: 'commitspark/entries/folder/.hidden/c.yaml',
            sha: 'sha-c',
            mode: '100644',
          },
          {
            path: 'commitspark/entries/link.yaml',
            sha: 'sha-l',
            mode: '120000',
          },
          {
            path: 'commitspark/entries/folder/d.yaml',
            sha: 'sha-d',
            mode: '100755',
          },
        ]),
      )

      await expect(
        getEntryHashes(mockOptions, mockAxiosInstance, 'abc123'),
      ).resolves.toEqual([{ id: 'folder/d', hash: 'sha-d' }])
    })

    it('should retrieve all pages of the tree', async () => {
      mockAxiosInstance.post
        .mockResolvedValueOnce(
          treeResponse(
            [
              {
                path: 'commitspark/entries/a.yaml',
                sha: 'sha-a',
                mode: '100644',
              },
            ],
            'cursor-1',
          ),
        )
        .mockResolvedValueOnce(
          treeResponse([
            {
              path: 'commitspark/entries/b.yaml',
              sha: 'sha-b',
              mode: '100644',
            },
          ]),
        )

      await expect(
        getEntryHashes(mockOptions, mockAxiosInstance, 'abc123'),
      ).resolves.toEqual([
        { id: 'a', hash: 'sha-a' },
        { id: 'b', hash: 'sha-b' },
      ])
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2)
      expect(postedVariables(1)).toMatchObject({ after: 'cursor-1' })
    })
  })

  describe('getEntriesByIds', () => {
    it('should retrieve entries in subfolders', async () => {
      mockAxiosInstance.post.mockResolvedValue(
        blobsResponse([
          {
            path: 'commitspark/entries/blog/a.yaml',
            rawBlob: 'metadata:\n  type: A\ndata:\n  field: value\n',
          },
        ]),
      )

      await expect(
        getEntriesByIds(mockOptions, mockAxiosInstance, 'abc123', [
          'blog/a',
          'missing',
        ]),
      ).resolves.toEqual([
        { id: 'blog/a', metadata: { type: 'A' }, data: { field: 'value' } },
      ])
      expect(postedVariables(0)).toMatchObject({
        ref: 'abc123',
        paths: [
          'commitspark/entries/blog/a.yaml',
          'commitspark/entries/missing.yaml',
        ],
      })
    })

    it('should request blobs in batches', async () => {
      mockAxiosInstance.post.mockResolvedValue(blobsResponse([]))
      const ids = Array.from({ length: 150 }, (_, index) => `id-${index}`)

      await getEntriesByIds(mockOptions, mockAxiosInstance, 'abc123', ids)

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3)
      expect(postedVariables(0).paths).toHaveLength(50)
      expect(postedVariables(1).paths).toHaveLength(50)
      expect(postedVariables(2).paths).toHaveLength(50)
    })

    it('should not query GitLab when no entries are requested', async () => {
      await expect(
        getEntriesByIds(mockOptions, mockAxiosInstance, 'abc123', []),
      ).resolves.toEqual([])
      expect(mockAxiosInstance.post).not.toHaveBeenCalled()
    })

    it.each([['../schema/schema'], ['.hidden'], ['folder//a']])(
      'should reject invalid entry ID %s without querying GitLab',
      async (id) => {
        await expect(
          getEntriesByIds(mockOptions, mockAxiosInstance, 'abc123', [id]),
        ).rejects.toMatchObject({ code: ErrorCode.BAD_REQUEST })
        expect(mockAxiosInstance.post).not.toHaveBeenCalled()
      },
    )
  })

  describe('getSchema', () => {
    it('should retrieve the schema file', async () => {
      mockAxiosInstance.post.mockResolvedValue(
        blobsResponse([
          {
            path: 'commitspark/schema/schema.graphql',
            rawBlob: 'type A { id: ID! }',
          },
        ]),
      )

      await expect(
        getSchema(mockOptions, mockAxiosInstance, 'abc123'),
      ).resolves.toBe('type A { id: ID! }')
    })
  })

  const headResponse = (sha: string | null) =>
    ({
      data: {
        data: {
          project: {
            repository: { commit: sha === null ? null : { sha: sha } },
          },
        },
      },
    }) as Partial<AxiosResponse> as AxiosResponse

  const commitCreateResponse = (sha: string | null, errors: string[] = []) =>
    ({
      data: {
        data: {
          commitCreate: {
            commit: sha === null ? null : { sha: sha },
            errors: errors,
          },
        },
      },
    }) as Partial<AxiosResponse> as AxiosResponse

  describe('getLatestCommitHash', () => {
    it('should return the commit the ref points to', async () => {
      mockAxiosInstance.post.mockResolvedValue(headResponse('head123'))

      await expect(
        getLatestCommitHash(mockOptions, mockAxiosInstance, 'main'),
      ).resolves.toBe('head123')
      const request = mockAxiosInstance.post.mock.calls[0][1] as {
        query: string
      }
      expect(request.query).toContain('commit(ref: $ref)')
      expect(postedVariables(0)).toMatchObject({ ref: 'main' })
    })

    it('should throw GitAdapterError with NOT_FOUND when the ref does not exist', async () => {
      mockAxiosInstance.post.mockResolvedValue(headResponse(null))

      await expect(
        getLatestCommitHash(mockOptions, mockAxiosInstance, 'missing'),
      ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND })
    })
  })

  describe('createCommit', () => {
    const commitDraft = {
      ref: 'main',
      parentSha: 'parent123',
      message: 'test',
      entries: [
        {
          id: 'existing',
          metadata: { type: 'A' },
          data: {},
          deletion: false,
        },
        { id: 'new', metadata: { type: 'A' }, data: {}, deletion: false },
        { id: 'deleted', metadata: { type: 'A' }, data: {}, deletion: true },
      ],
    }

    const parentTreeResponse = () =>
      treeResponse([
        {
          path: 'commitspark/entries/existing.yaml',
          sha: 'sha-1',
          mode: '100644',
        },
        {
          path: 'commitspark/entries/deleted.yaml',
          sha: 'sha-2',
          mode: '100644',
        },
      ])

    it('should commit with actions based on the parent commit and guard changed files by the parent commit', async () => {
      mockAxiosInstance.post
        .mockResolvedValueOnce(headResponse('parent123'))
        .mockResolvedValueOnce(parentTreeResponse())
        .mockResolvedValueOnce(commitCreateResponse('new123'))

      await expect(
        createCommit(mockOptions, mockAxiosInstance, commitDraft),
      ).resolves.toEqual({ commitHash: 'new123' })

      expect(postedVariables(1)).toMatchObject({ ref: 'parent123' })
      expect(postedVariables(2)).toMatchObject({
        branch: 'main',
        actions: [
          {
            action: 'UPDATE',
            filePath: 'commitspark/entries/existing.yaml',
            lastCommitId: 'parent123',
          },
          {
            action: 'CREATE',
            filePath: 'commitspark/entries/new.yaml',
            lastCommitId: undefined,
          },
          {
            action: 'DELETE',
            filePath: 'commitspark/entries/deleted.yaml',
            lastCommitId: 'parent123',
          },
        ],
      })
    })

    it('should throw GitAdapterError with CONFLICT without committing when the branch has moved', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce(headResponse('concurrent'))

      await expect(
        createCommit(mockOptions, mockAxiosInstance, commitDraft),
      ).rejects.toMatchObject({ code: ErrorCode.CONFLICT })
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1)
    })

    it('should throw GitAdapterError with CONFLICT when GitLab rejects the commit and the branch has moved', async () => {
      mockAxiosInstance.post
        .mockResolvedValueOnce(headResponse('parent123'))
        .mockResolvedValueOnce(parentTreeResponse())
        .mockResolvedValueOnce(
          commitCreateResponse(null, [
            'The file has changed since you started editing it: commitspark/entries/existing.yaml',
          ]),
        )
        .mockResolvedValueOnce(headResponse('concurrent'))

      await expect(
        createCommit(mockOptions, mockAxiosInstance, commitDraft),
      ).rejects.toMatchObject({ code: ErrorCode.CONFLICT })
    })

    it('should throw GitAdapterError with BAD_REQUEST when GitLab rejects the commit and the branch has not moved', async () => {
      mockAxiosInstance.post
        .mockResolvedValueOnce(headResponse('parent123'))
        .mockResolvedValueOnce(parentTreeResponse())
        .mockResolvedValueOnce(
          commitCreateResponse(null, ['You must provide a commit message']),
        )
        .mockResolvedValueOnce(headResponse('parent123'))

      await expect(
        createCommit(mockOptions, mockAxiosInstance, commitDraft),
      ).rejects.toMatchObject({
        code: ErrorCode.BAD_REQUEST,
        message: expect.stringContaining('You must provide a commit message'),
      })
    })

    it('should throw GitAdapterError with INTERNAL_ERROR when GitLab returns GraphQL errors', async () => {
      mockAxiosInstance.post
        .mockResolvedValueOnce(headResponse('parent123'))
        .mockResolvedValueOnce(parentTreeResponse())
        .mockResolvedValueOnce({
          data: { errors: [{ message: 'Internal server error' }] },
        } as Partial<AxiosResponse> as AxiosResponse)

      await expect(
        createCommit(mockOptions, mockAxiosInstance, commitDraft),
      ).rejects.toMatchObject({ code: ErrorCode.INTERNAL_ERROR })
    })

    it('should reject invalid entry IDs without calling GitLab', async () => {
      await expect(
        createCommit(mockOptions, mockAxiosInstance, {
          ref: 'main',
          parentSha: 'abc123',
          message: 'test',
          entries: [
            {
              id: '../schema/schema',
              metadata: { type: 'A' },
              data: null,
              deletion: false,
            },
          ],
        }),
      ).rejects.toMatchObject({ code: ErrorCode.BAD_REQUEST })
      expect(mockAxiosInstance.post).not.toHaveBeenCalled()
    })
  })
})
