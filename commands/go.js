/*******************************************************************************
 * Copyright (c) 2021 BeeZeeLinx.
 * All rights reserved. Unauthorized copying of this file, via any medium
 * is strictly prohibited
 * Proprietary and confidential.
 * Contributors:
 *     Benoit Perrin <benoit@beezeelinx.com> - initial implementation
 ******************************************************************************/

//@ts-check

'use strict';

const Path = require('path');
const Fs = require('fs-extra');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const tmp = require('tmp-promise');
const _ = require('lodash');
const columnify = require('columnify');
const csvStringify = require('csv-stringify/lib/sync');
const clc = require('cli-color');
const hasBin = require('hasbin');
const licenseTypes = require('../lib/licenses_types');
const Console = require('../lib/console');

const LICENSE_DETECTOR = 'license-detector';

exports.command = 'go <command>';
exports.description = 'Handle go modules licenses';

/**
 *
 *
 * @param {import('yargs').Argv<{ path: string; }>} yargs
 * @return {*}
 */
exports.builder = (yargs) => {
    return yargs
        .command(
            'list <path>',
            'List third party licenses of a go module',
            (yargs) => {
                return yargs
                    .positional(
                        'path',
                        {
                            describe: 'Path to the go module',
                            normalize: true,
                            type: 'string',
                            coerce: Path.resolve
                        }
                    )
                    .check((argv, _options) => {
                        testEnvironment();
                        if (!argv.path || !Fs.pathExistsSync(argv.path) || !Fs.pathExistsSync(Path.resolve(argv.path, 'go.mod'))) {
                            throw new Error('Invalid Go module directory path');
                        }
                        return true;
                    });
            },
            listGo3rdPartyLicenses
        )
        .command(
            'csv <path>',
            'Save list of third party licenses of a go module as a CSV file',
            (yargs) => {
                return yargs
                    .options(
                        {
                            csv: {
                                describe: 'Path to the CSV file to create (default to licenses.csv in module directory',
                                normalize: true,
                                type: 'string',
                                coerce: Path.resolve
                            },
                            quiet: {
                                describe: 'Quiet: do not produce outputs',
                                type: 'boolean',
                                alias: 'q'
                            }
                        }
                    )
                    .positional(
                        'path',
                        {
                            describe: 'Path to the go module',
                            normalize: true,
                            type: 'string',
                            coerce: Path.resolve
                        }
                    )
                    .strict()
                    .check((argv, _options) => {
                        testEnvironment();
                        if (!argv.path || !Fs.pathExistsSync(argv.path) || !Fs.pathExistsSync(Path.resolve(argv.path, 'go.mod'))) {
                            throw new Error('Invalid Go module directory path');
                        }
                        if (argv.csv && !Fs.pathExistsSync(argv.csv)) {
                            throw new Error('Invalid CSV file path');

                        }
                        if (argv.quiet) {
                            Console.enable(false);
                        }
                        return true;
                    });
            },
            saveGo3rdPartyLicenses
        )
        .demandCommand(1, 'must provide a valid subcommand');
};


/**
 *
 * @param {import('yargs').Arguments<{path: string; csv?: string;}>} argv
 */
