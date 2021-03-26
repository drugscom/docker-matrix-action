# Dockerfiles matrix generator action

This action generates job matrix for all Dockerfiles in the project.

## Inputs

### `image-name`

Custom image name. Default to GitHub Container Registry with repository name if empty.

### `latest-branch`

Name of the branch to associate with the "latest" tag. Default `"master"`.

### `paths`

The paths where to look for Dockerfiles. Default `"."` (project root).

### `recursive`

Search for Dockerfiles recursively. Default `"false"`.

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