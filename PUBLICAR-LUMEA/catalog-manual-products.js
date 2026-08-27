(function () {
  const image = "assets/lumea-productos-ligero.jpg";

  function scaledVariants({ baseAmount, baseMxn = 0, basePriceCup, amounts, unit, inventoryAvailable }) {
    return amounts.map((amount) => {
      const ratio = amount / baseAmount;
      const label = unit === "unidad"
        ? `${amount} ${amount === 1 ? "unidad" : "unidades"}`
        : `${amount} ${unit}`;
      return {
        label,
        amount,
        unit,
        inventoryAmount: amount,
        shippingWeightGrams: unit === "unidad" ? 50 * amount : amount,
        shippingWeightKg: unit === "unidad" ? .05 * amount : amount / 1000,
        weight: unit === "unidad" ? .05 * amount : amount / 1000,
        mxn: Math.round(baseMxn * ratio * 100) / 100,
        bioaleiPriceMxn: Math.round(baseMxn * ratio * 100) / 100,
        publicPriceCup: Math.round(basePriceCup * ratio),
        stock: Math.floor(inventoryAvailable / amount)
      };
    });
  }

  function product(data) {
    return {
      active: true,
      image,
      quoteOnly: false,
      inventoryAvailable: data.inventoryAvailable,
      inventoryUnit: data.unit,
      initialInventory: data.inventoryAvailable,
      tableBaseQuantity: data.baseAmount,
      variants: scaledVariants(data),
      ...data,
      image
    };
  }

  const manualProducts = [
    product({ id: "agar-agar-polvo", name: "Agar agar en polvo", category: "Insumos", family: "Insumos para Cosmética Natural e Higiene Personal", subcategory: "Espesantes & Emulsionantes", baseAmount: 50, baseMxn: 53.88, basePriceCup: 3104, amounts: [25, 50, 100, 150], unit: "g", inventoryAvailable: 150 }),
    product({ id: "albumina-huevo-polvo", name: "Albúmina de huevo en polvo", category: "Insumos", family: "Insumos para Cosmética Natural e Higiene Personal", subcategory: "Aditivos Cosméticos", baseAmount: 50, baseMxn: 19.55, basePriceCup: 1445, amounts: [25, 50, 100], unit: "g", inventoryAvailable: 101 }),
    product({ id: "arroz-molido", name: "Arroz molido", category: "Insumos", family: "Insumos para Cosmética Natural e Higiene Personal", subcategory: "Hierbas & Arcillas", baseAmount: 500, baseMxn: 12.53, basePriceCup: 1105, amounts: [100, 250, 500], unit: "g", inventoryAvailable: 998 }),
    product({ id: "camu-camu-polvo", name: "Camu camu en polvo", category: "Insumos", family: "Insumos para Cosmética Natural e Higiene Personal", subcategory: "Hierbas & Arcillas", baseAmount: 50, baseMxn: 50, basePriceCup: 2917, amounts: [25, 50, 100], unit: "g", inventoryAvailable: 100 }),
    product({ id: "capsulas-ceramida", name: "Cápsulas de ceramida", category: "Insumos", family: "Insumos para Cosmética Natural e Higiene Personal", subcategory: "Activos & Vitaminas", baseAmount: 2, baseMxn: 50, basePriceCup: 2917, amounts: [1, 2], unit: "unidad", inventoryAvailable: 2 }),
    product({ id: "cola-caballo-polvo", name: "Cola de caballo en polvo", category: "Insumos", family: "Insumos para Cosmética Natural e Higiene Personal", subcategory: "Hierbas & Arcillas", baseAmount: 50, baseMxn: 5.81, basePriceCup: 781, amounts: [25, 50], unit: "g", inventoryAvailable: 99 }),
    product({ id: "copal-polvo", name: "Copal en polvo", category: "Insumos", family: "Insumos para Cosmética Natural e Higiene Personal", subcategory: "Hierbas & Arcillas", baseAmount: 50, baseMxn: 5.29, basePriceCup: 756, amounts: [25, 50], unit: "g", inventoryAvailable: 97 }),
    product({ id: "garbanzo-molido", name: "Garbanzo molido", category: "Insumos", family: "Insumos para Cosmética Natural e Higiene Personal", subcategory: "Hierbas & Arcillas", baseAmount: 100, baseMxn: 4.29, basePriceCup: 707, amounts: [50, 100, 250], unit: "g", inventoryAvailable: 301 }),
    product({ id: "ginkgo-biloba-molido", name: "Ginkgo biloba molido", category: "Insumos", family: "Insumos para Cosmética Natural e Higiene Personal", subcategory: "Hierbas & Arcillas", baseAmount: 50, baseMxn: 14.11, basePriceCup: 1182, amounts: [25, 50, 100], unit: "g", inventoryAvailable: 101 }),
    product({ id: "haba-molida", name: "Haba molida", category: "Insumos", family: "Insumos para Cosmética Natural e Higiene Personal", subcategory: "Hierbas & Arcillas", baseAmount: 50, baseMxn: 5.64, basePriceCup: 772, amounts: [25, 50, 100], unit: "g", inventoryAvailable: 102 }),
    product({ id: "molde-azul-ovalado", name: "Molde azul ovalado", category: "Insumos", family: "Insumos para Jabón", subcategory: "Moldes para Jabón", baseAmount: 1, baseMxn: 71.5, basePriceCup: 3956, amounts: [1], unit: "unidad", inventoryAvailable: 1 }),
    product({ id: "molde-blanco-hotel", name: "Molde blanco hotel", category: "Insumos", family: "Insumos para Jabón", subcategory: "Moldes para Jabón", baseAmount: 2, baseMxn: 76, basePriceCup: 4173, amounts: [1, 2], unit: "unidad", inventoryAvailable: 2 }),
    product({ id: "molde-rosa-corazon-sencillo", name: "Molde rosa, corazón sencillo", category: "Insumos", family: "Insumos para Jabón", subcategory: "Moldes para Jabón", baseAmount: 1, baseMxn: 61.5, basePriceCup: 3473, amounts: [1], unit: "unidad", inventoryAvailable: 1 }),
    product({ id: "recipiente-para-medir", name: "Recipiente para medir", category: "Insumos", family: "Insumos para Cosmética Natural e Higiene Personal", subcategory: "Envases & Utensilios", baseAmount: 1, baseMxn: 13.75, basePriceCup: 1165, amounts: [1, 2], unit: "unidad", inventoryAvailable: 2 }),
    product({ id: "retinol-puro-liquido", name: "Retinol puro líquido", category: "Insumos", family: "Insumos para Cosmética Natural e Higiene Personal", subcategory: "Activos & Vitaminas", baseAmount: 10, baseMxn: 90, basePriceCup: 4850, amounts: [5, 10, 15, 30], unit: "ml", inventoryAvailable: 30 }),
    product({ id: "ruda-molida", name: "Ruda molida", category: "Insumos", family: "Insumos para Cosmética Natural e Higiene Personal", subcategory: "Hierbas & Arcillas", baseAmount: 50, baseMxn: 1.72, basePriceCup: 583, amounts: [25, 50, 100, 250], unit: "g", inventoryAvailable: 254 }),
    product({ id: "te-matcha-polvo", name: "Té matcha en polvo", category: "Insumos", family: "Insumos para Cosmética Natural e Higiene Personal", subcategory: "Hierbas & Arcillas", baseAmount: 50, baseMxn: 71, basePriceCup: 3932, amounts: [25, 50], unit: "g", inventoryAvailable: 50 }),
    product({ id: "dioxido-de-titanio", name: "Dióxido de titanio", category: "Insumos", family: "Insumos para Jabón", subcategory: "Pigmentos", baseAmount: 500, baseMxn: 0, basePriceCup: 4167, amounts: [100, 250, 500], unit: "g", inventoryAvailable: 500 })
  ];

  const catalog = window.LUMEA_CATALOG || (window.LUMEA_CATALOG = []);
  manualProducts.forEach((item) => {
    const index = catalog.findIndex((existing) => existing.id === item.id);
    if (index >= 0) catalog[index] = { ...catalog[index], ...item };
    else catalog.push(item);
  });
  window.LUMEA_MANUAL_PRODUCTS = manualProducts;
})();