async function saveGo3rdPartyLicenses(argv) {
    const modulePath = Path.resolve(argv.path);
    const csvPath = Path.resolve(argv.csv || `${Path.resolve(modulePath, 'licenses.csv')}`);

    try {

        // Get licences of all dependencies

        const { main, licenses } = await getLicensesInfo(modulePath);

        if (!main) {
            console.error(clc.red('None main module detected'));
            process.exit(1);
        }

        Console.log('');
        Console.log('Main module:', clc.green(main.Path));
        Console.log(`Create 3rd party licenses file ${clc.cyan(csvPath)}`);

        let hasLicenseError = false;
        const data = licenses.map(licenseInfo => {
            const licenseError = licenseInfo.license.error;
            const licenseName = licenseInfo.license.matches && licenseInfo.license.matches[0] ? licenseInfo.license.matches[0].license : '';

            // Test license

            if (licenseError) {
                console.error(`Error retrieving license of package ${licenseInfo.name}: ${licenseError}`);
                hasLicenseError = true;
            } else if (!licenseTypes.isValidLicense(licenseName) && !licenseTypes.isWhiteListed(licenseInfo.name)) {
                console.error(`Invalid license ${licenseName} for the package ${licenseInfo.name}`);
                hasLicenseError = true;
            }

            return {
                Package: licenseInfo.name,
                Version: licenseInfo.version,
                License: licenseName || '~Unknown License~~',
                error: licenseError,
            };
        });

        if (hasLicenseError) {
            process.exit(1);
        }

        const csvData = csvStringify(data,
            {
                header: true,
                columns: ['Package', 'Version', 'License']
            }
        );

        await Fs.outputFile(csvPath, csvData);

        const errors = data.filter(err => !!err.error);

        if (errors.length > 0) {
            Console.log('');
            Console.log(clc.red('Packages without licenses or license cannot be retrieved'));
            Console.log(
                columnify(
                    errors,
                    {
                        showHeaders: false,
                        columns: ['Package', 'Version', 'error']
                    }
                )
            );
        }
    } catch (error) {
        console.error(error);
        console.error(clc.red(error.toString()));
        process.exit(1);
    }
}

/**
 *
 * @param {import('yargs').Arguments<{path: string;}>} argv
 */
async function listGo3rdPartyLicenses(argv) {
    const modulePath = Path.resolve(argv.path);

    try {

        // Get licences of all dependencies

        const { main, licenses } = await getLicensesInfo(modulePath);

        if (!main) {
            console.error(clc.red('None main module detected'));
            process.exit(1);
        }

        console.log('');
        console.log('Main module:', clc.green(main.Path));
        console.log('');

        const data = licenses.map(licenseInfo => {
            let licenseError = licenseInfo.license.error;
            const licenseName = licenseInfo.license.matches && licenseInfo.license.matches[0] ? licenseInfo.license.matches[0].license : '';

            // Test license

            let validity = -1;
            if (!licenseName) {
                licenseError = 'Missing license information';
            } else {
                const isValid = licenseTypes.isValidLicense(licenseName);
                const isWhiteListed = licenseTypes.isWhiteListed(licenseInfo.name);

                if (isValid || isWhiteListed) {
                    validity = 0;
                    if (isWhiteListed) {
                        validity = 1;
                    }
                }
            }

            return {
                name: licenseInfo.name,
                version: licenseInfo.version,
                license: licenseName,
                error: licenseError,
                validity
            };
        });

        console.log(
            columnify(
                data,
                {
                    showHeaders: false,
                    columns: ['name', 'version', 'license', 'error'],
                    config: {
                        version: {
                            dataTransform: (cell) => {
                                return clc.cyan(cell);
                            }
                        },
                        license: {
                            dataTransform: (cell, _columns, idx) => {
                                return data[idx].validity === 0 ?
                                    clc.green(cell) :
                                    data[idx].validity === 1 ?
                                        clc.magenta(cell) :
                                        clc.red(cell);
                            }
                        },
                        error: {
                            dataTransform: (cell) => {
                                return clc.red(cell);
                            }
                        }
                    }
                }
            )
        );

        if (data.length === 0) {
            console.log(clc.yellow('None direct dependency exists'));
            console.log('');
        }

    } catch (error) {
        console.error(error);
        console.error(clc.red(error.toString()));
        process.exit(1);
    }
}

/**
 *
 *
 * @param {string} modulePath
 */
