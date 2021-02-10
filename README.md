# Dockerfiles matrix generator action

This action generates job matrix for all Dockerfiles in the project.

## Inputs

### `latest-branch`

Name of the branch to associate with the "latest" tag. Default `"master"`.

### `paths`

The paths where to look for Dockerfiles. Default `"."` (project root).

### `recursive`

Search for Dockerfiles recursively. Default `"false"`.

### `tag-prefix`

Custom image tag prefix.

## Outputs

### `matrix`

The job matrix.

## Example usage

```yaml
uses: drugscom/docker-matrix-action@v1
with:
  paths: 'docker'
  recursive: true
```