/**
 * Copyright 2016 Palantir Technologies, Inc.
 * Original source: https://goo.gl/U1JdRW
 */

import * as glob from "fast-glob";
import * as path from "path";
import { consoleTestResultHandler, runTest } from "tslint/lib/test";

process.stdout.write("\nTesting Lint Rules:\n");

const rulesDirectory = path.resolve(process.cwd(), "../rules");
const testDirectories = glob.sync("./rules/**/tslint.json").map(path.dirname);
// const testDirectories = ["./rules/class-members-name/everything-is-pascal-case"];

for (const testDirectory of testDirectories) {
    const results = runTest(testDirectory, rulesDirectory);
    const didAllTestsPass = consoleTestResultHandler(results, {
        log(m): void {
            process.stdout.write(m);
        },
        error(m): void {
            process.stderr.write(m);
        }
    });
    if (!didAllTestsPass) {
        process.exitCode = 1;
        break;
    }
}