async function getLicensesInfo(modulePath) {
    // Get licences of all dependencies

    const { licensesInfo, moduleDeps } = await tmp.withDir(async (o) => {
        Console.log(clc.italic(`Copying module ${modulePath} to ${o.path}...`));
        await Fs.copy(modulePath, o.path, { dereference: true });
        await Fs.remove(Path.resolve(o.path, 'vendor'));

        Console.log(clc.italic(`Retrieving all direct dependencies of the module...`));
        const moduleDeps = await getModuleDependencies(o.path);

        // Download all dependencies into vendor directory

        await exec('go mod vendor', { cwd: o.path });

        const moduleDepsPaths = moduleDeps.filter(moduleDep => !moduleDep.Main)
            .map(moduleDep => moduleDep.Path);

        if (moduleDepsPaths.length > 0) {
            Console.log(clc.italic(`Getting license information of the dependencies...`));

            const { stdout } = await exec(`${LICENSE_DETECTOR} -f json ${moduleDepsPaths.join(' ')}`, { cwd: Path.resolve(o.path, 'vendor') });

            /** @type { { project: string; error?: string; matches?: {license: string; confidence: number; file: string; }[]; }[]} */
            const licensesInfo = JSON.parse(stdout);
            return { licensesInfo, moduleDeps };
        } else {
            return { licensesInfo: [], moduleDeps };
        }

    }, { unsafeCleanup: true });

    // Get Main module

    const mainModule = moduleDeps.find(moduleDep => moduleDep.Main);

    if (!mainModule) {
        console.error(clc.red('None main module detected'));
        process.exit(1);
    }

    const dependenciesLicenseInfo = moduleDeps.filter(moduleDep => !moduleDep.Main)
        .map(moduleDep => {
            const licenseInfo = licensesInfo.find(licenceInfo => {
                return licenceInfo.project === moduleDep.Path;
            });

            if (licenseInfo) {
                // Test if the package is white listed and get its license
                const whiteListedLicense = licenseTypes.getWhiteListedLicense(licenseInfo.project, licenseInfo.matches && licenseInfo.matches[0] ? licenseInfo.matches[0].license : '');

                if (licenseInfo.error && whiteListedLicense) {
                    delete licenseInfo.error;
                    licenseInfo.matches = [{ license: whiteListedLicense, confidence: 1.0, file: undefined }];
                }
                if ((!licenseInfo.matches || !licenseInfo.matches[0]) && !whiteListedLicense) {
                    licenseInfo.error = 'Missing license information';
                }
            }

            return {
                name: moduleDep.Path,
                version: moduleDep.Version,
                license: licenseInfo
            };
        });

    return { main: mainModule, licenses: dependenciesLicenseInfo };
}

/**
 *
 *
 * @param {string} modulePath
 */
async function getModuleDependencies(modulePath) {

    await exec('go mod tidy', { cwd: modulePath });

    const { stdout } = await exec('go list -json -m all', { cwd: modulePath });

    const moduleDepsJson = `[${stdout.replace(/}(\r\n|\r|\n){/g, '},{')}]`;

    /** @type { {Indirect?: boolean; Main?: boolean; Path: string; Version: string; Replace?: { Path: string; Dir: string;}; }[] } */
    let moduleDeps = JSON.parse(moduleDepsJson);

    // Handle replacements

    const modulesReplace = moduleDeps.filter(moduleDep => !!moduleDep.Replace);

    const replace$ = modulesReplace.map(moduleReplace => {
        return getModuleDependencies(moduleReplace.Replace.Dir);
    });

    const replace = await Promise.all(replace$);

    // Keep only direct dependencies

    moduleDeps = moduleDeps.filter(moduleDep => !moduleDep.Indirect && !moduleDep.Replace);

    // Merge replace dependencies

    moduleDeps = _.uniqBy([...moduleDeps, ..._.flattenDeep(replace).filter(rep => !rep.Main)], 'Path');

    // Remove BeeZeeLinx packages

    moduleDeps = _.sortBy(moduleDeps.filter(moduleDep => !moduleDep.Path.includes('beezeelinx') || moduleDep.Main), 'Path');

    return moduleDeps;
}

function testEnvironment() {
    if (!hasBin.sync(LICENSE_DETECTOR)) {
        console.error(clc.red(`The utitity "${LICENSE_DETECTOR}" is not installed. Check https://github.com/go-enry/go-license-detector`));
        process.exit(1);
    }

    if (!hasBin.sync('go')) {
        console.error(clc.red(`The go compiler is not installed.`));
        process.exit(1);
    }

    const goVersionStr = require('child_process').execSync('go version', { encoding: 'utf-8' });
    const goVersion = goVersionStr.match(/ go(\d\.\d+) /);

    if (goVersion[1] && !isNaN(Number(goVersion[1])) && Number(goVersion[1]) <= 1.11) {
        console.error(clc.red(`Invalid version of the go compiler: it must be > 1.11.`));
        process.exit(1);
    }
}