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
  },
  {
    id: "sample-artwork-1",
    title: "Starry Night",
    category: "artwork",
    expectedImageKind: "artworkPhoto",
    expectedElementCategories: ["landscapeElement", "weatherOrSky", "building"],
    expectedVisibleElementLabels: ["painting", "starry sky", "cypress", "village"],
    optionalElementCategories: ["terrain"],
    optionalVisibleElementLabels: ["moon", "stars", "brushstrokes", "hills"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Vincent_van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/0/01/Vincent_van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Vincent_van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/640px-Vincent_van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      licenseUrl: "https://en.wikipedia.org/wiki/Public_domain",
      author: "Vincent van Gogh",
      requiresAttribution: false,
      attributionText: "Vincent van Gogh, Public domain, via Wikimedia Commons"
    }
  },
  {
    id: "sample-artifact-rosetta-1",
    title: "Rosetta Stone",
    category: "artifact",
    expectedImageKind: "artifactPhoto",
    expectedElementCategories: ["document", "textRegion", "symbol"],
    expectedVisibleElementLabels: ["stone slab", "inscription", "text"],
    optionalElementCategories: ["unknown"],
    optionalVisibleElementLabels: ["museum artifact", "broken stone", "carved text"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Rosetta_Stone_BW.jpeg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/ca/Rosetta_Stone_BW.jpeg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Rosetta_Stone_BW.jpeg/640px-Rosetta_Stone_BW.jpeg",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      licenseUrl: "https://en.wikipedia.org/wiki/Public_domain",
      author: "British Museum",
      requiresAttribution: false,
      attributionText: "British Museum, Public domain, via Wikimedia Commons"
    }
  },
  {
    id: "sample-space-earth-1",
    title: "Earth from Space (Blue Marble)",
    category: "space",
    expectedImageKind: "spacePhoto",
    expectedElementCategories: ["waterBody", "terrain", "weatherOrSky"],
    expectedVisibleElementLabels: ["earth", "clouds", "ocean", "land"],
    optionalElementCategories: ["symbol"],
    optionalVisibleElementLabels: ["space", "planet"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:The_Earth_seen_from_Apollo_17.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/9/97/The_Earth_seen_from_Apollo_17.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/The_Earth_seen_from_Apollo_17.jpg/640px-The_Earth_seen_from_Apollo_17.jpg",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      licenseUrl: "https://en.wikipedia.org/wiki/Public_domain",
      author: "NASA / Apollo 17 crew",
      requiresAttribution: false,
      attributionText: "NASA / Apollo 17 crew, Public domain, via Wikimedia Commons"
    }
  },
  {
    id: "sample-medical-xray-1",
    title: "Chest X-Ray",
    category: "medical",
    expectedImageKind: "medicalImage",
    expectedElementCategories: ["medical", "bodyPart"],
    expectedVisibleElementLabels: ["x-ray", "chest", "ribs"],
    optionalElementCategories: ["unknown"],
    optionalVisibleElementLabels: ["lungs", "spine", "grayscale"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Chest_radiograph_2D_Fourier_Spectrum.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5f/Chest_radiograph_2D_Fourier_Spectrum.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Chest_radiograph_2D_Fourier_Spectrum.jpg/640px-Chest_radiograph_2D_Fourier_Spectrum.jpg",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      licenseUrl: "https://en.wikipedia.org/wiki/Public_domain",
      author: "Kieran Maher",
      requiresAttribution: false,
      attributionText: "Kieran Maher, Public domain, via Wikimedia Commons"
    }
  },
  {
    id: "sample-map-1",
    title: "Labeled World Map",
    category: "map",
    expectedImageKind: "mapImage",
    expectedElementCategories: ["textRegion", "symbol"],
    expectedVisibleElementLabels: ["map", "labels", "boundaries"],
    optionalElementCategories: ["waterBody", "terrain"],
    optionalVisibleText: ["PACIFIC", "ATLANTIC", "OCEAN"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:World_Map_1689.JPG",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/3/3b/World_Map_1689.JPG",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/World_Map_1689.JPG/640px-World_Map_1689.JPG",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      licenseUrl: "https://en.wikipedia.org/wiki/Public_domain",
      author: "Gerard van Schagen",
      requiresAttribution: false,
      attributionText: "Gerard van Schagen, Public domain, via Wikimedia Commons"
    }
  },
  {
    id: "sample-food-1",
    title: "Roasted Turkey on Plate",
    category: "food",
    expectedImageKind: "foodPhoto",
    expectedElementCategories: ["food", "container"],
    expectedVisibleElementLabels: ["food", "plate"],
    optionalElementCategories: ["unknown"],
    optionalVisibleElementLabels: ["roasted turkey", "garnishes"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Roasted_chicken_and_Turkish_pilaf.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Roasted_chicken_and_Turkish_pilaf.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Roasted_chicken_and_Turkish_pilaf.jpg/640px-Roasted_chicken_and_Turkish_pilaf.jpg",
      licenseKind: "ccBySa",
      licenseName: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      author: "E4024",
      requiresAttribution: true,
      attributionText: "E4024, CC BY-SA 4.0, via Wikimedia Commons"
    }
  },
  {
    id: "sample-street-signs-1",
    title: "Tokyo Neon Street Signs",
    category: "street",
    expectedImageKind: "landscapePhoto",
    expectedElementCategories: ["building", "signage"],
    expectedVisibleElementLabels: ["street", "signs", "neon"],
    optionalElementCategories: ["roadOrPath"],
    optionalVisibleText: ["KABUKICHO"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Kabukicho_red_gate_and_colorful_neon_street_signs_at_night,_Shinjuku,_Tokyo,_Japan.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/9/92/Kabukicho_red_gate_and_colorful_neon_street_signs_at_night%2C_Shinjuku%2C_Tokyo%2C_Japan.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Kabukicho_red_gate_and_colorful_neon_street_signs_at_night%2C_Shinjuku%2C_Tokyo%2C_Japan.jpg/640px-Kabukicho_red_gate_and_colorful_neon_street_signs_at_night%2C_Shinjuku%2C_Tokyo%2C_Japan.jpg",
      licenseKind: "ccBySa",
      licenseName: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      author: "Basile Morin",
      requiresAttribution: true,
      attributionText: "Basile Morin, CC BY-SA 4.0, via Wikimedia Commons"
    }
  },
  {
    id: "sample-vehicle-1",
    title: "Street View Camera Car",
    category: "vehicle",
    expectedImageKind: "naturalPhoto",
    expectedElementCategories: ["vehicle", "roadOrPath"],
    expectedVisibleElementLabels: ["car", "camera", "street"],
    optionalElementCategories: ["building"],
    optionalVisibleElementLabels: ["wheels", "road"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Google_Street_View_camera_car_in_Barcelona.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/53/Google_Street_View_camera_car_in_Barcelona.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Google_Street_View_camera_car_in_Barcelona.jpg/640px-Google_Street_View_camera_car_in_Barcelona.jpg",
      licenseKind: "publicDomain",
      licenseName: "CC0",
      licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
      author: "Jove",
      requiresAttribution: false,
      attributionText: "Jove, CC0, via Wikimedia Commons"
    }
  },
  {
    id: "sample-whiteboard-1",
    title: "Press Box Whiteboard",
    category: "documentLike",
    expectedImageKind: "whiteboardPhoto",
    expectedElementCategories: ["document", "textRegion"],
    expectedVisibleElementLabels: ["whiteboard", "handwriting", "numbers"],
    optionalElementCategories: ["unknown"],
    optionalVisibleText: ["ATTENDANCE", "WHITE SOX"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Attendance_figure_on_whiteboard_in_Camden_Yards_press_box_for_April_29,_2015,_White_Sox_game.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c5/Attendance_figure_on_whiteboard_in_Camden_Yards_press_box_for_April_29%2C_2015%2C_White_Sox_game.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Attendance_figure_on_whiteboard_in_Camden_Yards_press_box_for_April_29%2C_2015%2C_White_Sox_game.jpg/640px-Attendance_figure_on_whiteboard_in_Camden_Yards_press_box_for_April_29%2C_2015%2C_White_Sox_game.jpg",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      licenseUrl: "https://en.wikipedia.org/wiki/Public_domain",
      author: "Greg Fiume",
      requiresAttribution: false,
      attributionText: "Greg Fiume, Public domain, via Wikimedia Commons"
    }
  },
  {
    id: "sample-chart-1",
    title: "Candlestick Chart",
    category: "chartOrTable",
    expectedImageKind: "chartOrTable",
    expectedElementCategories: ["chart", "textRegion"],
    expectedVisibleElementLabels: ["candlestick chart", "axes", "price"],
    expectedVisibleElementLabelAliases: {
      "candlestick chart": ["candlestick chart", "candlestick", "chart", "forex chart"],
      "axes": ["axis", "axes", "x-axis", "y-axis", "x axis", "y axis", "date axis", "price axis", "horizontal axis", "vertical axis"],
      "price": ["price", "price scale", "price level", "y-axis", "vertical axis", "exchange rate", "rate scale"]
    },
    optionalElementCategories: ["unknown"],
    optionalVisibleText: ["EUR/USD"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Candlestick_chart_EURUSD_October_2009.PNG",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/9/91/Candlestick_chart_EURUSD_October_2009.PNG",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Candlestick_chart_EURUSD_October_2009.PNG/640px-Candlestick_chart_EURUSD_October_2009.PNG",
      licenseKind: "ccBySa",
      licenseName: "CC BY-SA 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
      author: "Lyakhovskiy Pavel",
      requiresAttribution: true,
      attributionText: "Lyakhovskiy Pavel, CC BY-SA 3.0, via Wikimedia Commons"
    }
  },
  {
    id: "sample-package-1",
    title: "Shampoo Bottle",
    category: "package",
    expectedImageKind: "packageImage",
    expectedElementCategories: ["productPackage", "textRegion"],
    expectedVisibleElementLabels: ["bottle", "label", "shampoo"],
    optionalElementCategories: ["unknown"],
    optionalVisibleText: ["Dove", "Nutritive Solutions"],
    source: {
      provider: "Wikimedia Commons",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Dove_shampoo_bottle.jpg",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/6/68/Dove_shampoo_bottle.jpg",
      thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Dove_shampoo_bottle.jpg/640px-Dove_shampoo_bottle.jpg",
      licenseKind: "publicDomain",
      licenseName: "CC0",
      licenseUrl: "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
      author: "Ranjima np",
      requiresAttribution: false,
      attributionText: "Ranjima np, CC0, via Wikimedia Commons"
    }
  },
  {
    id: "sample-chart-synthetic",
    title: "Synthetic Annual Revenue Chart",
    category: "chartOrTable",
    expectedImageKind: "chartOrTable",
    expectedElementCategories: ["chart", "textRegion"],
    expectedVisibleElementLabels: ["bar chart", "axis", "legend"],
    expectedVisibleElementLabelAliases: {
      "bar chart": ["bar chart", "chart", "graph"],
      "axis": ["axis", "axes", "x-axis", "y-axis", "x axis", "y axis", "horizontal axis", "vertical axis"],
      "legend": ["legend", "chart legend", "target revenue label"]
    },
    expectedVisibleText: ["Annual Revenue Growth", "Target Revenue", "2021", "2022", "2023", "2024", "$100K", "$75K", "$50K", "$25K", "$0"],
    source: {
      provider: "localFixture",
      imageUrl: "/visual-samples/synthetic-chart.png",
      thumbnailUrl: "/visual-samples/synthetic-chart.png",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      author: "indexmd test fixture",
      requiresAttribution: false,
      attributionText: "indexmd test fixture, Public domain"
    }
  },
  {
    id: "sample-table-synthetic",
    title: "Synthetic Milestones Table",
    category: "chartOrTable",
    expectedImageKind: "chartOrTable",
    expectedElementCategories: ["table", "textRegion"],
    expectedVisibleElementLabels: ["table", "rows", "columns", "headers"],
    expectedVisibleText: ["Project Milestones", "Task ID", "Description", "Status", "Budget", "TSK-01", "Setup Environment", "Completed", "$1,200", "TSK-02", "Develop Core API", "In Progress", "$4,500", "TSK-03", "Write Unit Tests", "Pending", "$800", "TOTAL BUDGET:", "$6,500"],
    source: {
      provider: "localFixture",
      imageUrl: "/visual-samples/synthetic-table.png",
      thumbnailUrl: "/visual-samples/synthetic-table.png",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      author: "indexmd test fixture",
      requiresAttribution: false,
      attributionText: "indexmd test fixture, Public domain"
    }
  },
  {
    id: "sample-ui-synthetic",
    title: "Synthetic Mobile Settings UI",
    category: "ui",
    expectedImageKind: "screenshot",
    expectedElementCategories: ["screen", "uiElement", "textRegion"],
    expectedVisibleElementLabels: ["settings screen", "toggle", "button"],
    expectedVisibleText: ["Settings", "Notifications", "Privacy", "Account Details", "Dark Mode", "Save Changes"],
    source: {
      provider: "localFixture",
      imageUrl: "/visual-samples/synthetic-ui-settings.png",
      thumbnailUrl: "/visual-samples/synthetic-ui-settings.png",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      author: "indexmd test fixture",
      requiresAttribution: false,
      attributionText: "indexmd test fixture, Public domain"
    }
  },
  {
    id: "sample-form-synthetic",
    title: "Synthetic Contact Form",
    category: "form",
    expectedImageKind: "screenshot",
    expectedElementCategories: ["document", "textRegion", "uiElement"],
    expectedVisibleElementLabels: ["form", "input field", "checkbox", "submit button"],
    expectedVisibleText: ["Contact Registration Form", "Please fill in your details below.", "Full Name", "Jane Doe", "Email Address", "jane.doe@example.com", "I agree to the Terms of Service", "Submit Form"],
    source: {
      provider: "localFixture",
      imageUrl: "/visual-samples/synthetic-form.png",
      thumbnailUrl: "/visual-samples/synthetic-form.png",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      author: "indexmd test fixture",
      requiresAttribution: false,
      attributionText: "indexmd test fixture, Public domain"
    }
  },
  {
    id: "sample-package-synthetic",
    title: "Synthetic Product Package Label",
    category: "package",
    expectedImageKind: "packageImage",
    expectedElementCategories: ["productPackage", "textRegion"],
    expectedVisibleElementLabels: ["package", "label", "ingredients", "barcode"],
    expectedVisibleText: ["ORGANIC HARVEST", "Roasted Almonds", "INGREDIENTS:", "Organic Almonds", "NET WT 8 OZ", "748192047582"],
    source: {
      provider: "localFixture",
      imageUrl: "/visual-samples/synthetic-package-label.png",
      thumbnailUrl: "/visual-samples/synthetic-package-label.png",
      licenseKind: "publicDomain",
      licenseName: "Public Domain",
      author: "indexmd test fixture",
      requiresAttribution: false,
      attributionText: "indexmd test fixture, Public domain"
    }
  },
  {
    id: "sample-mixed-scene-synthetic",
    title: "Synthetic Desk Setup Mixed Scene",
    category: "mixed",
    expectedImageKind: "mixed",
    expectedElementCategories: ["furniture", "document", "tool", "product"],
    expectedVisibleElementLabels: ["desk", "book", "cup", "phone", "note"],
    expectedVisibleText: ["JOURNAL", "Don't forget:", "roasted almonds", "Call mom @ 5pm", "10:42"],
    source: {
      provider: "localFixture",
      imageUrl: "/visual-samples/synthetic-mixed-desk.png",
      thumbnailUrl: "/visual-samples/synthetic-mixed-desk.png",
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
