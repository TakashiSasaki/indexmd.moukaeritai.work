const fs = require('fs');
const file = 'src/components/ImageExperiment.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacement = `const comparisonSample = {
              id: selectedSampleId,
              title: selectedSample?.title || selectedSampleId,
              category: (selectedSample?.category || "other") as any,
              source: (selectedSample?.source || "unknown") as any,
              expectedImageKind: data.expectedMetadata.imageKind,
              acceptableImageKinds: data.expectedMetadata.acceptableImageKinds || [],
              expectedElementCategories: data.expectedMetadata.elementCategories || [],
              expectedVisibleElementLabels: data.expectedMetadata.visibleElementLabels || [],
              expectedVisibleElementLabelAliases: data.expectedMetadata.visibleElementLabelAliases || {},
              expectedVisibleText: data.expectedMetadata.visibleText || [],
              optionalElementCategories: data.expectedMetadata.optionalElementCategories || [],
              optionalVisibleElementLabels: data.expectedMetadata.optionalVisibleElementLabels || [],
              optionalVisibleElementLabelAliases: data.expectedMetadata.optionalVisibleElementLabelAliases || {},
              optionalVisibleText: data.expectedMetadata.optionalVisibleText || []
            };`;

const replacement389 = `const comparisonSample = {
          id: sampleId,
          title: matchedSample?.title || sampleId,
          category: (matchedSample?.category || "other") as any,
          source: (matchedSample?.source || "unknown") as any,
          expectedImageKind: data.expectedMetadata.imageKind,
          acceptableImageKinds: data.expectedMetadata.acceptableImageKinds || [],
          expectedElementCategories: data.expectedMetadata.elementCategories || [],
          expectedVisibleElementLabels: data.expectedMetadata.visibleElementLabels || [],
          expectedVisibleElementLabelAliases: data.expectedMetadata.visibleElementLabelAliases || {},
          expectedVisibleText: data.expectedMetadata.visibleText || [],
          optionalElementCategories: data.expectedMetadata.optionalElementCategories || [],
          optionalVisibleElementLabels: data.expectedMetadata.optionalVisibleElementLabels || [],
          optionalVisibleElementLabelAliases: data.expectedMetadata.optionalVisibleElementLabelAliases || {},
          optionalVisibleText: data.expectedMetadata.optionalVisibleText || []
        };`;

const replacement1451 = `const comparisonSample = {
                  ...sample,
                  expectedImageKind: expectedMetadata?.imageKind ?? sample.expectedImageKind,
                  acceptableImageKinds: expectedMetadata?.acceptableImageKinds ?? sample.acceptableImageKinds,
                  expectedElementCategories: expectedMetadata?.elementCategories ?? sample.expectedElementCategories,
                  expectedVisibleElementLabels: expectedMetadata?.visibleElementLabels ?? sample.expectedVisibleElementLabels,
                  expectedVisibleElementLabelAliases: expectedMetadata?.visibleElementLabelAliases ?? sample.expectedVisibleElementLabelAliases,
                  expectedVisibleText: expectedMetadata?.visibleText ?? sample.expectedVisibleText,
                  optionalElementCategories: expectedMetadata?.optionalElementCategories ?? sample.optionalElementCategories,
                  optionalVisibleElementLabels: expectedMetadata?.optionalVisibleElementLabels ?? sample.optionalVisibleElementLabels,
                  optionalVisibleElementLabelAliases: expectedMetadata?.optionalVisibleElementLabelAliases ?? sample.optionalVisibleElementLabelAliases,
                  optionalVisibleText: expectedMetadata?.optionalVisibleText ?? sample.optionalVisibleText
                };`;

content = content.replace(/const comparisonSample = \{\n *id: selectedSampleId,[\s\S]*?expectedVisibleText: data.expectedMetadata.visibleText\n *\};/g, replacement);
content = content.replace(/const comparisonSample = \{\n *id: sampleId,[\s\S]*?expectedVisibleText: data.expectedMetadata.visibleText\n *\};/g, replacement389);
content = content.replace(/const comparisonSample = \{\n *\.\.\.sample,\n *expectedImageKind: expectedMetadata\?\.imageKind \?\? sample\.expectedImageKind,[\s\S]*?expectedVisibleText: expectedMetadata\?\.visibleText \?\? sample\.expectedVisibleText\n *\};/g, replacement1451);

fs.writeFileSync(file, content);
