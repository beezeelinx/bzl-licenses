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

// From https://github.com/google/licenseclassifier/blob/main/license_type.go and https://spdx.org/licenses/

const ForbiddenTypes = [
    'AGPL-1.0',
    'AGPL-3.0',
    'CC-BY-NC-1.0',
    'CC-BY-NC.2.0',
    'CC-BY-NC-2.5',
    'CC-BY-NC-3.0',
    'CC-BY-NC-4.0',
    'CC-BY-NC-ND-1.0',
    'CC-BY-NC-ND-2.0',
    'CC-BY-NC-ND-2.5',
    'CC-BY-NC-ND-3.0',
    'CC-BY-NC-ND-4.0',
    'CC-BY-NC-SA-1.0',
    'CC-BY-NC-SA-2.0',
    'CC-BY-NC-SA-2.5',
    'CC-BY-NC-SA-3.0',
    'CC-BY-NC-SA-4.0',
    'Commons-Clause',
    'Facebook-2-Clause',
    'Facebook-3-Clause',
    'Facebook-Examples',
    'WTFPL',
];

// restricted - Licenses in this category require mandatory source
// distribution if we ships a product that includes third-party code
// protected by such a license.
const RestrictedTypes = [
    'BCL',
    'CC-BY-ND-1.0',
    'CC-BY-ND-2.0',
    'CC-BY-ND-2.5',
    'CC-BY-ND-3.0',
    'CC-BY-ND-4.0',
    'CC-BY-SA-1.0',
    'CC-BY-SA-2.0',
    'CC-BY-SA-2.5',
    'CC-BY-SA-3.0',
    'CC-BY-SA-4.0',
    'GPL-1.0',
    'GPL-2.0',
    'GPL-2.0-with-autoconf-exception',
    'GPL-2.0-with-bison-exception',
    'GPL-2.0-with-classpath-exception',
    'GPL-2.0-with-font-exception',
    'GPL-2.0-with-GCC-exception',
    'GPL-3.0',
    'GPL-3.0with-autoconf-exception',
    'GPL-3.0with-GCC-exception',
    'LGPL-2.0',
    'LGPL-2.1',
    'LGPL-3.0',
    'NPL-1.0',
    'NPL-1.1',
    'OSL-1.0',
    'OSL-1.1',
    'OSL-2.0',
    'OSL-2.1',
    'OSL-3.0',
    'QPL-1.0',
    'Sleepycat',
];

const WhiteList = [
    {
        name: 'gopkg.in/mgo.v2',
        license: 'BSD-2-Clause'
    },
    {
        name: 'github.com/gogo/protobuf',
        license: 'BSD-3-Clause'
    },
];

/**
 *
 *
 * @param {string} license
 */
function isValidLicense(license) {
    return ForbiddenTypes.indexOf(license) === -1 && RestrictedTypes.indexOf(license) === -1;
}

/**
 *
 *
 * @param {string} packageName
 * @return {string | null}
 */
function getWhiteListedLicense(packageName) {
    const info = WhiteList.find(whitel => whitel.name === packageName);
    return info ? info.license : null;
}

exports.isValidLicense = isValidLicense;
exports.getWhiteListedLicense = getWhiteListedLicense;
