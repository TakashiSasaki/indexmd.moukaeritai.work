const fs = require('fs');

function updateApiSchema() {
  const file = 'docs/api-schema.md';
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  const replacement = `"expectedMetadata": {
      "imageKind": "naturalPhoto",
      "acceptableImageKinds": ["landscapePhoto"],
      "elementCategories": ["plant", "weatherOrSky"],
      "visibleElementLabels": ["sunflower", "cloud"],
      "visibleElementLabelAliases": {
        "cloud": ["clouds", "sky"]
      },
      "visibleText": ["Hello World"],
      "optionalElementCategories": ["person"],
      "optionalVisibleElementLabels": ["hand"],
      "optionalVisibleElementLabelAliases": {
        "hand": ["fingers"]
      },
      "optionalVisibleText": ["Warning"]
    },`;
    
  content = content.replace(/"expectedMetadata": \{[\s\S]*?"visibleText": \[\n\s*"Brand"\n\s*\]\n\s*\},/g, replacement);
  fs.writeFileSync(file, content);
}

function updateVisualSchema() {
  const file = 'docs/visual-analysis-schema.md';
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Insert PROMPTED_JSON_MODE documentation
  if (!content.includes('PROMPTED_JSON_MODE')) {
    content = content.replace(/EXPERIMENTAL_MODEL:.*?\n/g, match => match + "  - `PROMPTED_JSON_MODE`: Native structured outputs failed or were unsupported, so JSON mode was injected via prompt.\n");
  }

  // Check if textRegion is mentioned
  if (!content.includes('`textRegion` equivalence')) {
    content = content.replace(/### Evaluation Coverage Logic/, "### Evaluation Coverage Logic\n\n- **Equivalence Rules**:\n  - `textRegion` category is considered 'acceptable' if `visibleText` was successfully extracted from the image, even if the model didn't output a discrete `textRegion` element.\n");
  }
  
  fs.writeFileSync(file, content);
}

updateApiSchema();
updateVisualSchema();
