const fs = require('fs');
const glob = require('glob');
const path = require('path');

const core = require('@actions/core');
const github = require('@actions/github');

try {
    const paths = core.getInput('paths');
    const latestBranch = core.getInput('latest-branch');
    const recursive = core.getInput('recursive');
    const tagPrefixInput = core.getInput('tag-prefix');

    includes = [];
    jobMatrix = {'include': includes};

    core.startGroup('Finding targets');
    for (let line of paths.split('\n')) {
        for (let dir of line.split(',')) {
            let globPath = path.join(dir, 'Dockerfile');
            if (recursive) {
                globPath = path.join(dir, '**/Dockerfile');
            }

            for (let dockerFile of glob.sync(globPath)) {
                if (fs.lstatSync(dockerFile).isDirectory()) {
                    core.info('Ignoring ' + dockerFile + ' (is a directory)');
                    continue;
                }
                core.info('Found ' + dockerFile);

                let dockerFilePath = path.dirname(dockerFile);

                let cachePath = path.join(github.context.repo.owner, github.context.repo.repo, dockerFilePath);
                let tags = [];
                let tagPrefix = ['ghcr.io', github.context.repo.owner, github.context.repo.repo].join('/');
                if (tagPrefixInput !== '') {
                    tagPrefix = tagPrefixInput;
                }
                let tagSuffix = path.relative(dir, dockerFilePath).replace(path.sep, '-');

                if (github.context.eventName === 'push') {
                    let branchName = github.context.ref.replace(/^refs\/heads\//, '');
                    branchName = branchName.replace('/', '-');
                    branchName = branchName.replace(/[^-a-zA-Z0-9_.]/, '');

                    if (branchName === latestBranch) {
                        tags = ['latest'];
                    } else {
                        tags = [branchName];
                    }
                } else if (github.context.eventName === 'label') {
                    let label = github.context.ref.replace(/^refs\/tags\//, '');

                    if (label.match(/^v?[0-9]+(?:\.[0-9]+(?:\.[0-9]+)?)?(?:-?(?:b|beta)[0-9]+)?$/)) {
                        label = label.replace(/^v/, '');

                        if (!label.match(/(?:b|beta)[0-9]+$/)) {
                            while (label.match(/\./)) {
                                tags.push(label);
                                label = label.replace(/\.[^.]*$/, '');
                            }
                        }
                    }

                    tags.push(label);
                }

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
