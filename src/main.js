const fs = require('fs');
const glob = require('glob');
const path = require('path');

const core = require('@actions/core');
const github = require('@actions/github');
const semver = require('semver');

const gitRefRegex = /^refs\/(:?heads|tags)\//;

function getTags(gitRef) {
    const latestBranch = core.getInput('latest-branch');
    const latestRegex = new RegExp(`^refs/heads/${latestBranch}`);

    if (gitRef.match(latestRegex)) {
        return ['latest'];
    }

    let gitRefClean = gitRef.replace(gitRefRegex, '');

    if (gitRef.match(/^refs\/tags\//)) {
        let tagVersion = semver.parse(gitRefClean, {loose: true, includePrerelease: true});
        if (tagVersion) {
            if (tagVersion.prerelease.length) {
                return [tagVersion.version];
            }

            return [
                `${tagVersion.major}.${tagVersion.minor}.${tagVersion.patch}`,
                `${tagVersion.major}.${tagVersion.minor}`,
                `${tagVersion.major}`,
            ];
        }
    }

    return [gitRefClean];
}


try {
    const paths = core.getInput('paths');
    const recursive = core.getInput('recursive');
    const tagPrefixInput = core.getInput('tag-prefix');

    includes = [];
    jobMatrix = {'include': includes};

    if (!github.context.ref.match(gitRefRegex)) {
        core.setFailed(`Received "${github.context.eventName}" event with invalid ref: ${github.context.ref}` );
    }

    core.startGroup('Find targets');
    for (let line of paths.split('\n')) {
        for (let dir of line.split(',')) {
            let globPath = path.join(dir, 'Dockerfile');
            if (recursive === 'true') {
                globPath = path.join(dir, '**/Dockerfile');
            }

            for (let dockerFile of glob.sync(globPath)) {
                if (fs.lstatSync(dockerFile).isDirectory()) {
                    core.warning(`Ignoring directory "${dockerFile}"`);
                    continue;
                }

                let dockerFilePath = path.dirname(dockerFile);
                core.info(`Found Dockerfile on "${dockerFilePath}"`);

                let cachePath = path.join(github.context.repo.owner, github.context.repo.repo, dockerFilePath);

                let tags = getTags(github.context.ref);

                let tagPrefix = ['ghcr.io', github.context.repo.owner, github.context.repo.repo].join('/');
                if (tagPrefixInput !== '') {
                    tagPrefix = tagPrefixInput;
                }

                let tagSuffix = path.relative(dir, dockerFilePath);
                if (tagSuffix) {
                    tags = tags.map((tag) => [tag, tagSuffix].join('-'));
                }

                tags = tags.map((tag) => tag.replace('/', '-'));
                tags = tags.map((tag) => tag.replace(/[^-a-zA-Z0-9_.]/, ''));
                tags = tags.map((tag) => [tagPrefix, tag].join(':').substr(0, 128));

                includes.push({
                    'cache-path': cachePath,
                    'dockerfile': dockerFile,
                    'image-name': tags[0],
                    'tags': tags.join('\n'),
                });
            }
        }
    }
    core.endGroup();

    core.startGroup('Set output');
    core.info(JSON.stringify(jobMatrix, null, 2));
    core.setOutput('matrix', JSON.stringify(jobMatrix));
    core.endGroup();

} catch (error) {
    core.setFailed(error.message);
}
