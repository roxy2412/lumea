(function () {
  const KEYS = {
    products: "lumea_v6_products",
    settings: "lumea_v3_settings",
    orders: "lumea_v3_orders",
    cart: "lumea_v3_cart",
    subscribers: "lumea_v3_subscribers",
    emailTemplates: "lumea_v1_email_templates",
    session: "lumea_v3_admin_session"
  };

  const ADMIN_EMAIL = "lumea.cosmeticnatural@gmail.com";
  let apiEnabled = false;
  let catalogHydratedFromServer = false;
  const memory = new Map();

  try {
    localStorage.removeItem(KEYS.products);
  } catch {
    // La base de datos remota es la fuente principal del catálogo.
  }

  const defaults = {
    rate: 41,
    margin: 0.3,
    shippingMxnPerKg: 200,
    minimumShippingGrams: 15,
    supportEmail: ADMIN_EMAIL,
    ordersEmail: ADMIN_EMAIL,
    orderNotificationEmail: ADMIN_EMAIL,
    orderNotificationFrom: "",
    categoryVisibility: {},
    categoryLabels: {},
    cancelHours: 24,
    whatsapp: "+5353691859",
    preparationTime: "1 a 2 días",
    deliveryTime: "7 a 10 días después de la preparación",
    depositTerms: "Para solicitar el pedido se abona el 20% del total mediante tarjeta y se adjunta el comprobante. El saldo se paga según la modalidad seleccionada.",
    cancellationPolicy: "Puedes cancelar durante las primeras 24 horas y recibir la devolución del anticipo. Después de ese plazo puedes cancelar, pero el anticipo no es reembolsable.",
    privacyPolicy: "Usamos tus datos únicamente para procesar el pedido, coordinar la entrega y comunicarnos contigo. No vendemos ni compartimos tu información con terceros ajenos al servicio.",
    pickupAddress: "Punto de recogida LUMEA, La Habana (dirección a confirmar)",
    bank: {
      beneficiary: "LUMEA Cosmetics Store",
      bank: "Banco por configurar",
      card: "Configure el número desde Administración",
      currency: "CUP",
      instructions: "Realiza la transferencia y adjunta una captura legible."
    },
    municipalities: [
      { id: "playa", name: "Playa", fee: 500, active: true },
      { id: "plaza", name: "Plaza de la Revolución", fee: 450, active: true },
      { id: "centro", name: "Centro Habana", fee: 400, active: true },
      { id: "habana-vieja", name: "La Habana Vieja", fee: 450, active: true },
      { id: "cerro", name: "Cerro", fee: 450, active: true },
      { id: "diez-octubre", name: "Diez de Octubre", fee: 500, active: true },
      { id: "marianao", name: "Marianao", fee: 550, active: true },
      { id: "la-lisa", name: "La Lisa", fee: 600, active: true },
      { id: "boyeros", name: "Boyeros", fee: 650, active: true },
      { id: "arroyo", name: "Arroyo Naranjo", fee: 650, active: true },
      { id: "san-miguel", name: "San Miguel del Padrón", fee: 650, active: true },
      { id: "guanabacoa", name: "Guanabacoa", fee: 700, active: true },
      { id: "regla", name: "Regla", fee: 650, active: true },
      { id: "cotorro", name: "Cotorro", fee: 750, active: true },
      { id: "habana-este", name: "La Habana del Este", fee: 800, active: true }
    ]
  };

  const defaultEmailTemplates = [
    {
      id: "gracias-pedido",
      name: "Gracias por tu pedido",
      subject: "Gracias por tu pedido {{pedido}}",
      body: "Hola {{nombre}},\n\nGracias por comprar en LUMEA. Recibimos tu pedido {{pedido}}.\n\nIncluye:\n{{productos}}\n\nTotal: {{total}}\n\nTe avisaremos cuando esté listo."
    },
    {
      id: "pedido-en-camino",
      name: "Pedido en camino",
      subject: "Tu pedido {{pedido}} está en camino",
      body: "Hola {{nombre}},\n\nTu pedido {{pedido}} ya está en camino.\n\nIncluye:\n{{productos}}\n\nEstado: {{estado}}."
    },
    {
      id: "pedido-listo",
      name: "Pedido listo para entrega",
      subject: "Tu pedido {{pedido}} está listo",
      body: "Hola {{nombre}},\n\nTu pedido {{pedido}} está listo para entrega.\n\nIncluye:\n{{productos}}\n\nTotal: {{total}}."
    }
  ];

  function read(key, fallback) {
    if (memory.has(key)) return memory.get(key);
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    memory.set(key, value);
    if (key !== KEYS.products) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Mantiene la sesión operativa aunque el navegador alcance su cuota local.
      }
    }
    window.dispatchEvent(new CustomEvent("lumea:data", { detail: key }));
    return value;
  }

  async function api(path, options = {}) {
    let response;
    try {
      response = await fetch(path, {
        credentials: "same-origin",
        ...options,
        headers: {
          ...(options.body ? { "content-type": "application/json" } : {}),
          ...(options.headers || {})
        }
      });
    } catch {
      throw new Error("No se pudo conectar con la tienda. Revisa tu internet e intenta de nuevo; si adjuntaste una captura, prueba con una imagen mas ligera.");
    }
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) {
      const error = new Error(payload?.error || "No pudimos sincronizar la información.");
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function persistRemote(key, value, path) {
    write(key, value);
    if (apiEnabled) {
      if (path === "/api/admin/products") {
        const batches = value.length ? value : [""];
        for (let index = 0; index < batches.length; index += 40) {
          await api(path, {
            method: "PUT",
            body: JSON.stringify({ products: value.slice(index, index + 40), reset: index === 0 })
          });
        }
      } else if (path === "/api/admin/orders") {
        for (let index = 0; index < value.length; index += 40) {
          await api(path, { method: "PUT", body: JSON.stringify(value.slice(index, index + 40)) });
        }
      } else if (path === "/api/admin/subscribers") {
        const batches = value.length ? value : [""];
        for (let index = 0; index < batches.length; index += 40) {
          await api(path, {
            method: "PUT",
            body: JSON.stringify({ subscribers: value.slice(index, index + 40), reset: index === 0 })
          });
        }
      } else {
        await api(path, { method: "PUT", body: JSON.stringify(value) });
      }
    }
    return value;
  }

  async function saveProduct(product) {
    if (apiEnabled) {
      await api(`/api/admin/products/${encodeURIComponent(product.id)}`, {
        method: "PUT",
        body: JSON.stringify(product)
      });
    }
    const products = getProducts();
    const index = products.findIndex((item) => item.id === product.id);
    if (index >= 0) products[index] = product;
    else products.unshift(product);
    write(KEYS.products, products);
    return product;
  }

  async function deleteProduct(productId) {
    if (apiEnabled) {
      await api(`/api/admin/products/${encodeURIComponent(productId)}`, { method: "DELETE" });
    }
    write(KEYS.products, getProducts().filter((product) => product.id !== productId));
    return true;
  }

  async function saveProducts(changedProducts) {
    if (apiEnabled) {
      for (let index = 0; index < changedProducts.length; index += 10) {
        await api("/api/admin/products", {
          method: "PUT",
          body: JSON.stringify({ products: changedProducts.slice(index, index + 10), reset: false })
        });
      }
    }
    const changedById = new Map(changedProducts.map((product) => [product.id, product]));
    const products = getProducts().map((product) => changedById.get(product.id) || product);
    const known = new Set(products.map((product) => product.id));
    changedProducts.forEach((product) => {
      if (!known.has(product.id)) products.unshift(product);
    });
    write(KEYS.products, products);
    return changedProducts;
  }

  async function deleteProducts(productIds) {
    if (apiEnabled) {
      for (let index = 0; index < productIds.length; index += 40) {
        await api("/api/admin/products", {
          method: "DELETE",
          body: JSON.stringify({ ids: productIds.slice(index, index + 40) })
        });
      }
    }
    const deleted = new Set(productIds);
    write(KEYS.products, getProducts().filter((product) => !deleted.has(product.id)));
    return true;
  }

  async function hydratePublic() {
    try {
      const response = await fetch("/api/bootstrap", { credentials: "same-origin" });
      if (!response.ok || !(response.headers.get("content-type") || "").includes("application/json")) return false;
      const data = await response.json();
      apiEnabled = true;
      catalogHydratedFromServer = true;
      write(KEYS.products, Array.isArray(data.products) ? data.products : []);
      if (data.settings) write(KEYS.settings, data.settings);
      return true;
    } catch {
      return false;
    }
  }

  const ready = hydratePublic();

  function getSettings() {
    const saved = read(KEYS.settings, {});
    return {
      ...defaults,
      ...saved,
      supportEmail: ADMIN_EMAIL,
      ordersEmail: ADMIN_EMAIL,
      categoryVisibility: { ...defaults.categoryVisibility, ...(saved.categoryVisibility || {}) },
      categoryLabels: { ...defaults.categoryLabels, ...(saved.categoryLabels || {}) },
      bank: { ...defaults.bank, ...(saved.bank || {}) },
      municipalities: saved.municipalities || defaults.municipalities
    };
  }

  function getProducts() {
    const stored = read(KEYS.products, null);
    if (catalogHydratedFromServer) return Array.isArray(stored) ? stored : [];
    const seed = (window.LUMEA_CATALOG || []).map((product) => ({
      ...product,
      active: product.active !== false,
      variants: (product.variants || []).map((variant) => ({
        ...variant,
        label: variant.label || "Unidad",
        amount: Number(variant.amount) || 1,
        unit: variant.unit || "unidad",
        shippingWeightKg: Number(variant.shippingWeightKg ?? variant.weight) || 0,
        weight: Number(variant.shippingWeightKg ?? variant.weight) || 0,
        mxn: Number(variant.bioaleiPriceMxn ?? variant.mxn) || 0,
        bioaleiPriceMxn: Number(variant.bioaleiPriceMxn ?? variant.mxn) || 0,
        publicPriceCup: Number(variant.publicPriceCup) || 0,
        stock: variant.stock === "" || variant.stock == null ? null : Math.max(0, Number(variant.stock))
      }))
    }));
    if (stored && stored.length) {
      const seedBySource = new Map(seed.map((product) => [product.sourceUrl || product.id, product]));
      let changed = false;
      const migrated = stored.map((product) => {
        const reference = seedBySource.get(product.sourceUrl || product.id);
        let next = product;
        if (reference && !product.family) {
          changed = true;
          next = {
            ...product,
            family: reference.family,
            subcategory: reference.subcategory,
            taxonomy: reference.taxonomy
          };
        }
        const isBioaleiProduct = /^https?:\/\/(?:www\.)?bioalei\.com\//i.test(String(reference?.sourceUrl || ""));
        const originalBioaleiImage = /^https?:\/\/(?:www\.)?bioalei\.com\//i.test(String(reference?.image || ""));
        const hasCuratedLumeaImage = /^assets\/lumea-/i.test(String(next.image || ""));
        const hasSelectedLumeaImage = /^assets\/lumea-(?:fragancias|baba-de-caracol|colageno|preservantes-liquidos)\.jpg$/i.test(String(reference?.image || ""));
        if (hasSelectedLumeaImage && next.image !== reference.image) {
          next = { ...next, image: reference.image };
          changed = true;
        }
        if (isBioaleiProduct && originalBioaleiImage && hasCuratedLumeaImage) {
          next = { ...next, image: reference.image };
          changed = true;
        }
        return next;
      });
      const known = new Set(migrated.map((product) => product.sourceUrl || product.id));
      seed.forEach((product) => {
        if (!known.has(product.sourceUrl || product.id)) {
          migrated.push(product);
          changed = true;
        }
      });
      if (changed) write(KEYS.products, migrated);
      return migrated;
    }
    write(KEYS.products, seed);
    return seed;
  }

  function shippingGrams(variant, settings = getSettings()) {
    const override = Number(variant.shippingWeightGrams);
    if (override > 0) return override;
    const amount = Number(variant.amount);
    const unit = String(variant.unit || "").toLowerCase();
    if (amount > 0 && ["g", "gr", "gramo", "gramos", "ml"].includes(unit)) return amount;
    if (amount > 0 && ["kg", "kgs", "l", "lt", "lts"].includes(unit)) return amount * 1000;
    const label = String(variant.label || "");
    const match = label.match(/(\d+(?:[.,]\d+)?)\s*(kg|kgs|g|gr|gramos?|ml|l|lt|lts)\b/i);
    if (match) {
      const value = Number(match[1].replace(",", "."));
      return /^(kg|kgs|l|lt|lts)$/i.test(match[2]) ? value * 1000 : value;
    }
    if (/\bx\s*kg\b/i.test(label)) return 1000;
    return Number(settings.minimumShippingGrams) || 15;
  }

  function shippingCostMxn(variant, settings = getSettings()) {
    return (shippingGrams(variant, settings) * Number(settings.shippingMxnPerKg)) / 1000;
  }

  function price(variant, settings = getSettings()) {
    const publicPrice = Number(variant.publicPriceCup);
    if (publicPrice > 0) return Math.round(publicPrice);
    const supplierPrice = Number(variant.bioaleiPriceMxn ?? variant.mxn ?? 0);
    const cost = supplierPrice + shippingCostMxn(variant, settings);
    return Math.round((cost / (1 - Number(settings.margin))) * Number(settings.rate));
  }

  function orderNumber() {
    return `LUM-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  function canCancel(order, settings = getSettings()) {
    return !["Cancelado", "Entregado", "Recogido"].includes(order.status);
  }

  function cancellationRefundable(order, settings = getSettings()) {
    const limit = Number(settings.cancelHours) * 60 * 60 * 1000;
    return Date.now() - new Date(order.createdAt).getTime() <= limit;
  }

  async function refreshAdminData() {
    if (!apiEnabled) return false;
    try {
      const data = await api("/api/admin/bootstrap");
      const localProducts = getProducts();
      const localSettings = getSettings();
      const localTemplates = read(KEYS.emailTemplates, defaultEmailTemplates);
      const localSubscribers = read(KEYS.subscribers, []);

      if (data.products?.length) write(KEYS.products, data.products);
      else await persistRemote(KEYS.products, localProducts, "/api/admin/products");

      if (data.settings) write(KEYS.settings, data.settings);
      else await persistRemote(KEYS.settings, localSettings, "/api/admin/settings");

      if (data.emailTemplates?.length) write(KEYS.emailTemplates, data.emailTemplates);
      else await persistRemote(KEYS.emailTemplates, localTemplates, "/api/admin/email-templates");

      if (data.subscribers?.length) write(KEYS.subscribers, data.subscribers);
      else if (localSubscribers.length) await persistRemote(KEYS.subscribers, localSubscribers, "/api/admin/subscribers");

      write(KEYS.orders, data.orders || []);
      return true;
    } catch (error) {
      if (error.status === 401) sessionStorage.removeItem(KEYS.session);
      return false;
    }
  }

  window.LumeaStore = {
    KEYS,
    defaults,
    ready,
    apiEnabled: () => apiEnabled,
    money: (value) => `${Math.round(value).toLocaleString("es-MX")} CUP`,
    getSettings,
    setSettings: (value) => persistRemote(KEYS.settings, value, "/api/admin/settings"),
    getProducts,
    saveProduct,
    deleteProduct,
    saveProducts,
    deleteProducts,
    setProducts: (value) => persistRemote(KEYS.products, value, "/api/admin/products"),
    getOrders: () => read(KEYS.orders, []),
    setOrders: (value) => persistRemote(KEYS.orders, value, "/api/admin/orders"),
    async saveAdminOrder(order) {
      const saved = {
        ...order,
        updatedAt: new Date().toISOString()
      };
      if (apiEnabled) {
        const result = await api(`/api/admin/orders/${encodeURIComponent(saved.id)}`, {
          method: "PUT",
          body: JSON.stringify(saved)
        });
        Object.assign(saved, result.order || {});
      }
      const orders = read(KEYS.orders, []);
      const index = orders.findIndex((item) => item.id === saved.id);
      if (index >= 0) orders[index] = saved;
      else orders.unshift(saved);
      write(KEYS.orders, orders);
      return saved;
    },
    async deleteOrder(orderId) {
      if (apiEnabled) await api(`/api/admin/orders/${encodeURIComponent(orderId)}`, { method: "DELETE" });
      write(KEYS.orders, read(KEYS.orders, []).filter((order) => order.id !== orderId));
      return true;
    },
    getCart: () => read(KEYS.cart, []),
    setCart: (value) => write(KEYS.cart, value),
    getSubscribers: () => read(KEYS.subscribers, []),
    setSubscribers: (value) => persistRemote(KEYS.subscribers, value, "/api/admin/subscribers"),
    getEmailTemplates: () => read(KEYS.emailTemplates, defaultEmailTemplates),
    setEmailTemplates: (value) => persistRemote(KEYS.emailTemplates, value, "/api/admin/email-templates"),
    isAdmin: () => sessionStorage.getItem(KEYS.session) === "active",
    hasAdmin: () => true,
    async login(user, password) {
      if (!apiEnabled) return false;
      try {
        await api("/api/admin/login", {
          method: "POST",
          body: JSON.stringify({ email: user.trim(), password })
        });
        sessionStorage.setItem(KEYS.session, "active");
        await refreshAdminData();
        return true;
      } catch {
        return false;
      }
    },
    logout() {
      sessionStorage.removeItem(KEYS.session);
      if (apiEnabled) api("/api/admin/logout", { method: "POST" }).catch(() => {});
    },
    refreshAdminData,
    price,
    shippingGrams,
    shippingCostMxn,
    orderNumber,
    canCancel,
    cancellationRefundable,
    async lookupOrder(id, phone) {
      if (apiEnabled) {
        const result = await api("/api/orders/lookup", {
          method: "POST",
          body: JSON.stringify({ id, phone })
        });
        return result.order;
      }
      return read(KEYS.orders, []).find((item) =>
        item.id.toLowerCase() === id.toLowerCase()
        && String(item.customer.phone || "").replace(/\D/g, "") === String(phone || "").replace(/\D/g, "")
      ) || null;
    },
    async cancelOrder(order) {
      if (apiEnabled) {
        const result = await api(`/api/orders/${encodeURIComponent(order.id)}/cancel`, {
          method: "POST",
          body: JSON.stringify({ phone: order.customer.phone })
        });
        return result.order;
      }
      const orders = read(KEYS.orders, []);
      const saved = orders.find((item) => item.id === order.id);
      if (!saved) return null;
      saved.status = "Cancelado";
      saved.cancelledAt = new Date().toISOString();
      saved.cancellationRefund = cancellationRefundable(saved);
      write(KEYS.orders, orders);
      return saved;
    },
    async subscribe(email) {
      if (apiEnabled) {
        await api("/api/subscribers", { method: "POST", body: JSON.stringify({ email }) });
        return true;
      }
      const subscribers = read(KEYS.subscribers, []);
      if (!subscribers.includes(email)) subscribers.push(email);
      write(KEYS.subscribers, subscribers);
      return true;
    },
    async saveOrder(order) {
      if (apiEnabled) {
        const result = await api("/api/orders", { method: "POST", body: JSON.stringify(order) });
        const saved = result.order || order;
        const orders = read(KEYS.orders, []);
        orders.unshift(saved);
        write(KEYS.orders, orders);
        return saved;
      }
      const orders = read(KEYS.orders, []);
      orders.unshift(order);
      write(KEYS.orders, orders);
      return order;
    }
  };
})();
