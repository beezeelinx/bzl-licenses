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
    .demandCommand(1, 'must provide a valid command')
    .options(
        {
            nocolor: {
                describe: 'Disable colorized outputs',
                type: 'boolean',
                default: false
            },
            check: {
                describe: 'Exit with a non zero status code if one of the licenses is invalid',
                type: 'boolean',
                alias: 'c',
                default: false
            },
            quiet: {
                describe: 'Do not produce outputs',
                type: 'boolean',
                alias: 'q',
                default: false
            }
        }
    )
    .check((argv, _options) => {
        if (argv.nocolor) {
            process.env['NO_COLOR'] = 'true';
        }
        return true;
    })
    .help(true).alias('h', 'help')
    .version(false)
    .argv;
