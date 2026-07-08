import re

with open('server.ts', 'r') as f:
    content = f.read()

pattern = r'expectedMetadata: buildPublicSampleExpectedMetadata\(sample\), // \{\n(?:.*?\n){1,8}\s*\},'
new_content = re.sub(pattern, r'expectedMetadata: buildPublicSampleExpectedMetadata(sample),', content)

# There is one case at the end of the object where it's `},` or `}`
pattern2 = r'expectedMetadata: buildPublicSampleExpectedMetadata\(sample\), // \{\n(?:.*?\n){1,8}\s*\}'
new_content = re.sub(pattern2, r'expectedMetadata: buildPublicSampleExpectedMetadata(sample)', new_content)

with open('server.ts', 'w') as f:
    f.write(new_content)
