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
const Console = require('../lib/console');
const clc = require('cli-color');
const tmp = require('tmp-promise');
const Promisify = require('util').promisify;
const exec = Promisify(require('child_process').exec);
const licenceChecker = require('license-checker');
const licenseTypes = require('../lib/licenses_types');
const columnify = require('columnify');
const { stringify: csvStringify } = require('csv-stringify/sync');
const { DateTime } = require('luxon');
const { last } = require('lodash');

exports.command = 'npm <command>';
exports.description = 'Handle npm modules licenses';

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
            'List third party licenses of a npm package',
            (yargs) => {
                return yargs
                    // .options(
                    //     {
                    //         // check: {
                    //         //     describe: 'Exit with a non zero status code if one of the licenses is invalid',
                    //         //     type: 'boolean',
                    //         //     alias: 'c',
                    //         //     default: false
                    //         // },
                    //         // quiet: {
                    //         //     describe: 'Do not produce outputs',
                    //         //     type: 'boolean',
                    //         //     alias: 'q',
                    //         //     default: false
                    //         // }
                    //     }
                    // )
                    .positional(
                        'path',
                        {
                            describe: 'Path to the npm package',
                            normalize: true,
                            type: 'string',
                            coerce: Path.resolve
                        }
                    )
                    .check((argv, _options) => {
                        if (!argv.path || !Fs.pathExistsSync(argv.path) || !Fs.pathExistsSync(Path.resolve(argv.path, 'package.json'))) {
                            throw new Error('Invalid npm package directory path');
                        }
                        if (argv.quiet) {
                            Console.enable(false);
                        }
                        return true;
                    });
            },
            listNpm3rdPartyLicenses
        )
        .command(
            'csv <path>',
            'Save list of third party licenses of a npm package as a CSV file',
            (yargs) => {
                return yargs
                    .options(
                        {
                            csv: {
                                describe: 'Path to the CSV file to create (default to licenses.csv in package directory',
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
                            describe: 'Path to the npm package',
                            normalize: true,
                            type: 'string',
                            coerce: Path.resolve
                        }
                    )
                    .strict()
                    .check((argv, _options) => {
                        if (!argv.path || !Fs.pathExistsSync(argv.path) || !Fs.pathExistsSync(Path.resolve(argv.path, 'package.json'))) {
                            throw new Error('Invalid npm package directory path');
                        }
                        if (argv.csv && !Fs.pathExistsSync(Path.dirname(Path.resolve(argv.csv)))) {
                            throw new Error(`Directory ${Path.dirname(Path.resolve(argv.csv))} does not exist`);
                        }
                        if (argv.quiet) {
                            Console.enable(false);
                        }
                        return true;
                    });
            },
            saveNpm3rdPartyLicenses
        )
        .demandCommand(1, 'must provide a valid subcommand');
};

/**
 *
 * @param {import('yargs').Arguments<{path: string; csv?: string;}>} argv
 */
