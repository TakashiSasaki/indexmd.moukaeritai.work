const fs = require('fs');
const tsNode = require('ts-node').register();
const compiler = require('./src/lib/visualAnalysis/schemaCompiler');
const input = {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "Test",
      type: "object",
      properties: {
        foo: {
          type: "string",
          const: "bar",
          "x-custom": true
        }
      },
      additionalProperties: false
    };
const res = compiler.compileProviderSchema(input);
console.log(JSON.stringify(res, null, 2));
