import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as path from 'path'
import * as utils from '@actions/utils'

interface Dockerfile {
  path: string
  suffix: string
}

async function run(): Promise<void> {
  try {
    const paths = utils.getInputAsArray('paths')
    const suffixReplace = utils.getInputAsArray('suffix-replace')

    core.startGroup('Find targets')
    const dockerFiles: Dockerfile[] = []

    for (const searchPath of paths) {
      const files = await (await glob.create(searchPath, {matchDirectories: false, implicitDescendants: false})).glob()

      for (let dockerFile of files) {
        dockerFile = path.relative(
          process.env['GITHUB_WORKSPACE'] ? process.env['GITHUB_WORKSPACE'] : process.cwd(),
          dockerFile
        )

        core.debug(`Found Dockerfile "${dockerFile}"`)

        let suffix
        if (dockerFile.match(/Dockerfile-[^/]+$/)) {
          suffix = dockerFile.replace(/Dockerfile-([^/]+)$/, '$1')
        } else {
          suffix = dockerFile.replace(/\/?Dockerfile$/, '')
        }

        for (const regex of suffixReplace) {
          if (regex.startsWith('/')) {
            const [searchPattern, replaceValue, regexFlags] = regex.substring(1).split('/')
            suffix = suffix.replace(new RegExp(searchPattern, regexFlags), replaceValue)
          } else {
            suffix = suffix.replace(new RegExp(regex), '')
          }
        }

        suffix = suffix.replace(/\//g, '-')

        if (suffix) {
          suffix = `-${suffix}`
        }

        core.debug(`Docker tag suffix: ${suffix}`)

        dockerFiles.push({
          path: dockerFile,
          suffix
        })
      }
    }
    core.endGroup()

    core.startGroup('Set output')
    core.setOutput('dockerfile', JSON.stringify(dockerFiles))
    core.info(`Result: ${JSON.stringify(dockerFiles, null, 2)}`)
    core.endGroup()
  } catch (error) {
    core.setFailed(error.message)
  }
}

void run()
