const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const regex = /      thumbnailRoute: `\/api\/visual\/public-samples\/\$\{s.id\}\/image\?variant=thumbnail`,\n      licenseKind: s\.source\.licenseKind,\n      licenseName: s\.source\.licenseName,\n      attributionText: s\.source\.attributionText,\n      sourcePageUrl: s\.source\.pageUrl,\n      sourceProvider: s\.source\.provider,\n      sourceKind: s\.source\.provider === "localFixture" \? "synthetic" : "external",\n      isSynthetic: s\.source\.provider === "localFixture"\n    \};\n  \}\);\n/g;

const replacement = `      source: {
        provider: s.source.provider,
        kind: s.source.provider === "localFixture" ? "synthetic" : "external",
        licenseKind: s.source.licenseKind,
        licenseName: s.source.licenseName,
        attributionText: s.source.attributionText,
        pageUrl: s.source.pageUrl,
        isSynthetic: s.source.provider === "localFixture"
      },
      thumbnailRoute: \`/api/visual/public-samples/\${s.id}/image?variant=thumbnail\`
    };
  });
`;

code = code.replace(regex, replacement);

fs.writeFileSync('server.ts', code);
