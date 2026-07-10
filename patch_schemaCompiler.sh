#!/bin/bash
sed -i '/assert.strictEqual(result.compilerName, "RecursiveAllowlistCompiler");/a \
    console.log(JSON.stringify(result.schema, null, 2));\
' src/lib/visualAnalysis/schemaCompiler.test.ts
