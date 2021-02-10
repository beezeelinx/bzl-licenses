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

/** @type boolean */
let enabled = true;

exports.log = (...args) => {
    if (!enabled) {
        return;
    }
    console.log(...args);
};

/**
 *
 *
 * @param {boolean} enable
 */
exports.enable = (enable) => {
    enabled = enable;
};
