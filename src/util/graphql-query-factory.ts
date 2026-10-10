export function createBlobQuery(): string {
  return `
      query Blobs ($projectFullPath: ID!, $ref: String!, $path: String!) {
        project(fullPath: $projectFullPath) {
          name
          repository {
            tree(ref: $ref, path: $path) {
              blobs {
                nodes {
                  path
                  sha
                }
              }
            }
          }
        }
      }
    `
}

export function createBlobContentQuery(): string {
  return `
      query Content ($projectFullPath: ID!, $ref: String!, $paths: [String!]!) {
        project(fullPath: $projectFullPath) {
          name
          repository {
            blobs (ref: $ref, paths: $paths) {
              edges {
                node {
                  path
                  rawBlob
                }
              }
            }
          }
        }
      }
    `
}

export function createCommitMutation(): string {
  return `
      mutation CommitCreate($actions: [CommitAction!]!, $branch: String!, $message: String!, $projectPath: ID!) {
        commitCreate(input: {
          actions: $actions,
          branch: $branch, 
          projectPath: $projectPath,
          message: $message,
          }) {
          commit {
            sha
          }
          errors
        }
      }
    `
}

export function createLatestCommitQuery(): string {
  return `query Content ($projectFullPath: ID!, $ref: String!) {
        project(fullPath: $projectFullPath) {
          name
          repository {
            tree(ref: $ref) {
              lastCommit {
                sha
              }
            }
          }
        }
      }`
}
