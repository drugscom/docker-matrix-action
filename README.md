# Dockerfiles matrix generator action

This action generates job matrix for all Dockerfiles in the project.

## Inputs

### `paths`

The paths where to look for Dockerfiles. Default `"**/Dockerfile"`.

## Outputs

### `dockerfile`

List of Dockerfiles found in the repository.

## Example usage

```yaml
uses: drugscom/docker-matrix-action@v1
with:
  paths: 'docker/**/Dockerfile'
```