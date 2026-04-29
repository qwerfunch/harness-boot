#!/usr/bin/env node
import('../dist/cli/harness.js').then((m) => m.main(process.argv));
