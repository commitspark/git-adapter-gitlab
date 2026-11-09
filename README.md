# Introduction

[Commitspark](https://commitspark.com) is a set of tools to manage structured data with Git through a GraphQL API.

This repository holds code for a [Commitspark Git adapter](https://github.com/commitspark/git-adapter) that provides
access to Git repositories hosted on GitLab (SaaS).

# Installation

```shell
npm i @commitspark/git-adapter-gitlab
```

# Usage

Instantiate the adapter with `createAdapter()`, providing `GitLabRepositoryOptions` with the following parameters:

| Option name       | Required | Default value                       | Description                                     |
|-------------------|----------|-------------------------------------|-------------------------------------------------|
| `projectPath`     | True     |                                     | GitLab (SaaS) project path, e.g. `myorg/myrepo` |
| `token`           | True     |                                     | GitLab (SaaS) personal access token             |
| `pathSchemaFile`  | False    | `commitspark/schema/schema.graphql` | Path to schema file in repository               |
| `pathEntryFolder` | False    | `commitspark/entries/`              | Path to folder for content entries              |

# Commit Precondition and Limitation

The adapter interface requires that a commit is only added to a branch if the branch still points to `parentSha` of
the commit draft, and that a `GitAdapterError` with code `CONFLICT` is thrown otherwise. Callers such as the
Commitspark GraphQL API validate a change against `parentSha` (e.g. entry versions and references) and repeat this
validation on `CONFLICT`, so that no change is written onto a state it was not validated against.

GitLab's API offers no way to move a branch only if it still points to a given commit: `startSha` is rejected for
existing branches, and the server-side check of the branch head before writing cannot be given a commit by the client.
This adapter therefore approximates the precondition:

1. Right before committing, the branch head is compared with `parentSha`; if the branch has moved, `CONFLICT` is
   thrown.
2. Entry files that are updated or deleted are sent with `lastCommitId` set to `parentSha`, so that GitLab rejects the
   commit if any of these files was changed after `parentSha`. Whether an entry is created or updated is decided from
   the entries at `parentSha`, so that GitLab also rejects creating an entry file that was created in the meantime.
3. If GitLab rejects the commit and the branch has moved since `parentSha`, `CONFLICT` is thrown.

**Limitation**: A commit by another writer that lands between the check in step 1 and the commit itself is only
detected if it changes one of the entry files written by this commit. Changes to other entry files within this short
window are not detected. For example, if one writer deletes entry `B` while another writer concurrently creates entry
`A` that references `B`, both commits can succeed and leave `A` with a reference to a non-existent entry. Lost updates
of the written entries themselves cannot occur.

# Example

To use this adapter together with the Commitspark GraphQL API library, your code could be the following:

```typescript
import { createAdapter } from '@commitspark/git-adapter-gitlab'
import { createClient } from '@commitspark/graphql-api'

const gitLabAdapter = createAdapter({
  projectPath: process.env.GITLAB_PROJECT_PATH,
  token: process.env.GITLAB_PERSONAL_ACCESS_TOKEN,
})

const client = await createClient(gitLabAdapter)
```

# License

The code in this repository is licensed under the permissive ISC license (see [LICENSE](LICENSE)).
