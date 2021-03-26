import * as core from '@actions/core'
import * as github from '@actions/github'
import * as glob from '@actions/glob'
import * as path from 'path'
import * as semver from 'semver'
import * as utils from '@actions/utils'

interface JobInclude {
  'cache-path': string
  'dockerfile': string
  'image-name': string
  'tags': string
}

interface JobMatrix {
  include: JobInclude[]
}

async function getIncludes(imageName: string, paths: string[], recursive: boolean, latestBranch: string): Promise<JobInclude[]> {
  let returnVal: JobInclude[] = []

  imageName = imageName ? imageName : ['ghcr.io', github.context.repo.owner, github.context.repo.repo].join('/')

  for (const searchPath of paths) {
    let globPattern = path.join(searchPath, recursive ? '**/Dockerfile' : 'Dockerfile')
    let dockerFiles = await (await glob.create(globPattern)).glob()

    for (const dockerFile of dockerFiles) {
      if (!utils.fileExist(dockerFile)) {
        core.warning(`Ignoring path "${dockerFile}" (not a file)`)
        continue
      }

      core.debug(`Found Dockerfile "${dockerFile}"`)

      // Probably cleaner if refactored into a class
      let tagSuffix = path.relative(searchPath, path.dirname(dockerFile))
      let tags = tagsClean(tagsAddSuffix(getTags(latestBranch), tagSuffix))
        .map(tag => [imageName, tag].join(':'))

      returnVal.push({
        'cache-path': path.join(github.context.repo.owner, github.context.repo.repo, tagSuffix),
        'dockerfile': dockerFile,
        'image-name': tags[0],
        'tags': tags.join('\n')
      })
    }
  }
  return returnVal
}

function getTags(latestBranch?: string): string[] {
  if (utils.gitBranchIsLatest(latestBranch)) {
    core.debug(`Git branch matches latest branch: "${latestBranch}`)
    return ['latest']
  }

  let gitRef = utils.getGitRef()
  core.debug(`Git ref: ${gitRef}`)

  if (!utils.gitEventIsPushTag()) {
    core.debug(`Not pushing a tag, will use git ref "${gitRef}" for Docker image tags`)
    return [gitRef]
  }

  let version = semver.parse(gitRef, {loose: true, includePrerelease: true})
  if (!version) {
    core.debug(`Tag is not a valid semver, will use git ref "${gitRef}" for Docker image tags`)
    return [gitRef]
  }

  if (version.prerelease.length) {
    core.debug(`Pre-release version, will use "${version.version}" for Docker image tags`)
    return [version.version]
  }

  core.debug(`Version tag detected, will use "${version.version}" for Docker image tags`)
  return [
    `${version.major}.${version.minor}.${version.patch}`,
    `${version.major}.${version.minor}`,
    `${version.major}`
  ]
}

function tagsAddSuffix(tags: string[], suffix?: string): string[] {
  if (!suffix) {
    return tags
  }

  return tags.map(tag => [tag, suffix].join('-'))
}

function tagsClean(tags: string[]): string[] {
  return tags.map(tag => tag
    // Replace path separators with dashes
    .replace(path.sep, '-')

    // https://docs.docker.com/engine/reference/commandline/tag/
    // A tag name must be valid ASCII and may contain lowercase and uppercase letters, digits, underscores, periods and dashes
    .replace(/[^-a-zA-Z0-9_.]/, '')

    // https://docs.docker.com/engine/reference/commandline/tag/
    // A tag name may not start with a period or a dash and may contain a maximum of 128 characters.
    .replace(/^[.-]+/, '')
    .substr(0, 128)
  )
}


async function run(): Promise<void> {
  try {
    const latestBranch = utils.getInputAsString('latest-branch')
    const paths = utils.getInputAsArray('paths')
    const recursive = utils.getInputAsBool('recursive')
    const imageName = utils.getInputAsString('image-name')

    core.startGroup('Find targets')
    let jobMatrix: JobMatrix = {include: await getIncludes(imageName, paths, recursive, latestBranch)}
    core.endGroup()

    core.startGroup('Set output')
    core.setOutput('matrix', JSON.stringify(jobMatrix))
    core.info(JSON.stringify(jobMatrix, null, 2))
    core.endGroup()

  } catch (error) {
    core.setFailed(error.message)
  }
}

run().then()