(function () {
  const catalog = window.LUMEA_CATALOG || [];

  const exactImages = {
    "manteca-de-karite": "assets/lumea-manteca-karite.jpg",
    "base-de-jabon-de-glicerina-opaca": "assets/lumea-glicerina-blanca.jpg",
    "base-de-jabon-de-glicerina-opaca-mayor-dureza": "assets/lumea-glicerina-blanca.jpg",
    "deshidratado-de-lavanda": "assets/lumea-lavanda-deshidratada.jpg",
    "deshidratado-de-cola-de-caballo": "assets/lumea-cola-de-caballo.jpg",
    "deshidratado-de-calendula": "assets/lumea-calendula-deshidratada.jpg",
    "carbon-activado": "assets/lumea-dried-herbs.jpeg",
    "cucharas-medidoras": "assets/lumea-logo-square.png",
    "tazas-medidoras": "assets/lumea-logo-square.png",
    "tiras-reactivas-ph": "assets/lumea-logo-square.png"
  };

  function curatedImage(product) {
    if (exactImages[product.id]) return exactImages[product.id];
    const id = String(product.id || "").toLowerCase();
    const name = String(product.name || "").toLowerCase();
    const subcategory = String(product.subcategory || "").toLowerCase();
    const family = String(product.family || "");
    const searchable = `${id} ${name} ${subcategory}`;

    if (searchable.includes("molde")) return "assets/lumea-molde-silicon.jpg";
    if (/fragancia|aroma|aceite|extracto|agua floral|saborizante|colorante líquido/.test(searchable)) {
      return "assets/lumea-insumo-liquido.jpg";
    }
    if (/deshidratado|hierbas|arcillas/.test(searchable)) return "assets/lumea-dried-herbs.jpeg";
    if (/base de jabón|glicerina/.test(searchable)) return "assets/lumea-glicerina-blanca.jpg";
    if (family === "Insumos para Velas") return "assets/lumea-soy-candle-supplies.jpeg";
    if (family === "Insumos para Jabón") return "assets/lumea-shampoo-supplies.jpeg";
    if (family === "Insumos para Cosmética Natural e Higiene Personal") {
      return "assets/lumea-organic-products-spanish.png";
    }
    return "assets/lumea-logo-square.png";
  }

  function selectedLumeaImage(product) {
    const id = String(product.id || "").toLowerCase();
    const subcategory = String(product.subcategory || "").toLowerCase();

    if (subcategory === "fragancias") return "assets/lumea-fragancias.jpg";
    if (id === "baba-de-caracol") return "assets/lumea-baba-de-caracol.jpg";
    if (id === "colageno") return "assets/lumea-colageno.jpg";
    if (subcategory === "conservadores") return "assets/lumea-preservantes-liquidos.jpg";
    return "";
  }

  const additions = [
    {
      id: "curcuma-en-polvo",
      name: "Cúrcuma en Polvo",
      category: "Insumos",
      image: "assets/lumea-dried-herbs.jpeg",
      description: "Cúrcuma en polvo para formulaciones cosméticas y preparaciones artesanales. Presentación y precio por confirmar.",
      active: true,
      quoteOnly: true,
      variants: [{ label: "Presentación por confirmar", amount: 1, unit: "unidad", shippingWeightKg: 0, mxn: 0, bioaleiPriceMxn: 0 }],
      family: "Insumos para Cosmética Natural e Higiene Personal",
      subcategory: "Hierbas & Arcillas"
    },
    {
      id: "chia",
      name: "Chía",
      category: "Insumos",
      image: "assets/lumea-dried-herbs.jpeg",
      description: "Semilla de chía para preparaciones artesanales. Presentación y precio por confirmar.",
      active: true,
      quoteOnly: true,
      variants: [{ label: "Presentación por confirmar", amount: 1, unit: "unidad", shippingWeightKg: 0, mxn: 0, bioaleiPriceMxn: 0 }],
      family: "Insumos para Cosmética Natural e Higiene Personal",
      subcategory: "Hierbas & Arcillas"
    },
    {
      id: "tiras-reactivas-ph",
      name: "Tiras Reactivas de pH",
      category: "Insumos",
      image: "assets/lumea-logo-square.png",
      sourceUrl: "https://bioalei.com/producto/paquete-con-80-tiras-de-papel-ph/",
      description: "Paquete con 80 tiras para medir líquidos en una escala de pH de 1 a 14. Incluye tabla colorimétrica y ofrece resultados en 2 a 3 segundos.",
      active: true,
      variants: [{ label: "Paquete con 80 tiras", amount: 1, unit: "unidad", shippingWeightKg: 0.05, weight: 0.05, mxn: 87, bioaleiPriceMxn: 87 }],
      family: "Insumos para Jabón",
      subcategory: "Utensilios",
      lastSyncedFromBioalei: "2026-06-28"
    }
  ];

  const known = new Set(catalog.map((product) => product.id));
  additions.forEach((product) => {
    if (!known.has(product.id)) catalog.push(product);
  });
  catalog.forEach((product) => {
    const selectedImage = selectedLumeaImage(product);
    if (selectedImage) product.image = selectedImage;
  });
  window.LUMEA_IMAGE_CURATION = curatedImage;
})();
