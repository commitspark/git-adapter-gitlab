import { ActionModel } from './action.model'
import { EntryDraft, ENTRY_EXTENSION } from '@commitspark/git-adapter'
import { stringify } from 'yaml'

export class EntriesToActionsConverterService {
  convert(
    entryDrafts: EntryDraft[],
    existingIdMap: Map<string, boolean>,
    parentSha: string | undefined,
    pathEntryFolder: string,
  ): ActionModel[] {
    const actions: ActionModel[] = []
    entryDrafts.forEach((entryDraft) => {
      let operation: string
      if (entryDraft.deletion) {
        operation = 'DELETE'
      } else if (existingIdMap.has(entryDraft.id)) {
        operation = 'UPDATE'
      } else {
        operation = 'CREATE'
      }
      actions.push(
        new ActionModel(
          operation,
          stringify({
            metadata: entryDraft.metadata,
            data: entryDraft.data,
          }),
          `${pathEntryFolder}/${entryDraft.id}${ENTRY_EXTENSION}`,
          parentSha,
        ),
      )
    })
    return actions
  }
}
