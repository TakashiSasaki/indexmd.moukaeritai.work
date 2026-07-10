import fs from 'fs';
import path from 'path';

function formatEFUDate(date: Date): string {
    return date.toISOString().replace('T', ' ').split('.')[0];
}

function generateEFU() {
    const root = process.cwd();
    const outputFile = path.join(root, 'index.efu');
    const ignored = ['.git', 'node_modules', 'cache', '.next', 'dist', 'firebase-applet-config.json', 'index.efu'];

    const efuLines = ['Filename,Size,Date Created,Date Modified,Attributes'];

    function walk(dir: string) {
        const list = fs.readdirSync(dir);
        for (const item of list) {
            if (ignored.includes(item)) continue;
            
            const filePath = path.join(dir, item);
            
            // Skip .git folders implicitly by ignore list, but check explicitly for safety
            if (item.startsWith('.')) continue;

            let stat;
            try {
                stat = fs.statSync(filePath);
            } catch (e) { continue; }

            if (stat.isDirectory()) {
                walk(filePath);
            } else {
                const relativePath = path.relative(root, filePath);
                const line = `"${relativePath}",${stat.size},${formatEFUDate(stat.birthtime)},${formatEFUDate(stat.mtime)},A`;
                efuLines.push(line);
            }
        }
    }

    walk(root);
    fs.writeFileSync(outputFile, efuLines.join('\n'), 'utf8');
    console.log(`Generated ${outputFile} with ${efuLines.length - 1} files.`);
}

generateEFU();
