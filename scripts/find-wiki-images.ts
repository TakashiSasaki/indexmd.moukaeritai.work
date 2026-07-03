import * as https from 'https';

async function fetchJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'IndexMDImageExperiment/1.2 (takashi316@gmail.com)' } }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch(e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function search(query: string) {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=120`;
    const data = await fetchJson(url);
    if (!data.query || !data.query.pages) {
        console.log("No results for", query);
        return;
    }
    const pages = Object.values(data.query.pages);
    for (const page of pages as any[]) {
        const title = page.title;
        const ii = page.imageinfo?.[0];
        if (!ii) continue;
        console.log(`\nTitle: ${title}`);
        console.log(`Page URL: ${ii.descriptionurl}`);
        console.log(`Image URL: ${ii.url}`);
        console.log(`Thumbnail URL: ${ii.thumburl}`);
        console.log(`Size: ${ii.size} bytes`);
        const meta = ii.extmetadata;
        console.log(`Artist: ${meta?.Artist?.value}`);
        console.log(`License: ${meta?.LicenseShortName?.value}`);
        console.log(`License URL: ${meta?.LicenseUrl?.value}`);
    }
}

async function main() {
    await search('wine bottle label filetype:jpg');
    console.log("-------------------");
    await search('shampoo bottle filetype:jpg');
    console.log("-------------------");
    await search('canned food label filetype:jpg');
}

main().catch(console.error);
