import { convertEntriesToActions } from '../../../src/util/entries-to-actions-converter'
import { EntryDraft } from '@commitspark/git-adapter'

describe('entries-to-actions-converter', () => {
  it('should handle actions without double slashes', () => {
    const pathEntryFolder = 'commitspark/entries/'
    const entryDrafts: EntryDraft[] = [
      {
        id: 'my-id',
        metadata: { type: 'my-type' },
        data: {},
        deletion: false,
      },
    ]
    const existingIdMap = new Map<string, boolean>()
    const parentSha = 'abc'

    const actions = convertEntriesToActions(
      entryDrafts,
      existingIdMap,
      parentSha,
      pathEntryFolder,
    )

    expect(actions[0].filePath).toBe('commitspark/entries/my-id.yaml')
  })

  it('should throw an error if pathEntryFolder does not end with a slash', () => {
    const pathEntryFolder = 'commitspark/entries'
    const entryDrafts: EntryDraft[] = []
    const existingIdMap = new Map<string, boolean>()
    const parentSha = 'abc'

    expect(() =>
      convertEntriesToActions(
        entryDrafts,
        existingIdMap,
        parentSha,
        pathEntryFolder,
      ),
    ).toThrow()
  })
})
