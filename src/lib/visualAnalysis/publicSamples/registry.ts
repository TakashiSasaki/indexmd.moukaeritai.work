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
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d4/Yosemite_Valley_from_Tunnel_View.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Yosemite_Valley_from_Tunnel_View.jpg/640px-Yosemite_Valley_from_Tunnel_View.jpg",
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
    title: "Greek pottery with depicted woman",
    category: "person",
    expectedImageKind: "artifactPhoto",
    expectedElementCategories: ["person", "clothing", "symbol"],
    expectedVisibleElementLabels: ["woman", "garment", "meander border"],
    expectedVisibleElementLabelAliases: {
      "woman": ["person", "figure", "depicted person", "woman"],
      "scroll": ["document", "book", "scroll"],
      "meander border": ["meander pattern", "geometric border", "border", "meander border"],
      "vase surface": ["vase", "surface", "pottery", "ceramic"]
    },
    optionalElementCategories: ["container"],
    optionalVisibleElementLabels: ["vase surface", "scroll"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Muse_reading_Louvre_CA2220_(cropped).jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/9/99/Muse_reading_Louvre_CA2220_%28cropped%29.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Muse_reading_Louvre_CA2220_%28cropped%29.jpg/640px-Muse_reading_Louvre_CA2220_%28cropped%29.jpg",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      licenseUrl: "https://en.wikipedia.org/wiki/Public_domain",
      author: "Unknown",
      requiresAttribution: false,
      attributionText: "Unknown, Public domain, via Wikimedia Commons"
    }
  },
  {
    id: "sample-animal-1",
    title: "Cat on ground",
    category: "animal",
    expectedImageKind: "naturalPhoto",
    expectedElementCategories: ["animal", "plant", "terrain"],
    expectedVisibleElementLabels: ["cat", "pavement", "berries", "leaves"],
    expectedVisibleElementLabelAliases: {
      "cat": ["animal", "kitten", "feline", "tabby cat"],
      "pavement": ["concrete", "sidewalk", "ground", "concrete pavement", "stone"],
      "berries": ["berry", "red berries", "fruit", "berries"],
      "leaves": ["leaf", "green leaves", "plant", "foliage", "leaves"]
    },
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Sleeping_cat_on_her_back.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5e/Sleeping_cat_on_her_back.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Sleeping_cat_on_her_back.jpg/640px-Sleeping_cat_on_her_back.jpg",
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
    expectedElementCategories: ["plant"],
    expectedVisibleElementLabels: ["sunflower", "petals", "leaves"],
    optionalElementCategories: ["weatherOrSky"],
    optionalVisibleElementLabels: ["sky"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:A_sunflower.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a9/A_sunflower.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/A_sunflower.jpg/640px-A_sunflower.jpg",
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
      pageUrl: "https://commons.wikimedia.org/wiki/File:Sittingroom-edit1.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/46/Sittingroom-edit1.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Sittingroom-edit1.jpg/640px-Sittingroom-edit1.jpg",
      licenseKind: "cc0",
      licenseName: "CC0 1.0 Universal",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      author: "User:Raysonho",
      requiresAttribution: false,
      attributionText: "Raysonho, CC0, via Wikimedia Commons"
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
      pageUrl: "https://commons.wikimedia.org/wiki/File:Set_of_fourteen_side_chairs_MET_DP110780.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c6/Set_of_fourteen_side_chairs_MET_DP110780.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Set_of_fourteen_side_chairs_MET_DP110780.jpg/640px-Set_of_fourteen_side_chairs_MET_DP110780.jpg",
      licenseKind: "cc0",
      licenseName: "CC0 1.0 Universal",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      author: "Metropolitan Museum of Art",
      requiresAttribution: false,
      attributionText: "Metropolitan Museum of Art, CC0, via Wikimedia Commons"
    }
  },
  {
    id: "sample-stationery-1",
    title: "HB Pencil Close-up",
    category: "stationery",
    expectedImageKind: "productPhoto",
    expectedElementCategories: ["product", "tool"],
    expectedVisibleElementLabels: ["pencil", "graphite tip", "ferrule", "eraser"],
    expectedVisibleElementLabelAliases: {
      "pencil": ["HB pencil", "blue pencil", "pen"],
      "graphite tip": ["lead", "tip"],
      "ferrule": ["metal ring", "metal band"]
    },
    expectedVisibleText: ["HB"],
    expectedNotes: "The source filename is Pencils_hb.jpg, but this sample acts as a close-up pencil image for evaluating product detail extraction.",
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Pencils_hb.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/0/08/Pencils_hb.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Pencils_hb.jpg/640px-Pencils_hb.jpg",
      licenseKind: "ccBySa",
      licenseName: "CC BY-SA 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
      author: "Michael S. (cool_breeze)",
      requiresAttribution: true,
      attributionText: "Michael S., CC BY-SA 3.0, via Wikimedia Commons"
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
      pageUrl: "https://commons.wikimedia.org/wiki/File:Interior_of_Biblioth%C3%A8que_Mazarine_003.JPG",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/d/df/Interior_of_Biblioth%C3%A8que_Mazarine_003.JPG",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Interior_of_Biblioth%C3%A8que_Mazarine_003.JPG/640px-Interior_of_Biblioth%C3%A8que_Mazarine_003.JPG",
      licenseKind: "ccBySa",
      licenseName: "CC BY-SA 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
      author: "Franck R.",
      requiresAttribution: true,
      attributionText: "Franck R., CC BY-SA 3.0, via Wikimedia Commons"
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
    title: "Antique Bureau Table",
    category: "furniture",
    expectedImageKind: "productPhoto",
    expectedElementCategories: ["furniture"],
    expectedVisibleElementLabels: ["desk", "bureau table", "drawer pulls", "shell carvings"],
    expectedVisibleElementLabelAliases: {
      "desk": ["bureau table", "kneehole desk", "block-front desk"],
      "drawer pulls": ["brass pulls", "brass hardware"],
      "shell carvings": ["carved shells", "shell motif"]
    },
    expectedNotes: "The ID is sample-mixed-1 but the image is actually an antique furniture product-style photo, not a modern desk setup. TODO: Add a real mixed sample later.",
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Bureau_table_MET_DP108643.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/12/Bureau_table_MET_DP108643.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Bureau_table_MET_DP108643.jpg/640px-Bureau_table_MET_DP108643.jpg",
      licenseKind: "cc0",
      licenseName: "CC0 1.0 Universal",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      author: "Metropolitan Museum of Art",
      requiresAttribution: false,
      attributionText: "Metropolitan Museum of Art, CC0, via Wikimedia Commons"
    }
  },
  {
    id: "sample-receipt-synthetic",
    title: "Synthetic Market Receipt",
    category: "receipt",
    expectedImageKind: "receiptPhoto",
    expectedElementCategories: ["document", "textRegion"],
    expectedVisibleElementLabels: ["receipt", "text", "prices", "items", "total"],
    expectedVisibleText: ["TOTAL", "$"],
    source: {
      provider: "localFixture",
      imageUrl: "/visual-samples/synthetic-receipt.png",
      thumbnailUrl: "/visual-samples/synthetic-receipt.png",
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
    expectedVisibleText: ["ADMIT ONE", "TICKET"],
    source: {
      provider: "localFixture",
      imageUrl: "/visual-samples/synthetic-ticket.png",
      thumbnailUrl: "/visual-samples/synthetic-ticket.png",
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
