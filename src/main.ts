import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as path from 'path'
import * as utils from '@actions/utils'

async function run(): Promise<void> {
  try {
    const paths = utils.getInputAsArray('paths')

    core.startGroup('Find targets')
    const dockerFiles: string[] = []

    for (const searchPath of paths) {
      const files = await (await glob.create(searchPath, {matchDirectories: false, implicitDescendants: false})).glob()

      for (let dockerFile of files) {
        dockerFile = path.relative(
          process.env['GITHUB_WORKSPACE'] ? process.env['GITHUB_WORKSPACE'] : process.cwd(),
          dockerFile
        )

        core.debug(`Found Dockerfile "${dockerFile}"`)

        dockerFiles.push(dockerFile)
      }
    }
    core.endGroup()

    core.startGroup('Set output')
    core.setOutput('dockerfile', JSON.stringify(dockerFiles))
    core.info(`Dockerfile list: ${dockerFiles}`)
    core.endGroup()
  } catch (error) {
    core.setFailed(error.message)
  }
}

void run()
