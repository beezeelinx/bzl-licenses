#!/usr/bin/env node

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

const Yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

Yargs(hideBin(process.argv))
    .strict()
    .usage('$0 <command>')
    .commandDir('commands')
    // .command(
    //     'npm <command>',
    //     'Handle node modules licenses',
    //     (yargs) => {
    //         return yargs
    //             .command(
    //                 'list <path>',
    //                 'List third party licenses of a npm project',
    //                 (yargs) => {
    //                     return yargs
    //                         .positional(
    //                             'path',
    //                             {
    //                                 describe: 'Path to the git repository that contains a package.json file',
    //                                 normalize: true,
    //                                 type: 'string'
    //                             }
    //                         )
    //                         .strict()
    //                         .check((argv, _options) => {
    //                             const modulePath = Path.resolve(argv.path);
    //                             if (!Fs.pathExistsSync(modulePath) || !Fs.pathExistsSync(Path.resolve(modulePath, 'package.json'))) {
    //                                 throw new Error('Invalid npm directory path');
    //                             }
    //                             return true;
    //                         });
    //                 },
    //                 list3rdPartyLicenses
    //             )
    //             .command(
    //                 'csv <path>',
    //                 'Save list of third party licenses of a npm project as a CSV file',
    //                 (yargs) => {
    //                     return yargs
    //                         .options(
    //                             {
    //                                 csv: {
    //                                     describe: 'Path to the CSV file to create (default to licenses.csv in npm project directory',
    //                                     normalize: true,
    //                                     type: 'string'
    //                                 }
    //                             }
    //                         )
    //                         .positional(
    //                             'path',
    //                             {
    //                                 describe: 'Path to the git repository that contains a package.json file',
    //                                 normalize: true,
    //                                 type: 'string'
    //                             }
    //                         )
    //                         .strict()
    //                         .check((argv, _options) => {
    //                             const modulePath = Path.resolve(argv.path);
    //                             if (!Fs.pathExistsSync(modulePath) || !Fs.pathExistsSync(Path.resolve(modulePath, 'package.json'))) {
    //                                 throw new Error('Invalid npm directory path');
    //                             }
    //                             if (argv.csv && !Fs.pathExistsSync(Path.resolve(argv.csv))) {
    //                                 throw new Error('Invalid CSV file path');

    //                             }
    //                             return true;
    //                         });
    //                 },
    //                 save3rdPartyLicenses
    //             )
    //             .demandCommand(1, 'must provide a valid subcommand')
    //     }
    // )
    .demandCommand(1, 'must provide a valid command')
    .help(true).alias('h', 'help')
    .version(false)
    .argv;
