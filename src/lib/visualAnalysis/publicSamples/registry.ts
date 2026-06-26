import { PublicVisualSample } from './types';

export const PUBLIC_VISUAL_SAMPLES: PublicVisualSample[] = [
  {
    id: "sample-landscape-1",
    title: "Yosemite Valley",
    category: "landscape",
    expectedImageKind: "landscapePhoto",
    expectedElementCategories: ["landscapeElement", "terrain", "plant", "waterBody", "weatherOrSky"],
    expectedVisibleElementLabels: ["sky", "mountain", "valley", "trees", "clouds"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Yosemite_Valley_from_Tunnel_View.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/23/Yosemite_Valley_from_Tunnel_View.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Yosemite_Valley_from_Tunnel_View.jpg/640px-Yosemite_Valley_from_Tunnel_View.jpg",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      licenseUrl: "https://en.wikipedia.org/wiki/Public_domain",
      author: "Diliff",
      requiresAttribution: false,
      attributionText: "Diliff, Public domain, via Wikimedia Commons"
    }
  },
  {
    id: "sample-person-1",
    title: "Person reading",
    category: "person",
    expectedImageKind: "naturalPhoto",
    expectedElementCategories: ["person", "furniture", "document", "clothing"],
    expectedVisibleElementLabels: ["person", "book", "chair", "clothes"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Woman_reading_a_book_-_NARA_-_559194.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/87/Woman_reading_a_book_-_NARA_-_559194.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Woman_reading_a_book_-_NARA_-_559194.jpg/640px-Woman_reading_a_book_-_NARA_-_559194.jpg",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      licenseUrl: "https://en.wikipedia.org/wiki/Public_domain",
      author: "National Archives and Records Administration",
      requiresAttribution: false,
      attributionText: "National Archives and Records Administration, Public domain, via Wikimedia Commons"
    }
  },
  {
    id: "sample-animal-1",
    title: "Cat sleeping",
    category: "animal",
    expectedImageKind: "naturalPhoto",
    expectedElementCategories: ["animal", "furniture"],
    expectedVisibleElementLabels: ["cat", "bed", "blanket"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Sleeping_cat_on_her_back.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/b/bc/Sleeping_cat_on_her_back.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Sleeping_cat_on_her_back.jpg/640px-Sleeping_cat_on_her_back.jpg",
      licenseKind: "ccBySa",
      licenseName: "CC BY-SA 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
      author: "Umberto Salvagnin",
      requiresAttribution: true,
      attributionText: "Umberto Salvagnin, CC BY-SA 3.0 <https://creativecommons.org/licenses/by-sa/3.0>, via Wikimedia Commons"
    }
  },
  {
    id: "sample-plant-1",
    title: "Sunflower",
    category: "plant",
    expectedImageKind: "naturalPhoto",
    expectedElementCategories: ["plant", "weatherOrSky"],
    expectedVisibleElementLabels: ["sunflower", "sky", "petals", "leaves"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:A_sunflower.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/44/A_sunflower.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/A_sunflower.jpg/640px-A_sunflower.jpg",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      licenseUrl: "https://en.wikipedia.org/wiki/Public_domain",
      author: "P.L. Tandon",
      requiresAttribution: false,
      attributionText: "P.L. Tandon, Public domain, via Wikimedia Commons"
    }
  },
  {
    id: "sample-interior-1",
    title: "Living Room Interior",
    category: "interior",
    expectedImageKind: "naturalPhoto",
    expectedElementCategories: ["furniture", "plant", "building"],
    expectedVisibleElementLabels: ["sofa", "table", "window", "plant", "wall"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Living_room_of_a_house_in_Kobe_02.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/29/Living_room_of_a_house_in_Kobe_02.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Living_room_of_a_house_in_Kobe_02.jpg/640px-Living_room_of_a_house_in_Kobe_02.jpg",
      licenseKind: "ccBySa",
      licenseName: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      author: "663highland",
      requiresAttribution: true,
      attributionText: "663highland, CC BY-SA 4.0 <https://creativecommons.org/licenses/by-sa/4.0>, via Wikimedia Commons"
    }
  },
  {
    id: "sample-furniture-1",
    title: "Wooden Chair",
    category: "furniture",
    expectedImageKind: "productPhoto",
    expectedElementCategories: ["furniture"],
    expectedVisibleElementLabels: ["chair", "wood", "legs", "seat"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Windsor_chair.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/6/65/Windsor_chair.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Windsor_chair.jpg/640px-Windsor_chair.jpg",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      licenseUrl: "https://en.wikipedia.org/wiki/Public_domain",
      author: "Unknown",
      requiresAttribution: false,
      attributionText: "Unknown author, Public domain, via Wikimedia Commons"
    }
  },
  {
    id: "sample-stationery-1",
    title: "Pencils and Notebook",
    category: "stationery",
    expectedImageKind: "productPhoto",
    expectedElementCategories: ["tool", "document"],
    expectedVisibleElementLabels: ["pencil", "notebook", "paper", "desk"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Colored_pencils_and_notebook.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4b/Colored_pencils_and_notebook.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Colored_pencils_and_notebook.jpg/640px-Colored_pencils_and_notebook.jpg",
      licenseKind: "ccBySa",
      licenseName: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      author: "Amada44",
      requiresAttribution: true,
      attributionText: "Amada44, CC BY-SA 4.0 <https://creativecommons.org/licenses/by-sa/4.0>, via Wikimedia Commons"
    }
  },
  {
    id: "sample-bookshelf-1",
    title: "Books on a shelf",
    category: "bookshelf",
    expectedImageKind: "naturalPhoto",
    expectedElementCategories: ["document", "furniture"],
    expectedVisibleElementLabels: ["books", "shelf", "spines", "wood"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Bookshelf_in_a_library.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Bookshelf_in_a_library.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Bookshelf_in_a_library.jpg/640px-Bookshelf_in_a_library.jpg",
      licenseKind: "cc0",
      licenseName: "CC0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      author: "Pixabay",
      requiresAttribution: false,
      attributionText: "Pixabay, CC0, via Wikimedia Commons"
    }
  },
  {
    id: "sample-chart-1",
    title: "Line Chart",
    category: "chartOrTable",
    expectedImageKind: "chartOrTable",
    expectedElementCategories: ["chart", "textRegion", "uiElement"],
    expectedVisibleElementLabels: ["chart", "axis", "line", "labels", "legend"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Line_graph.svg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/84/Line_graph.svg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Line_graph.svg/640px-Line_graph.svg.png",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      licenseUrl: "https://en.wikipedia.org/wiki/Public_domain",
      author: "Tariqabjotu",
      requiresAttribution: false,
      attributionText: "Tariqabjotu, Public domain, via Wikimedia Commons"
    }
  },
  {
    id: "sample-document-1",
    title: "Old manuscript",
    category: "documentLike",
    expectedImageKind: "documentPhoto",
    expectedElementCategories: ["document", "textRegion"],
    expectedVisibleElementLabels: ["paper", "text", "ink", "page"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Magna_Carta_(British_Library_Cotton_MS_Augustus_II.106).jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ee/Magna_Carta_%28British_Library_Cotton_MS_Augustus_II.106%29.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Magna_Carta_%28British_Library_Cotton_MS_Augustus_II.106%29.jpg/640px-Magna_Carta_%28British_Library_Cotton_MS_Augustus_II.106%29.jpg",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      licenseUrl: "https://en.wikipedia.org/wiki/Public_domain",
      author: "Unknown author",
      requiresAttribution: false,
      attributionText: "Unknown author, Public domain, via Wikimedia Commons"
    }
  },
  {
    id: "sample-mixed-1",
    title: "Desk with items and screen",
    category: "mixed",
    expectedImageKind: "mixed",
    expectedElementCategories: ["screen", "tool", "furniture", "document"],
    expectedVisibleElementLabels: ["monitor", "keyboard", "mouse", "desk", "paper", "pen"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Desk_with_computer_and_papers.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c8/Desk_with_computer_and_papers.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Desk_with_computer_and_papers.jpg/640px-Desk_with_computer_and_papers.jpg",
      licenseKind: "ccBy",
      licenseName: "CC BY 2.0",
      licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
      author: "Juhan Sonin",
      requiresAttribution: true,
      attributionText: "Juhan Sonin, CC BY 2.0 <https://creativecommons.org/licenses/by/2.0>, via Wikimedia Commons"
    }
  },
  {
    id: "sample-receipt-synthetic",
    title: "Synthetic Market Receipt",
    category: "receipt",
    expectedImageKind: "receiptPhoto",
    expectedElementCategories: ["document", "textRegion"],
    expectedVisibleElementLabels: ["receipt", "text", "prices", "items", "total"],
    source: {
      provider: "localFixture",
      imageUrl: "/visual-samples/synthetic-receipt.svg",
      thumbnailUrl: "/visual-samples/synthetic-receipt.svg",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      author: "indexmd test fixture",
      requiresAttribution: false,
      attributionText: "indexmd test fixture, Public domain"
    }
  },
  {
    id: "sample-ticket-synthetic",
    title: "Synthetic Festival Ticket",
    category: "ticket",
    expectedImageKind: "documentPhoto",
    expectedElementCategories: ["document", "textRegion"],
    expectedVisibleElementLabels: ["ticket", "text", "gate", "seat", "event"],
    source: {
      provider: "localFixture",
      imageUrl: "/visual-samples/synthetic-ticket.svg",
      thumbnailUrl: "/visual-samples/synthetic-ticket.svg",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      author: "indexmd test fixture",
      requiresAttribution: false,
      attributionText: "indexmd test fixture, Public domain"
    }
  }
];

export function getPublicSampleById(id: string): PublicVisualSample | undefined {
  return PUBLIC_VISUAL_SAMPLES.find(s => s.id === id);
}

export function getAllPublicSamples(): PublicVisualSample[] {
  return PUBLIC_VISUAL_SAMPLES;
}