async function saveNpm3rdPartyLicenses(argv) {
    const modulePath = Path.resolve(argv.path);
    const csvPath = Path.resolve(argv.csv || `${Path.resolve(modulePath, 'licenses.csv')}`);

    try {
        // Get licenses of all dependencies

        const { packageInfo, licenses } = await getLicensesInfo(modulePath);

        Console.log('');
        Console.log('Main module:', clc.green(packageInfo.name));
        Console.log(`Create 3rd party licenses file ${clc.cyan(csvPath)}`);

        let hasLicenseError = false;
        const data = await Promise.all(Object.keys(licenses).map(async key => {
            const licenseInfo = licenses[key];

            const licenseName = licenseInfo.licenses;
            let licenseError = '';

            // Test license

            if (!licenseName) {
                licenseError = 'Missing license information';
                console.error(clc.red(`Package ${licenseInfo.name} is missing a license information`));
                hasLicenseError = true;
            } else if (!licenseTypes.isValidLicense(licenseName) && !licenseTypes.isWhiteListed(licenseInfo.name)) {
                licenseError = 'Invalid/unknown license';
                console.error(clc.red(`Invalid license ${licenseName} for the package ${licenseInfo.name}`));
                hasLicenseError = true;
            }

            if (!await isOlderThan1Week(licenseInfo)) {
                licenseError = 'package needs to be older thant a week';
                console.error(clc.red(`Package ${licenseInfo.name} version ${licenseInfo.version} is less thant 1 week old`));
                hasLicenseError = true;
            }

            return {
                Package: licenseInfo.name,
                Version: licenseInfo.version,
                License: licenseName || '~Unknown License~~',
                error: licenseError,
            };
        }));

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
 * @param {import('yargs').Arguments<{path: string; check: boolean; }>} argv
 */
async function listNpm3rdPartyLicenses(argv) {
    const modulePath = Path.resolve(argv.path);

    try {
        // Get licenses of all dependencies

        const { packageInfo, licenses } = await getLicensesInfo(modulePath);

        Console.log('');
        Console.log('Main package:', clc.green(packageInfo.name));
        Console.log('');

        const data = await Promise.all(Object.keys(licenses).map(async key => {
            const licenseInfo = licenses[key];
            const licenseName = licenseInfo.licenses;
            let licenseError = '';

            // Test license

            let validity = -1;

            if (!licenseName) {
                licenseError = 'Missing license information';
            } else {
                const isValid = licenseTypes.isValidLicense(licenseName);
                const isWhiteListed = licenseTypes.isWhiteListed(licenseInfo.name);
                const olderThan1Week = await isOlderThan1Week(licenseInfo);
                if ((isValid || isWhiteListed) && olderThan1Week) {
                    validity = 0;
                    if (isWhiteListed) {
                        validity = 1;
                    }
                }
                if (!olderThan1Week) {
                    licenseError = 'package needs to be older thant a week';
                }
            }

            return {
                name: licenseInfo.name,
                version: licenseInfo.version,
                license: licenseName,
                error: licenseError,
                validity
            };
        }));

        let hasLicenseError = false;
        if (argv.check) {
            Object.keys(licenses).forEach(key => {
                const licenseInfo = licenses[key];

                const licenseName = licenseInfo.licenses;

                // Test license

                if (!licenseName) {
                    console.error(clc.red(`Package ${licenseInfo.name} is missing a license information`));
                    hasLicenseError = true;
                } else if (!licenseTypes.isValidLicense(licenseName) && !licenseTypes.isWhiteListed(licenseInfo.name)) {
                    console.error(clc.red(`Invalid license ${licenseName} for the package ${licenseInfo.name}`));
                    hasLicenseError = true;
                }
            });
        }

        Console.log(
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
            Console.log(clc.yellow('None direct dependency exists'));
            Console.log('');
        }

        if (argv.check && hasLicenseError) {
            process.exit(1);
        }

    } catch (error) {
        console.error(error);
        console.error(clc.red(error.toString()));
        process.exit(1);
    }
}

// Node 18+ (global fetch). For Node <18, `npm i node-fetch` and import it.
/**
 * @param {string|undefined} name
 */
function encodePkg(name) {
    // Scoped packages need @scope%2fname
    return name.replace(/\//g, '%2f');
}

/**
 * @param {string|undefined} name
 * @param {string|undefined} version
 */
async function getPublishTime(
    name,
    version,
    registry = process.env.npm_config_registry || 'https://registry.npmjs.org'
) {
    const url = `${registry.replace(/\/+$/, '')}/${encodePkg(name)}`;
    const res = await fetch(url);
    if (!res.ok) {
        console.log(`Registry fetch failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();

    // If no version given, use the current "latest" dist-tag
    const effectiveVersion = version || data['dist-tags']?.latest;
    return DateTime.fromISO(data.time[effectiveVersion]);
}

/**
 *
 *
 * @param {licenceChecker.ModuleInfo} packageInfo
 */
async function isOlderThan1Week(packageInfo) {
    const packageVersionReleaseDate = await getPublishTime(packageInfo.name, packageInfo.version);
    const lastWeek = DateTime.now().minus({ weeks: 1 }).startOf('day');
    return packageVersionReleaseDate.toUTC().toMillis() < lastWeek.toUTC().toMillis();
}

/**
 *
 *
 * @param {string} modulePath
 */
async function getLicensesInfo(modulePath) {

    // Read package.json file to get main package info

    const packageJson = await Fs.readJson(Path.resolve(modulePath, 'package.json'), { encoding: 'utf8' });

    // Get licences of all dependencies

    const { licensesInfo } = await tmp.withDir(async (o) => {
        Console.log(clc.italic(`Copying module ${modulePath} to ${o.path}...`));

        await Fs.copy(modulePath, o.path, {
            filter: (src, _dest) => {
                src = Path.resolve(src);
                if (src.indexOf('node_modules') !== -1 || src.indexOf('.tmp') !== -1 || src.indexOf('.git') !== -1) {
                    return false;
                }
                return true;
            }
        });

        Console.log(clc.italic(`Installing package dependencies...`));

        await exec('npm install --ignore-scripts --no-save --no-package-lock --no-audit --no-fund --legacy-peer-deps', { cwd: o.path });

        Console.log(clc.italic(`Getting license information of the dependencies and check released date...`));

        const packages = await Promisify(licenceChecker.init)({
            start: o.path,
            production: true,
            excludePrivatePackages: true,
            // @ts-ignore
            direct: 0,  // Do not get internal dependencies
            customFormat: {
                name: true,
                version: true,
                licenseText: false,
                publisher: false,
                email: false,
                path: false,
                licenseFile: false,
                copyright: false,
                url: false,
            },
        });

        // Keep only the direct dependencies: as the packages list is flatten, indirect dependencies are visible in node_modules
        // Remove BeeZeeLinx packages

        const directDependencies = Object.keys(packageJson['dependencies']) || [];

        Object.keys(packages).forEach(packageNameVersion => {
            const packageInfo = packages[packageNameVersion];

            if ((packageInfo.repository || '').includes('beezeelinx') || directDependencies.indexOf(packageInfo.name) === -1) {
                delete packages[packageNameVersion];
                return;
            }

            // Test if the package is white listed and get its license

            const whiteListedLicense = licenseTypes.getWhiteListedLicense(packageInfo.name, /** @type string */(packageInfo.licenses));

            if (whiteListedLicense) {
                packageInfo.licenses = whiteListedLicense;
            }
        });

        return { licensesInfo: packages };
    }, { unsafeCleanup: true });

    return { packageInfo: packageJson, licenses: licensesInfo };
}
