(async function () {
  const Store = window.LumeaStore;
  await Store.ready;
  if (Store.isAdmin()) await Store.refreshAdminData();
  const app = document.getElementById("adminApp");
  const storeApp = document.getElementById("storeApp");
  const adminState = {
    tab: "dashboard",
    query: "",
    productImage: "",
    productCategory: "",
    productPage: 1,
    selectedProducts: new Set(),
    emailTemplateId: "",
    orderView: "active"
  };
  const statuses = ["Pedido recibido", "En preparación", "Listo para entrega", "Enviado", "En proceso de entrega", "Entregado", "Recogido", "Cancelado"];

  function savedToast(message = "Guardado") {
    const element = document.getElementById("toast");
    if (!element) return;
    element.textContent = message;
    if (typeof element.showPopover === "function" && !element.matches(":popover-open")) element.showPopover();
    element.classList.add("show");
    clearTimeout(window.adminSavedToast);
    window.adminSavedToast = setTimeout(() => {
      element.classList.remove("show");
      setTimeout(() => {
        if (typeof element.hidePopover === "function" && element.matches(":popover-open")) element.hidePopover();
      }, 220);
    }, 2300);
  }

  function route() {
    const adminMode = location.hash === "#admin";
    app.hidden = !adminMode;
    storeApp.hidden = adminMode;
    document.getElementById("cartDrawer").hidden = adminMode;
    document.getElementById("overlay").hidden = adminMode;
    document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
    document.body.style.overflow = "";
    if (adminMode) renderAdmin();
  }

  function field(label, id, value = "", type = "text", extra = "") {
    return `<label class="field">${label}<input id="${id}" name="${id}" type="${type}" value="${String(value).replaceAll('"', "&quot;")}" ${extra} /></label>`;
  }

  function attribute(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  function renderAdmin() {
    if (!Store.isAdmin()) return renderLogin();
    renderShell();
  }

  function renderLogin() {
    app.innerHTML = `<div class="admin-login"><div class="admin-login-art"></div><div class="admin-login-panel">
      <div class="login-card"><img src="assets/lumea-logo-horizontal-ligero.jpg" alt="LUMEA" />
        <p class="eyebrow">ÁREA PRIVADA</p><h1>Administración</h1><p>Acceso exclusivo de LUMEA para gestionar completamente el catálogo, los pedidos, las entregas y las comunicaciones.</p>
        <form id="loginForm">${field("Correo administrador", "loginUser", "", "email", "required")}
          ${field("Contraseña", "loginPassword", "", "password", "required")}
          <p class="form-error" id="loginError"></p><button class="primary-btn">Entrar al panel</button></form>
        <a class="secondary-btn" href="#inicio">← Volver a la tienda</a>
      </div></div></div>`;
  }

  function renderShell() {
    const labels = {
      dashboard: "Resumen", products: "Productos", categories: "Categorías", orders: "Pedidos",
      delivery: "Municipios y entregas", bank: "Cuenta bancaria",
      campaigns: "Correos masivos", settings: "Configuración"
    };
    app.innerHTML = `<div class="admin-shell"><aside class="admin-sidebar">
      <img src="assets/lumea-logo-horizontal-ligero.jpg" alt="LUMEA" />
      <nav>${Object.entries(labels).map(([id, label]) => `<button class="admin-tab ${adminState.tab === id ? "active" : ""}" data-admin-tab="${id}">${label}</button>`).join("")}</nav>
      <footer><a href="#inicio">Ver tienda</a><button data-admin-logout>Cerrar sesión</button></footer>
    </aside><main class="admin-main" id="adminMain"></main></div>
    <dialog class="modal admin-modal" id="adminProductDialog"><button class="close" data-admin-close>×</button><div class="modal-pad" id="adminProductEditor"></div></dialog>
    <dialog class="modal admin-modal" id="adminBulkProductDialog"><button class="close" data-admin-bulk-close>×</button><div class="modal-pad" id="adminBulkProductEditor"></div></dialog>
    <dialog class="modal admin-modal order-edit-modal" id="adminOrderDialog"><button class="close" data-admin-order-close>×</button><div class="modal-pad" id="adminOrderEditor"></div></dialog>`;
    renderTab();
  }

  function top(title, subtitle, action = "") {
    return `<header class="admin-top"><div><p class="eyebrow">ADMINISTRACIÓN LUMEA</p><h1>${title}</h1><p>${subtitle}</p></div>${action}</header>`;
  }

  function renderTab() {
    const main = document.getElementById("adminMain");
    if (!main) return;
    ({
      dashboard: renderDashboard,
      products: renderProducts,
      categories: renderCategories,
      orders: renderOrders,
      delivery: renderDelivery,
      bank: renderBank,
      campaigns: renderCampaigns,
      settings: renderSettings
    }[adminState.tab] || renderDashboard)(main);
  }

  function renderDashboard(main) {
    const products = Store.getProducts();
    const orders = Store.getOrders();
    const pending = orders.filter((order) => !["Entregado", "Cancelado"].includes(order.status));
    const revenue = orders.filter((order) => order.status !== "Cancelado").reduce((sum, order) => sum + Number(order.total), 0);
    main.innerHTML = `${top("Resumen", "Una vista rápida de la operación de LUMEA.")}
      <section class="stat-grid">
        <article class="stat-card"><span>Productos activos</span><b>${products.filter((p) => p.active).length}</b></article>
        <article class="stat-card"><span>Pedidos activos</span><b>${pending.length}</b></article>
        <article class="stat-card"><span>Ventas registradas</span><b>${Store.money(revenue)}</b></article>
        <article class="stat-card"><span>Suscriptores</span><b>${Store.getSubscribers().length}</b></article>
      </section>
      <section class="admin-panel"><div class="admin-panel-head"><h2>Últimos pedidos</h2><button class="admin-secondary" data-admin-tab="orders">Ver todos</button></div>
      ${orders.length ? orders.slice(0, 5).map(orderMini).join("") : "<p>Aún no hay pedidos registrados.</p>"}</section>`;
  }

  function orderMini(order) {
    return `<div class="municipality-row"><b>${order.id}</b><span>${order.customer.name}</span><span class="status-pill ${order.status.toLowerCase()}">${order.status}</span><b>${Store.money(order.total)}</b></div>`;
  }

  function renderProducts(main) {
    const all = Store.getProducts();
    const categories = [...new Set(all.map(productCategoryLabel))].sort((left, right) => left.localeCompare(right, "es"));
    main.innerHTML = `${top("Productos", `${all.length} productos importados y editables.`, '<button data-product-new>＋ Nuevo producto</button>')}
      <section class="admin-panel"><div class="admin-panel-head"><h2>Catálogo</h2><div class="product-filter-controls">
        <input id="adminProductSearch" type="search" value="${adminState.query}" placeholder="Buscar…" />
        <select id="adminProductCategory"><option value="">Todas las categorías</option>${categories.map((category) =>
          `<option value="${category.replaceAll('"', "&quot;")}" ${adminState.productCategory === category ? "selected" : ""}>${category}</option>`
        ).join("")}</select>
        <button class="admin-secondary" data-catalog-reset>Restaurar importación</button>
      </div></div>
      <div class="product-bulk-toolbar">
        <b id="productSelectedCount">0 seleccionados</b>
        <button class="admin-secondary" data-product-bulk-edit disabled>Cambiar foto, descripción o categoría</button>
        <button class="admin-secondary danger" data-product-bulk-delete disabled>Eliminar seleccionados</button>
      </div>
      <div id="adminProductResults"></div></section>`;
    renderProductResults();
  }

  function productCategoryLabel(product) {
    return [familyLabel(product.family || product.category || "Sin categoría"), subcategoryLabel(product.family, product.subcategory || "General")].join(" · ");
  }

  function categoryLabel(key, fallback) {
    return Store.getSettings().categoryLabels?.[key] || fallback;
  }

  function familyLabel(family) {
    return categoryLabel(`family::${family}`, family);
  }

  function subcategoryLabel(family, subcategory) {
    return categoryLabel(`subcategory::${family}::${subcategory}`, subcategory);
  }

  function compareProducts(left, right) {
    return productCategoryLabel(left).localeCompare(productCategoryLabel(right), "es")
      || left.name.localeCompare(right.name, "es");
  }

  function renderProductResults() {
    const results = document.getElementById("adminProductResults");
    if (!results) return;
    const all = Store.getProducts();
    const query = adminState.query.toLocaleLowerCase("es");
    const products = all.filter((product) =>
      (!adminState.productCategory || productCategoryLabel(product) === adminState.productCategory)
      && (!query || `${product.name} ${product.category} ${product.family || ""} ${product.subcategory || ""} ${productCategoryLabel(product)}`.toLocaleLowerCase("es").includes(query))
    ).sort(compareProducts);
    const pageSize = 80;
    const pageCount = Math.max(1, Math.ceil(products.length / pageSize));
    adminState.productPage = Math.min(Math.max(1, adminState.productPage), pageCount);
    const start = (adminState.productPage - 1) * pageSize;
    const pageProducts = products.slice(start, start + pageSize);
    const allPageSelected = pageProducts.length > 0 && pageProducts.every((product) => adminState.selectedProducts.has(product.id));
    let previousCategory = "";
    results.innerHTML = `
      <div class="product-results-summary"><span>Mostrando ${products.length ? start + 1 : 0}–${Math.min(start + pageSize, products.length)} de ${products.length}</span><span>Página ${adminState.productPage} de ${pageCount}</span></div>
      <table class="admin-table"><thead><tr><th><input id="selectAllProducts" type="checkbox" ${allPageSelected ? "checked" : ""} aria-label="Seleccionar productos de esta página" /></th><th>Producto</th><th>Categoría</th><th>Presentaciones</th><th>Precio público</th><th>Estado</th><th></th></tr></thead>
      <tbody>${pageProducts.map((product) => {
        const prices = product.variants.map((variant) => Store.price(variant));
        const category = productCategoryLabel(product);
        const categoryHeader = category !== previousCategory ? `<tr class="product-category-row"><td colspan="7">${category}</td></tr>` : "";
        previousCategory = category;
        return `${categoryHeader}<tr><td><input class="product-check" data-product-select="${product.id}" type="checkbox" ${adminState.selectedProducts.has(product.id) ? "checked" : ""} aria-label="Seleccionar ${product.name}" /></td>
          <td><div class="table-product"><img src="${product.image}" onerror="this.src='assets/lumea-logo-square.png'" alt="" /><b>${product.name}</b></div></td>
          <td>${familyLabel(product.family || product.category)}<br /><small>${subcategoryLabel(product.family, product.subcategory || "")}</small></td><td>${product.variants.length}</td><td>Desde ${Store.money(Math.min(...prices))}</td>
          <td><span class="status-pill">${product.active ? "Visible" : "Oculto"}</span></td>
          <td><div class="row-actions"><button data-product-edit="${product.id}">Editar</button><button data-product-toggle="${product.id}">${product.active ? "Ocultar" : "Mostrar"}</button><button data-product-delete="${product.id}">Eliminar</button></div></td></tr>`;
      }).join("")}</tbody></table>
      ${products.length ? `<div class="product-pagination"><button class="admin-secondary" data-product-page="${adminState.productPage - 1}" ${adminState.productPage === 1 ? "disabled" : ""}>← Anterior</button><button class="admin-secondary" data-product-page="${adminState.productPage + 1}" ${adminState.productPage === pageCount ? "disabled" : ""}>Siguiente →</button></div>` : '<p class="empty-orders">No hay productos en esta categoría.</p>'}`;
    updateProductBulkState();
  }

  function updateProductBulkState() {
    const count = adminState.selectedProducts.size;
    const label = document.getElementById("productSelectedCount");
    if (label) label.textContent = `${count} seleccionado${count === 1 ? "" : "s"}`;
    document.querySelectorAll("[data-product-bulk-edit], [data-product-bulk-delete]").forEach((button) => {
      button.disabled = count === 0;
    });
    const pageCheckboxes = [...document.querySelectorAll(".product-check")];
    const selectAll = document.getElementById("selectAllProducts");
    if (selectAll) selectAll.checked = pageCheckboxes.length > 0 && pageCheckboxes.every((checkbox) => checkbox.checked);
  }

  function renderCategories(main) {
    const settings = Store.getSettings();
    const visibility = settings.categoryVisibility || {};
    const labels = settings.categoryLabels || {};
    const taxonomy = window.LUMEA_TAXONOMY || {};
    main.innerHTML = `${top("Categorías", "Cambia los nombres directamente y elige qué categorías aparecen en la Tienda.")}
      <form class="admin-panel" id="categoryVisibilityForm">
        <div class="category-admin-grid">${Object.entries(taxonomy).map(([family, subcategories]) => {
          const familyKey = `family::${family}`;
          return `<article class="category-admin-card">
            <div class="category-admin-family"><input type="checkbox" data-category-visibility="${familyKey}" ${visibility[familyKey] !== false ? "checked" : ""} aria-label="Mostrar ${attribute(family)}" />
              <input class="category-name-input" data-category-label="${familyKey}" data-default-label="${attribute(family)}" value="${attribute(labels[familyKey] || family)}" required aria-label="Nombre de ${attribute(family)}" />
            </div>
            <div>${subcategories.map((subcategory) => {
              const key = `subcategory::${family}::${subcategory}`;
              return `<div class="category-admin-item"><input type="checkbox" data-category-visibility="${key}" ${visibility[key] !== false ? "checked" : ""} aria-label="Mostrar ${attribute(subcategory)}" />
                <input class="category-name-input" data-category-label="${key}" data-default-label="${attribute(subcategory)}" value="${attribute(labels[key] || subcategory)}" required aria-label="Nombre de ${attribute(subcategory)}" />
              </div>`;
            }).join("")}</div>
          </article>`;
        }).join("")}</div>
        <button class="admin-primary">Guardar nombres y visibilidad</button>
      </form>`;
  }

  function productEditor(product) {
    const isNew = !product;
    const value = product || {
      id: "", name: "", category: "Insumos", family: "Insumos para Jabón", subcategory: "Bases de Jabón de Glicerina", description: "", image: "assets/lumea-logo-square.png",
      active: true, variants: [{ label: "1 unidad", shippingWeightGrams: 15, mxn: 0, bioaleiPriceMxn: 0, publicPriceCup: 0, stock: null }]
    };
    const families = Object.keys(window.LUMEA_TAXONOMY || {});
    const familyOptions = families.map((family) => `<option value="${family}" ${value.family === family ? "selected" : ""}>${familyLabel(family)}</option>`).join("");
    const subcategoryOptions = (window.LUMEA_TAXONOMY?.[value.family] || []).map((subcategory) => `<option value="${subcategory}" ${value.subcategory === subcategory ? "selected" : ""}>${subcategoryLabel(value.family, subcategory)}</option>`).join("");
    adminState.productImage = value.image;
    document.getElementById("adminProductEditor").innerHTML = `<p class="eyebrow">${isNew ? "NUEVO PRODUCTO" : "EDITAR PRODUCTO"}</p><h2>${isNew ? "Agregar al catálogo" : value.name}</h2>
      <form id="productForm" data-product-id="${value.id}">
        <div class="product-editor">${field("Nombre", "productName", value.name, "text", "required")}
          <label class="field">Familia<select id="productFamily">${familyOptions}</select></label>
          <label class="field">Subcategoría<select id="productSubcategory">${subcategoryOptions}</select></label>
          <label class="field wide">Descripción<textarea id="productDescription" rows="3">${value.description || ""}</textarea></label>
          <label class="field">URL de la foto<input id="productImageUrl" value="${String(value.image).replaceAll('"', "&quot;")}" /></label>
          <label class="field">O subir nueva foto<input id="productImageFile" type="file" accept="image/*" /></label>
          <img class="image-preview wide" id="productImagePreview" src="${value.image}" alt="Vista previa" />
          <label class="field wide"><input id="productActive" type="checkbox" ${value.active ? "checked" : ""} /> Visible en la tienda</label>
        </div>
        <h3>Presentaciones, precios y cantidades</h3><p>El precio se calcula automáticamente. Deja el precio manual vacío para usar la fórmula; escribe uno solo si deseas sustituir el resultado. Las existencias vacías significan disponibilidad ilimitada.</p>
        <div class="variant-legend"><span>Presentación</span><span>Gramos / ml</span><span>BioAlei MXN</span><span>Precio manual CUP</span><span>Existencias</span><span></span></div>
        <div id="variantRows">${value.variants.map(variantRow).join("")}</div>
        <button type="button" class="admin-secondary" data-variant-add>＋ Agregar presentación</button>
        <div class="checkout-nav"><button type="button" class="secondary-btn" data-admin-close>Cancelar</button><button class="admin-primary">Guardar producto</button></div>
      </form>`;
    document.getElementById("adminProductDialog").showModal();
  }

  function bulkProductEditor() {
    const products = Store.getProducts().filter((product) => adminState.selectedProducts.has(product.id)).sort(compareProducts);
    if (!products.length) return savedToast("Selecciona al menos un producto");
    const taxonomy = window.LUMEA_TAXONOMY || {};
    const families = Object.keys(taxonomy);
    const sharedFamily = products.every((product) => product.family === products[0].family) ? products[0].family : "";
    const selectedFamily = sharedFamily && taxonomy[sharedFamily] ? sharedFamily : families[0] || "";
    const subcategories = taxonomy[selectedFamily] || [];
    const sharedSubcategory = products.every((product) => product.subcategory === products[0].subcategory) ? products[0].subcategory : "";
    const selectedSubcategory = subcategories.includes(sharedSubcategory) ? sharedSubcategory : subcategories[0] || "";
    document.getElementById("adminBulkProductEditor").innerHTML = `
      <p class="eyebrow">EDICIÓN MÚLTIPLE</p>
      <h2>${products.length} producto${products.length === 1 ? "" : "s"} seleccionado${products.length === 1 ? "" : "s"}</h2>
      <p>Una sola foto se aplicará a todos. Si eliges ${products.length} fotos, se asignarán en el mismo orden en que aparecen los productos.</p>
      <form id="bulkProductForm">
        <label class="field">Subir foto o varias fotos
          <input id="bulkProductImages" type="file" accept="image/*" multiple />
        </label>
        <label class="field">O usar la misma URL de foto
          <input id="bulkProductImageUrl" type="url" placeholder="https://…" />
        </label>
        <label class="field bulk-description-toggle">
          <input id="bulkApplyDescription" type="checkbox" /> Cambiar también la descripción
        </label>
        <label class="field">Nueva descripción
          <textarea id="bulkProductDescription" rows="5" disabled></textarea>
        </label>
        <label class="field bulk-description-toggle">
          <input id="bulkApplyCategory" type="checkbox" /> Cambiar también la categoría y subcategoría
        </label>
        <div class="bulk-category-fields">
          <label class="field">Categoría
            <select id="bulkProductFamily" disabled>${families.map((family) => `<option value="${family}" ${family === selectedFamily ? "selected" : ""}>${familyLabel(family)}</option>`).join("")}</select>
          </label>
          <label class="field">Subcategoría
            <select id="bulkProductSubcategory" disabled>${subcategories.map((subcategory) => `<option value="${subcategory}" ${subcategory === selectedSubcategory ? "selected" : ""}>${subcategoryLabel(selectedFamily, subcategory)}</option>`).join("")}</select>
          </label>
        </div>
        <div class="checkout-nav">
          <button type="button" class="secondary-btn" data-admin-bulk-close>Cancelar</button>
          <button class="admin-primary">Guardar cambios</button>
        </div>
      </form>`;
    document.getElementById("adminBulkProductDialog").showModal();
  }

  function variantRow(variant = { label: "1 unidad", shippingWeightGrams: 15, mxn: 0, publicPriceCup: 0, stock: null }) {
    const shippingWeight = variant.shippingWeightGrams ?? Store.shippingGrams(variant);
    const supplierPrice = variant.bioaleiPriceMxn ?? variant.mxn ?? 0;
    const publicPrice = Number(variant.publicPriceCup) > 0 ? Number(variant.publicPriceCup) : "";
    const calculatedPrice = Store.price({ ...variant, publicPriceCup: 0 });
    const stock = variant.stock == null ? "" : Number(variant.stock);
    return `<div class="variant-editor"><input class="variant-label" value="${variant.label}" placeholder="Nombre/peso" required />
      <input class="variant-weight" type="number" min="1" step="1" value="${shippingWeight}" title="Gramos o ml para calcular el envío" required />
      <input class="variant-mxn" type="number" min="0" step=".01" value="${supplierPrice}" title="Precio BioAlei en MXN" required />
      <input class="variant-public-price" type="number" min="1" step="1" value="${publicPrice}" placeholder="${calculatedPrice}" title="Precio público manual en CUP; vacío usa el cálculo automático" />
      <input class="variant-stock" type="number" min="0" step="1" value="${stock}" placeholder="∞" title="Existencias disponibles; vacío significa ilimitado" />
      <button type="button" data-variant-remove>×</button></div>`;
  }

  function renderOrders(main) {
    const orders = Store.getOrders();
    const archived = orders.filter((order) => order.archived);
    const active = orders.filter((order) => !order.archived);
    const visibleOrders = adminState.orderView === "archived" ? archived : active;
    const templateOptions = Store.getEmailTemplates().map((template) => `<option value="${template.id}">${template.name}</option>`).join("");
    const statusOptions = statuses.map((status) => `<option>${status}</option>`).join("");
    main.innerHTML = `${top("Pedidos", `${active.length} activos · ${archived.length} archivados.`)}
      <section class="admin-panel orders-panel">
        <div class="orders-view-tabs">
          <button class="${adminState.orderView === "active" ? "active" : ""}" data-order-view="active">Pedidos activos (${active.length})</button>
          <button class="${adminState.orderView === "archived" ? "active" : ""}" data-order-view="archived">Archivo (${archived.length})</button>
        </div>
        ${visibleOrders.length ? `<div class="bulk-orders">
          <label><input id="selectAllOrders" type="checkbox" /> Seleccionar todos</label>
          <select id="bulkOrderStatus" aria-label="Estado para pedidos seleccionados">${statusOptions}</select>
          <button class="admin-secondary" data-bulk-order-status>Aplicar estado</button>
          <button class="admin-secondary" data-bulk-order-archive>${adminState.orderView === "archived" ? "Restaurar seleccionados" : "Archivar seleccionados"}</button>
          <button class="admin-secondary danger" data-bulk-order-delete>Eliminar seleccionados</button>
          <select id="bulkOrderTemplate" aria-label="Formato para pedidos seleccionados">${templateOptions}</select>
          <button class="admin-primary" data-bulk-order-email>Abrir correo en Gmail</button>
          <small id="bulkOrderError"></small>
          <small>Gmail enviará desde la cuenta activa. Si no aparece LUMEA, cambia de cuenta o selecciona el remitente dentro de Gmail.</small>
        </div>
        <div class="order-list-head"><span>Pedido</span><span>Pago</span><span>Entrega o recogida</span><span>Comprobante</span></div>
        <div class="compact-order-list">${visibleOrders.map(orderCard).join("")}</div>` : `<div class="empty-orders">No hay pedidos ${adminState.orderView === "archived" ? "archivados" : "activos"}.</div>`}
      </section>`;
  }

  function whatsappNumber(value) {
    let number = String(value || "").replace(/\D/g, "");
    if (number.length === 8) number = `53${number}`;
    return number;
  }

  function gmailComposeUrl({ to = "", bcc = "", subject = "", body = "" }) {
    const params = new URLSearchParams({ view: "cm", fs: "1", tf: "1", su: subject, body });
    const sender = Store.getSettings().ordersEmail || "";
    if (sender) params.set("authuser", sender);
    if (to) params.set("to", to);
    if (bcc) params.set("bcc", bcc);
    return `https://mail.google.com/mail/?${params}`;
  }

  function selectedOrders() {
    const selected = new Set([...document.querySelectorAll(".order-check:checked")].map((checkbox) => checkbox.value));
    return Store.getOrders().filter((order) => selected.has(order.id));
  }

  function applyBulkOrderTemplate(template, orders) {
    const commonStatus = orders.every((order) => order.status === orders[0]?.status) ? orders[0]?.status : "actualizado";
    const replacements = {
      "{{nombre}}": "cliente",
      "{{pedido}}": "LUMEA",
      "{{productos}}": "los productos de tu pedido",
      "{{total}}": "el total confirmado de tu pedido",
      "{{estado}}": commonStatus || "actualizado"
    };
    const replace = (value) => Object.entries(replacements).reduce((text, [key, replacement]) => text.replaceAll(key, replacement), value || "");
    return { subject: replace(template.subject), body: replace(template.body) };
  }

  function orderCard(order) {
    const message = encodeURIComponent(`Hola ${order.customer.name}, tu pedido ${order.id} en LUMEA está: ${order.status}.`);
    const statusOptions = statuses.map((status) => `<option ${status === order.status ? "selected" : ""}>${status}</option>`).join("");
    const templateOptions = Store.getEmailTemplates().map((template) => `<option value="${template.id}">${template.name}</option>`).join("");
    const hasPaymentAmounts = Number.isFinite(Number(order.paymentAmount));
    const paymentName = order.payment === "card"
      ? (order.paymentPortion === "full" ? "Tarjeta · pago total" : "Tarjeta · anticipo del 20%")
      : order.payment === "transfer" ? "Transferencia" : hasPaymentAmounts ? "Efectivo · anticipo del 20% por tarjeta" : "Efectivo";
    const paymentAmounts = hasPaymentAmounts
      ? `<span>Pago enviado: ${Store.money(order.paymentAmount)}</span><span>Saldo pendiente: ${Store.money(order.balanceDue || 0)}</span>${order.status === "Cancelado" ? `<span>${order.cancellationRefund ? "Anticipo por devolver" : "Anticipo no reembolsable"}</span>` : ""}`
      : "";
    const canArchive = order.archived || ["Entregado", "Recogido"].includes(order.status);
    return `<article class="compact-order">
      <div class="order-column order-column-main">
        <label class="order-select"><input class="order-check" type="checkbox" value="${order.id}" /><span>${order.id}</span></label>
        <b>${order.customer.name}</b><small>${new Date(order.createdAt).toLocaleString("es-CU")} · ${order.customer.phone}</small>
        ${order.customer.email ? `<small>${order.customer.email}</small>` : ""}
        <select data-order-status="${order.id}" aria-label="Estado de ${order.id}">${statusOptions}</select>
        <details><summary>${order.lines.length} producto${order.lines.length === 1 ? "" : "s"} · ${Store.money(order.total)}</summary><small>${order.lines.map((line) => `${line.qty} × ${line.name} (${line.variant})`).join("<br />")}</small></details>
        <div class="compact-order-actions">
          <a class="whatsapp" href="https://wa.me/${whatsappNumber(order.customer.phone)}?text=${message}" target="_blank">WhatsApp</a>
          <button data-order-edit="${order.id}">Editar</button>
          <select data-order-template="${order.id}" aria-label="Formato de correo">${templateOptions}</select>
          <button data-order-email="${order.id}" ${order.customer.email ? "" : "disabled title='Este pedido no tiene correo'"}>Gmail</button>
          ${canArchive ? `<button data-order-archive="${order.id}">${order.archived ? "Restaurar" : "Archivar"}</button>` : ""}
          ${order.status !== "Cancelado" && !order.archived ? `<button data-order-cancel="${order.id}">Cancelar</button>` : ""}
          <button class="danger" data-order-delete="${order.id}">Eliminar</button>
        </div>
      </div>
      <div class="order-column"><b>${paymentName}</b>${paymentAmounts || `<span>Total: ${Store.money(order.total)}</span>`}</div>
      <div class="order-column"><b>${order.fulfillment === "delivery" ? `Entrega · ${order.municipality}` : "Recogida"}</b><span>${order.fulfillment === "delivery" ? order.customer.address : Store.getSettings().pickupAddress}</span>${order.fulfillment === "delivery" ? `<span>Tarifa: ${Store.money(order.deliveryFee)}</span>` : ""}</div>
      <div class="order-column order-proof">${order.proof ? `<button data-order-proof="${order.id}"><img src="${order.proof}" alt="Comprobante de ${order.id}" /><span>Ver comprobante</span></button>` : "<span>Sin comprobante</span>"}</div>
    </article>`;
  }

  function productOptions(selectedId = "") {
    const products = Store.getProducts().slice().sort(compareProducts);
    return products.map((product) =>
      `<option value="${attribute(product.id)}" ${product.id === selectedId ? "selected" : ""}>${attribute(product.name)} · ${attribute(productCategoryLabel(product))}</option>`
    ).join("");
  }

  function productVariant(productId, variantLabel = "") {
    const product = Store.getProducts().find((item) => item.id === productId);
    if (!product) return null;
    return (product.variants || []).find((variant) => variant.label === variantLabel) || product.variants?.[0] || null;
  }

  function variantOptions(productId, selectedLabel = "") {
    const product = Store.getProducts().find((item) => item.id === productId);
    return (product?.variants || []).map((variant) =>
      `<option value="${attribute(variant.label)}" ${variant.label === selectedLabel ? "selected" : ""}>${attribute(variant.label)} · ${Store.money(Store.price(variant))}</option>`
    ).join("");
  }

  function orderLineRow(line = {}, fallbackProduct = null) {
    const products = Store.getProducts();
    const selectedProduct = products.find((product) => product.id === line.productId) || fallbackProduct || products[0];
    const productId = selectedProduct?.id || "";
    const selectedVariant = productVariant(productId, line.variant) || selectedProduct?.variants?.[0] || null;
    const variantLabel = selectedVariant?.label || line.variant || "";
    const unitPrice = Number(line.unitPrice) > 0 ? Number(line.unitPrice) : selectedVariant ? Store.price(selectedVariant) : 0;
    return `<div class="order-line-editor">
      <select class="order-line-product" aria-label="Producto">${productOptions(productId)}</select>
      <select class="order-line-variant" aria-label="Presentación">${variantOptions(productId, variantLabel)}</select>
      <input class="order-line-qty" type="number" min="1" step="1" value="${Number(line.qty) || 1}" aria-label="Cantidad" />
      <input class="order-line-price" type="number" min="0" step="1" value="${Math.round(unitPrice)}" aria-label="Precio unitario CUP" />
      <button type="button" data-order-line-remove>×</button>
    </div>`;
  }

  function recalcOrderEditor() {
    const fulfillment = document.getElementById("orderFulfillment")?.value;
    const deliveryFeeInput = document.getElementById("orderDeliveryFee");
    if (fulfillment === "pickup" && deliveryFeeInput) deliveryFeeInput.value = "0";
    const subtotal = [...document.querySelectorAll(".order-line-editor")].reduce((sum, row) => {
      const qty = Number(row.querySelector(".order-line-qty").value) || 0;
      const price = Number(row.querySelector(".order-line-price").value) || 0;
      return sum + qty * price;
    }, 0);
    const deliveryFee = Number(deliveryFeeInput?.value) || 0;
    const total = subtotal + deliveryFee;
    const paymentAmount = Number(document.getElementById("orderPaymentAmount")?.value) || 0;
    const balanceDue = Math.max(0, total - paymentAmount);
    const subtotalBox = document.getElementById("orderSubtotalPreview");
    const totalBox = document.getElementById("orderTotalPreview");
    const balanceInput = document.getElementById("orderBalanceDue");
    if (subtotalBox) subtotalBox.textContent = Store.money(subtotal);
    if (totalBox) totalBox.textContent = Store.money(total);
    if (balanceInput) balanceInput.value = Math.round(balanceDue);
    return { subtotal, total, balanceDue, deliveryFee };
  }

  function orderEditor(order) {
    if (!order) return savedToast("No encontramos ese pedido");
    const settings = Store.getSettings();
    const municipalityOptions = settings.municipalities.map((item) =>
      `<option value="${attribute(item.name)}" ${item.name === order.municipality ? "selected" : ""}>${attribute(item.name)}</option>`
    ).join("");
    const statusOptions = statuses.map((status) => `<option ${status === order.status ? "selected" : ""}>${status}</option>`).join("");
    document.getElementById("adminOrderEditor").innerHTML = `<p class="eyebrow">EDITAR PEDIDO</p><h2>${order.id}</h2>
      <form id="orderForm" data-order-id="${attribute(order.id)}">
        <div class="order-editor-grid">
          ${field("Cliente", "orderCustomerName", order.customer?.name || "", "text", "required")}
          ${field("Teléfono / WhatsApp", "orderCustomerPhone", order.customer?.phone || "", "text", "required")}
          ${field("Correo", "orderCustomerEmail", order.customer?.email || "", "email")}
          <label class="field">Estado<select id="orderStatus">${statusOptions}</select></label>
          <label class="field">Entrega<select id="orderFulfillment"><option value="pickup" ${order.fulfillment !== "delivery" ? "selected" : ""}>Recogida</option><option value="delivery" ${order.fulfillment === "delivery" ? "selected" : ""}>Entrega a domicilio</option></select></label>
          <label class="field">Municipio<select id="orderMunicipality"><option value="">Sin municipio</option>${municipalityOptions}</select></label>
          <label class="field wide">Dirección<textarea id="orderAddress" rows="2">${attribute(order.customer?.address || "")}</textarea></label>
          <label class="field">Tarifa entrega CUP<input id="orderDeliveryFee" type="number" min="0" step="1" value="${Math.round(Number(order.deliveryFee) || 0)}" /></label>
          <label class="field">Forma de pago<select id="orderPayment"><option value="card" ${order.payment === "card" ? "selected" : ""}>Tarjeta</option><option value="cash" ${order.payment === "cash" ? "selected" : ""}>Efectivo</option><option value="transfer" ${order.payment === "transfer" ? "selected" : ""}>Transferencia</option></select></label>
          <label class="field">Tipo de pago<select id="orderPaymentPortion"><option value="deposit" ${order.paymentPortion !== "full" ? "selected" : ""}>Anticipo 20%</option><option value="full" ${order.paymentPortion === "full" ? "selected" : ""}>Pago total</option></select></label>
          <label class="field">Pago enviado CUP<input id="orderPaymentAmount" type="number" min="0" step="1" value="${Math.round(Number(order.paymentAmount) || 0)}" /></label>
          <label class="field">Saldo pendiente CUP<input id="orderBalanceDue" type="number" min="0" step="1" value="${Math.round(Number(order.balanceDue) || 0)}" readonly /></label>
        </div>
        <h3>Productos del pedido</h3>
        <div class="order-line-legend"><span>Producto</span><span>Presentación</span><span>Cant.</span><span>Precio CUP</span><span></span></div>
        <div id="orderLineRows">${(order.lines || []).map((line) => orderLineRow(line)).join("") || orderLineRow()}</div>
        <button type="button" class="admin-secondary" data-order-line-add>＋ Agregar producto</button>
        <div class="order-editor-summary"><span>Subtotal: <b id="orderSubtotalPreview">${Store.money(order.subtotal)}</b></span><span>Total: <b id="orderTotalPreview">${Store.money(order.total)}</b></span></div>
        <div class="checkout-nav"><button type="button" class="secondary-btn" data-admin-order-close>Cancelar</button><button class="admin-primary">Guardar pedido</button></div>
      </form>`;
    document.getElementById("adminOrderDialog").showModal();
    recalcOrderEditor();
  }

  async function saveOrderEdit(form) {
    const order = Store.getOrders().find((item) => item.id === form.dataset.orderId);
    if (!order) return savedToast("No encontramos ese pedido");
    const rows = [...document.querySelectorAll(".order-line-editor")];
    const lines = rows.map((row) => {
      const productId = row.querySelector(".order-line-product").value;
      const product = Store.getProducts().find((item) => item.id === productId);
      const variant = row.querySelector(".order-line-variant").value;
      const qty = Math.max(1, Number(row.querySelector(".order-line-qty").value) || 1);
      const unitPrice = Math.max(0, Number(row.querySelector(".order-line-price").value) || 0);
      return {
        productId,
        name: product?.name || "Producto",
        variant,
        qty,
        unitPrice
      };
    }).filter((line) => line.productId && line.variant && line.qty > 0);
    if (!lines.length) return savedToast("Agrega al menos un producto");
    const summary = recalcOrderEditor();
    const status = document.getElementById("orderStatus").value;
    const updated = {
      ...order,
      updatedAt: new Date().toISOString(),
      status,
      customer: {
        ...(order.customer || {}),
        name: document.getElementById("orderCustomerName").value.trim(),
        phone: document.getElementById("orderCustomerPhone").value.trim(),
        email: document.getElementById("orderCustomerEmail").value.trim(),
        address: document.getElementById("orderAddress").value.trim()
      },
      fulfillment: document.getElementById("orderFulfillment").value,
      municipality: document.getElementById("orderMunicipality").value,
      deliveryFee: summary.deliveryFee,
      payment: document.getElementById("orderPayment").value,
      paymentPortion: document.getElementById("orderPaymentPortion").value,
      paymentAmount: Number(document.getElementById("orderPaymentAmount").value) || 0,
      balanceDue: summary.balanceDue,
      lines,
      subtotal: summary.subtotal,
      total: summary.total
    };
    if (!updated.customer.name || !updated.customer.phone) return savedToast("Completa cliente y teléfono");
    if (status === "Cancelado" && !updated.cancelledAt) {
      updated.cancelledAt = updated.updatedAt;
      updated.cancellationRefund = Store.cancellationRefundable(updated);
    }
    if (["Entregado", "Recogido"].includes(status) && updated.archived) updated.archivedAt ||= updated.updatedAt;
    try {
      await Store.saveAdminOrder(updated);
      document.getElementById("adminOrderDialog")?.close();
      await Store.refreshAdminData();
      renderOrders(document.getElementById("adminMain"));
      savedToast("Pedido guardado");
    } catch (error) {
      savedToast(error.message || "No se pudo guardar el pedido");
    }
  }

  function renderDelivery(main) {
    const settings = Store.getSettings();
    main.innerHTML = `${top("Municipios y entregas", "Define el costo local que verá el cliente al finalizar.")}
      <section class="admin-panel"><div class="admin-panel-head"><h2>Tarifas en CUP</h2><button class="admin-primary" data-municipality-add>＋ Agregar municipio</button></div>
      <div id="municipalityRows">${settings.municipalities.map((item) => `<div class="municipality-row" data-municipality="${item.id}">
        <input class="municipality-name" value="${item.name}" /><input class="municipality-fee" type="number" min="0" value="${item.fee}" />
        <label class="switch"><input class="municipality-active" type="checkbox" ${item.active ? "checked" : ""} /> Activo</label><button class="admin-secondary" data-municipality-remove>Eliminar</button></div>`).join("")}</div>
      <button class="admin-primary" data-municipality-save>Guardar tarifas</button></section>`;
  }

  function renderBank(main) {
    const bank = Store.getSettings().bank;
    main.innerHTML = `${top("Cuenta bancaria", "Estos datos se muestran cuando el cliente elige transferencia.")}
      <section class="settings-grid"><form class="settings-card" id="bankForm"><h2>Datos para transferencias</h2>
        ${field("Beneficiario", "bankBeneficiary", bank.beneficiary)}
        ${field("Banco", "bankName", bank.bank)}
        ${field("Número de cuenta o tarjeta", "bankCard", bank.card)}
        ${field("Moneda", "bankCurrency", bank.currency)}
        <label class="field">Instrucciones<textarea id="bankInstructions" rows="4">${bank.instructions}</textarea></label>
        <button class="admin-primary">Guardar datos bancarios</button></form>
        <aside class="settings-card"><h2>Vista para el cliente</h2><div class="bank-box"><b>${bank.bank}</b><br />Beneficiario: ${bank.beneficiary}<br />Cuenta/tarjeta: ${bank.card}<br />Moneda: ${bank.currency}<br />${bank.instructions}</div></aside></section>`;
  }

  function renderCampaigns(main) {
    const subscribers = [...Store.getSubscribers()].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
    const templates = Store.getEmailTemplates();
    const creating = adminState.emailTemplateId === "__new__";
    const selected = creating ? { id: "", name: "", subject: "", body: "" } : templates.find((template) => template.id === adminState.emailTemplateId) || templates[0] || { id: "", name: "", subject: "", body: "" };
    if (!creating) adminState.emailTemplateId = selected.id;
    main.innerHTML = `${top("Correos masivos", `${subscribers.length} personas inscritas en El Círculo LUMEA.`)}
      <section class="campaign-grid"><div class="settings-card"><h2>Suscriptores</h2>
        <form id="subscriberForm">${field("Agregar correo", "subscriberEmail", "", "email", "required")}<button class="admin-primary">Agregar</button></form>
        ${subscribers.length ? '<label class="subscriber select-all"><input id="selectAllSubscribers" type="checkbox" /> <b>Seleccionar todos</b></label>' : ""}
        <div class="subscriber-list">${subscribers.map((email) => `<div class="subscriber"><label><input class="subscriber-check" type="checkbox" value="${email}" /> <span>${email}</span></label><button data-subscriber-remove="${email}">×</button></div>`).join("") || "<p>No hay suscriptores.</p>"}</div></div>
      <form class="settings-card campaign-form" id="campaignForm"><h2>Formatos de correo</h2>
        <label class="field">Formato guardado<select id="campaignTemplate"><option value="__new__" ${creating ? "selected" : ""}>Nuevo formato</option>${templates.map((template) => `<option value="${template.id}" ${template.id === selected.id ? "selected" : ""}>${template.name}</option>`).join("")}</select></label>
        ${field("Nombre del formato", "campaignTemplateName", selected.name, "text", "required")}
        ${field("Asunto", "campaignSubject", "", "text", "required")}
        <label class="field">Mensaje<textarea id="campaignBody" required placeholder="Escribe tu promoción o novedad…">${selected.body}</textarea></label>
        <p>Puedes usar: {{nombre}}, {{pedido}}, {{productos}}, {{total}} y {{estado}}.</p>
        <div class="template-actions"><button type="button" class="admin-secondary" data-template-new>Nuevo formato</button><button type="button" class="admin-secondary" data-template-save>Guardar formato</button><button type="button" class="admin-secondary" data-template-delete ${selected.id ? "" : "disabled"}>Eliminar</button></div>
        <p class="form-error" id="campaignSelectionError"></p>
        <button class="admin-primary" ${subscribers.length ? "" : "disabled"}>Enviar a correos seleccionados</button></form></section>`;
    document.getElementById("campaignSubject").value = selected.subject;
  }

  function applyOrderTemplate(template, order) {
    const replacements = {
      "{{nombre}}": order.customer.name || "",
      "{{pedido}}": order.id || "",
      "{{productos}}": order.lines.map((line) => `${line.qty} × ${line.name} (${line.variant})`).join("\n"),
      "{{total}}": Store.money(order.total),
      "{{estado}}": order.status || ""
    };
    const replace = (value) => Object.entries(replacements).reduce((text, [key, replacement]) => text.replaceAll(key, replacement), value || "");
    return { subject: replace(template.subject), body: replace(template.body) };
  }

  function renderSettings(main) {
    const settings = Store.getSettings();
    main.innerHTML = `${top("Configuración", "Controla la fórmula de precios y la operación de LUMEA.")}
      <section class="settings-grid"><form class="settings-card" id="pricingForm"><h2>Precio y conversión</h2>
        <div class="formula">[Precio BioAlei + ((gramos o ml ÷ 1000) × ${settings.shippingMxnPerKg})] ÷ (1 − ${settings.margin}) × tasa del día</div>
        ${field("Cambio del día · 1 MXN equivale a CUP", "settingRate", settings.rate, "number", "min='1' step='.01'")}
        ${field("Costo México → Cuba por kg · MXN", "settingKg", settings.shippingMxnPerKg, "number", "min='0' step='.01'")}
        ${field("Peso mínimo para artículos por unidad · gramos", "settingMinimumGrams", settings.minimumShippingGrams, "number", "min='1' step='1'")}
        ${field("Ganancia · porcentaje", "settingMargin", settings.margin * 100, "number", "min='0' max='90' step='.1'")}
        <button class="admin-primary">Aplicar fórmula</button></form>
      <form class="settings-card" id="operationForm"><h2>Pedidos y recogida</h2>
        ${field("Horas permitidas para cancelar", "settingCancelHours", settings.cancelHours, "number", "min='1'")}
        ${field("WhatsApp de contacto", "settingWhatsapp", settings.whatsapp)}
        ${field("Correo que recibe nuevos pedidos", "settingOrderNotificationEmail", settings.orderNotificationEmail || settings.ordersEmail || "", "email")}
        ${field("Remitente del aviso automático", "settingOrderNotificationFrom", settings.orderNotificationFrom || "", "text", "placeholder='LUMEA <pedidos@vixo.com.mx>'")}
        ${field("Tiempo de preparación", "settingPreparationTime", settings.preparationTime)}
        ${field("Tiempo de entrega", "settingDeliveryTime", settings.deliveryTime)}
        <label class="field">Punto de recogida<textarea id="settingPickup" rows="4">${settings.pickupAddress}</textarea></label>
        <label class="field">Condiciones del anticipo<textarea id="settingDepositTerms" rows="4">${settings.depositTerms}</textarea></label>
        <label class="field">Política de cancelación<textarea id="settingCancellationPolicy" rows="4">${settings.cancellationPolicy}</textarea></label>
        <label class="field">Privacidad<textarea id="settingPrivacyPolicy" rows="4">${settings.privacyPolicy}</textarea></label>
        <button class="admin-primary">Guardar operación</button></form>
      <aside class="settings-card"><h2>Correo automático</h2><p>Cuando entre un pedido nuevo, el servidor intentará avisar a este correo. Para que salga de forma automática hay que guardar en Cloudflare el secreto RESEND_API_KEY y verificar el remitente en Resend.</p></aside>
      <aside class="settings-card"><h2>Acceso exclusivo</h2><p>La cuenta administradora está configurada y no existe registro público ni creación de otros administradores.</p></aside>
      </section>`;
  }

  function slug(value) {
    return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + `-${Date.now().toString(36)}`;
  }

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const scale = Math.min(1, 900 / image.width);
          const canvas = document.createElement("canvas");
          canvas.width = image.width * scale; canvas.height = image.height * scale;
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", .76));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  app.addEventListener("click", async (event) => {
    const tab = event.target.closest("[data-admin-tab]");
    if (tab) { adminState.tab = tab.dataset.adminTab; renderShell(); }
    const orderView = event.target.closest("[data-order-view]");
    if (orderView) {
      adminState.orderView = orderView.dataset.orderView;
      renderOrders(document.getElementById("adminMain"));
    }
    const productPage = event.target.closest("[data-product-page]");
    if (productPage && !productPage.disabled) {
      adminState.productPage = Number(productPage.dataset.productPage);
      renderProductResults();
    }
    if (event.target.closest("[data-product-bulk-edit]")) bulkProductEditor();
    if (event.target.closest("[data-product-bulk-delete]")) {
      const ids = [...adminState.selectedProducts];
      if (ids.length && confirm(`¿Eliminar ${ids.length} producto${ids.length === 1 ? "" : "s"} del catálogo?`)) {
        try {
          await Store.deleteProducts(ids);
          adminState.selectedProducts.clear();
          renderProducts(document.getElementById("adminMain"));
          savedToast(`${ids.length} producto${ids.length === 1 ? "" : "s"} eliminado${ids.length === 1 ? "" : "s"}`);
        } catch (error) {
          savedToast(error.message || "No se pudieron eliminar los productos");
        }
      }
    }
    if (event.target.closest("[data-admin-logout]")) { Store.logout(); renderLogin(); }
    if (event.target.closest("[data-product-new]")) productEditor(null);
    const edit = event.target.closest("[data-product-edit]");
    if (edit) productEditor(Store.getProducts().find((p) => p.id === edit.dataset.productEdit));
    const toggle = event.target.closest("[data-product-toggle]");
    if (toggle) {
      const products = Store.getProducts(); const product = products.find((p) => p.id === toggle.dataset.productToggle);
      try {
        product.active = !product.active;
        await Store.saveProduct(product);
        renderProducts(document.getElementById("adminMain"));
        savedToast();
      } catch (error) {
        savedToast(error.message || "No se pudo guardar el producto");
      }
    }
    const del = event.target.closest("[data-product-delete]");
    if (del && confirm("¿Eliminar este producto del catálogo?")) {
      try {
        await Store.deleteProduct(del.dataset.productDelete);
        adminState.selectedProducts.delete(del.dataset.productDelete);
        renderProducts(document.getElementById("adminMain"));
        savedToast("Producto eliminado");
      } catch (error) {
        savedToast(error.message || "No se pudo eliminar el producto");
      }
    }
    if (event.target.closest("[data-admin-close]")) document.getElementById("adminProductDialog")?.close();
    if (event.target.closest("[data-admin-bulk-close]")) document.getElementById("adminBulkProductDialog")?.close();
    if (event.target.closest("[data-admin-order-close]")) document.getElementById("adminOrderDialog")?.close();
    if (event.target.closest("[data-variant-add]")) document.getElementById("variantRows").insertAdjacentHTML("beforeend", variantRow());
    const removeVariant = event.target.closest("[data-variant-remove]");
    if (removeVariant && document.querySelectorAll(".variant-editor").length > 1) removeVariant.closest(".variant-editor").remove();
    if (event.target.closest("[data-order-line-add]")) {
      document.getElementById("orderLineRows").insertAdjacentHTML("beforeend", orderLineRow());
      recalcOrderEditor();
    }
    const removeOrderLine = event.target.closest("[data-order-line-remove]");
    if (removeOrderLine && document.querySelectorAll(".order-line-editor").length > 1) {
      removeOrderLine.closest(".order-line-editor").remove();
      recalcOrderEditor();
    }
    const orderEdit = event.target.closest("[data-order-edit]");
    if (orderEdit) orderEditor(Store.getOrders().find((item) => item.id === orderEdit.dataset.orderEdit));
    const orderDelete = event.target.closest("[data-order-delete]");
    if (orderDelete && confirm("¿Eliminar este pedido definitivamente? Esta acción quitará el pedido del panel.")) {
      try {
        await Store.deleteOrder(orderDelete.dataset.orderDelete);
        renderOrders(document.getElementById("adminMain"));
        savedToast("Pedido eliminado");
      } catch (error) {
        savedToast(error.message || "No se pudo eliminar el pedido");
      }
    }
    const cancel = event.target.closest("[data-order-cancel]");
    if (cancel && confirm("¿Cancelar este pedido?")) {
      const orders = Store.getOrders(); const order = orders.find((item) => item.id === cancel.dataset.orderCancel);
      order.status = "Cancelado";
      order.cancelledAt = new Date().toISOString();
      order.cancellationRefund = Store.cancellationRefundable(order);
      await Store.saveAdminOrder(order); renderOrders(document.getElementById("adminMain"));
      savedToast();
    }
    const archive = event.target.closest("[data-order-archive]");
    if (archive) {
      const orders = Store.getOrders();
      const order = orders.find((item) => item.id === archive.dataset.orderArchive);
      if (order && (order.archived || ["Entregado", "Recogido"].includes(order.status))) {
        order.archived = !order.archived;
        order.archivedAt = order.archived ? new Date().toISOString() : "";
        await Store.saveAdminOrder(order);
        renderOrders(document.getElementById("adminMain"));
        savedToast(order.archived ? "Pedido archivado" : "Pedido restaurado");
      }
    }
    const proof = event.target.closest("[data-order-proof]");
    if (proof) {
      const order = Store.getOrders().find((item) => item.id === proof.dataset.orderProof);
      if (order?.proof) {
        document.getElementById("adminProofContent").innerHTML = `<p class="eyebrow">${order.id}</p><h2>Comprobante de pago</h2><img src="${order.proof}" alt="Comprobante de ${order.id}" />`;
        document.getElementById("adminProofDialog").showModal();
      }
    }
    const orderEmail = event.target.closest("[data-order-email]");
    if (orderEmail) {
      const order = Store.getOrders().find((item) => item.id === orderEmail.dataset.orderEmail);
      const templateId = document.querySelector(`[data-order-template="${order.id}"]`).value;
      const template = Store.getEmailTemplates().find((item) => item.id === templateId);
      if (order?.customer.email && template) {
        const message = applyOrderTemplate(template, order);
        window.open(gmailComposeUrl({ to: order.customer.email, subject: message.subject, body: message.body }), "_blank", "noopener");
      }
    }
    if (event.target.closest("[data-bulk-order-status]")) {
      const selected = selectedOrders();
      const error = document.getElementById("bulkOrderError");
      if (!selected.length) {
        error.textContent = "Selecciona al menos un pedido.";
      } else {
        const status = document.getElementById("bulkOrderStatus").value;
        await Promise.all(selected.map((order) => {
          const updated = {
            ...order,
            status,
            updatedAt: new Date().toISOString()
          };
          if (status === "Cancelado") {
            updated.cancelledAt = updated.updatedAt;
            updated.cancellationRefund = Store.cancellationRefundable(order);
          }
          return Store.saveAdminOrder(updated);
        }));
        renderOrders(document.getElementById("adminMain"));
        savedToast(`Estado aplicado a ${selected.length} pedido${selected.length === 1 ? "" : "s"}`);
      }
    }
    if (event.target.closest("[data-bulk-order-archive]")) {
      const selected = selectedOrders();
      const error = document.getElementById("bulkOrderError");
      if (!selected.length) {
        error.textContent = "Selecciona al menos un pedido.";
      } else {
        const archive = adminState.orderView !== "archived";
        await Promise.all(selected.map((order) => Store.saveAdminOrder({
          ...order,
          archived: archive,
          updatedAt: new Date().toISOString()
        })));
        renderOrders(document.getElementById("adminMain"));
        savedToast(`${archive ? "Archivados" : "Restaurados"} ${selected.length} pedido${selected.length === 1 ? "" : "s"}`);
      }
    }
    if (event.target.closest("[data-bulk-order-delete]")) {
      const selected = selectedOrders();
      const error = document.getElementById("bulkOrderError");
      if (!selected.length) {
        error.textContent = "Selecciona al menos un pedido.";
      } else if (confirm(`¿Eliminar definitivamente ${selected.length} pedido${selected.length === 1 ? "" : "s"}? Esta acción no se puede deshacer.`)) {
        await Promise.all(selected.map((order) => Store.deleteOrder(order.id)));
        renderOrders(document.getElementById("adminMain"));
        savedToast(`Eliminados ${selected.length} pedido${selected.length === 1 ? "" : "s"}`);
      }
    }
    if (event.target.closest("[data-bulk-order-email]")) {
      const selected = selectedOrders();
      const error = document.getElementById("bulkOrderError");
      const recipients = [...new Set(selected.map((order) => order.customer.email).filter(Boolean))];
      const template = Store.getEmailTemplates().find((item) => item.id === document.getElementById("bulkOrderTemplate").value);
      if (!selected.length) {
        error.textContent = "Selecciona al menos un pedido.";
      } else if (!recipients.length) {
        error.textContent = "Los pedidos seleccionados no tienen correo.";
      } else if (template) {
        const message = applyBulkOrderTemplate(template, selected);
        window.open(gmailComposeUrl({ bcc: recipients.join(","), subject: message.subject, body: message.body }), "_blank", "noopener");
      }
    }
    if (event.target.closest("[data-municipality-add]")) {
      document.getElementById("municipalityRows").insertAdjacentHTML("beforeend", `<div class="municipality-row" data-municipality="new-${Date.now()}"><input class="municipality-name" placeholder="Municipio" /><input class="municipality-fee" type="number" min="0" value="0" /><label class="switch"><input class="municipality-active" type="checkbox" checked /> Activo</label><button class="admin-secondary" data-municipality-remove>Eliminar</button></div>`);
    }
    const removeMunicipality = event.target.closest("[data-municipality-remove]");
    if (removeMunicipality) removeMunicipality.closest(".municipality-row").remove();
    if (event.target.closest("[data-municipality-save]")) await saveMunicipalities();
    const removeSubscriber = event.target.closest("[data-subscriber-remove]");
    if (removeSubscriber) {
      await Store.setSubscribers(Store.getSubscribers().filter((email) => email !== removeSubscriber.dataset.subscriberRemove));
      renderCampaigns(document.getElementById("adminMain"));
      savedToast();
    }
    if (event.target.closest("[data-template-new]")) {
      adminState.emailTemplateId = "__new__";
      renderCampaigns(document.getElementById("adminMain"));
    }
    if (event.target.closest("[data-template-save]")) {
      const name = document.getElementById("campaignTemplateName").value.trim();
      const subject = document.getElementById("campaignSubject").value.trim();
      const body = document.getElementById("campaignBody").value.trim();
      if (!name || !subject || !body) return document.getElementById("campaignSelectionError").textContent = "Completa el nombre, asunto y mensaje.";
      const templates = Store.getEmailTemplates();
      const existingId = adminState.emailTemplateId !== "__new__" ? adminState.emailTemplateId : "";
      const template = { id: existingId || `formato-${Date.now()}`, name, subject, body };
      const index = templates.findIndex((item) => item.id === template.id);
      if (index >= 0) templates[index] = template; else templates.push(template);
      await Store.setEmailTemplates(templates);
      adminState.emailTemplateId = template.id;
      renderCampaigns(document.getElementById("adminMain"));
      savedToast();
    }
    if (event.target.closest("[data-template-delete]") && adminState.emailTemplateId && adminState.emailTemplateId !== "__new__" && confirm("¿Eliminar este formato de correo?")) {
      await Store.setEmailTemplates(Store.getEmailTemplates().filter((template) => template.id !== adminState.emailTemplateId));
      adminState.emailTemplateId = "";
      renderCampaigns(document.getElementById("adminMain"));
      savedToast("Formato eliminado");
    }
    if (event.target.closest("[data-catalog-reset]") && confirm("¿Restaurar el catálogo importado? Se perderán las ediciones de productos.")) {
      localStorage.removeItem(Store.KEYS.products);
      await Store.setProducts(Store.getProducts());
      renderProducts(document.getElementById("adminMain"));
      savedToast("Catálogo restaurado");
    }
  });

  app.addEventListener("input", (event) => {
    if (event.target.id === "adminProductSearch") {
      adminState.query = event.target.value;
      adminState.productPage = 1;
      clearTimeout(window.adminSearchTimer);
      window.adminSearchTimer = setTimeout(renderProductResults, 180);
    }
    if (event.target.id === "productImageUrl") {
      adminState.productImage = event.target.value;
      document.getElementById("productImagePreview").src = adminState.productImage;
    }
    if (event.target.matches(".order-line-qty,.order-line-price,#orderDeliveryFee,#orderPaymentAmount")) recalcOrderEditor();
  });

  app.addEventListener("change", async (event) => {
    if (event.target.id === "adminProductCategory") {
      adminState.productCategory = event.target.value;
      adminState.productPage = 1;
      renderProductResults();
    }
    if (event.target.id === "selectAllProducts") {
      document.querySelectorAll(".product-check").forEach((checkbox) => {
        checkbox.checked = event.target.checked;
        if (event.target.checked) adminState.selectedProducts.add(checkbox.dataset.productSelect);
        else adminState.selectedProducts.delete(checkbox.dataset.productSelect);
      });
      updateProductBulkState();
    }
    if (event.target.matches(".product-check")) {
      if (event.target.checked) adminState.selectedProducts.add(event.target.dataset.productSelect);
      else adminState.selectedProducts.delete(event.target.dataset.productSelect);
      updateProductBulkState();
    }
    if (event.target.id === "bulkApplyDescription") {
      document.getElementById("bulkProductDescription").disabled = !event.target.checked;
    }
    if (event.target.id === "bulkApplyCategory") {
      document.getElementById("bulkProductFamily").disabled = !event.target.checked;
      document.getElementById("bulkProductSubcategory").disabled = !event.target.checked;
    }
    if (event.target.id === "bulkProductFamily") {
      const options = window.LUMEA_TAXONOMY?.[event.target.value] || [];
      document.getElementById("bulkProductSubcategory").innerHTML = options.map((subcategory) => `<option value="${subcategory}">${subcategoryLabel(event.target.value, subcategory)}</option>`).join("");
    }
    if (event.target.matches(".order-line-product")) {
      const row = event.target.closest(".order-line-editor");
      const variantSelect = row.querySelector(".order-line-variant");
      variantSelect.innerHTML = variantOptions(event.target.value);
      const variant = productVariant(event.target.value, variantSelect.value);
      row.querySelector(".order-line-price").value = variant ? Store.price(variant) : 0;
      recalcOrderEditor();
    }
    if (event.target.matches(".order-line-variant")) {
      const row = event.target.closest(".order-line-editor");
      const variant = productVariant(row.querySelector(".order-line-product").value, event.target.value);
      row.querySelector(".order-line-price").value = variant ? Store.price(variant) : 0;
      recalcOrderEditor();
    }
    if (event.target.id === "orderFulfillment") recalcOrderEditor();
    if (event.target.matches("[data-order-status]")) {
      const orders = Store.getOrders(); const order = orders.find((item) => item.id === event.target.dataset.orderStatus);
      order.status = event.target.value; order.updatedAt = new Date().toISOString();
      if (order.status === "Cancelado") {
        order.cancelledAt = order.updatedAt;
        order.cancellationRefund = Store.cancellationRefundable(order);
      }
      await Store.saveAdminOrder(order);
      renderOrders(document.getElementById("adminMain"));
      savedToast();
    }
    if (event.target.id === "productImageFile" && event.target.files[0]) {
      adminState.productImage = await readImage(event.target.files[0]);
      document.getElementById("productImagePreview").src = adminState.productImage;
    }
    if (event.target.id === "productFamily") {
      const options = window.LUMEA_TAXONOMY?.[event.target.value] || [];
      document.getElementById("productSubcategory").innerHTML = options.map((subcategory) => `<option value="${subcategory}">${subcategoryLabel(event.target.value, subcategory)}</option>`).join("");
    }
    if (event.target.id === "campaignTemplate") {
      adminState.emailTemplateId = event.target.value;
      renderCampaigns(document.getElementById("adminMain"));
    }
    if (event.target.id === "selectAllSubscribers") {
      document.querySelectorAll(".subscriber-check").forEach((checkbox) => {
        checkbox.checked = event.target.checked;
      });
    }
    if (event.target.id === "selectAllOrders") {
      document.querySelectorAll(".order-check").forEach((checkbox) => {
        checkbox.checked = event.target.checked;
      });
    }
  });

  app.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (event.target.id === "loginForm") {
      const valid = await Store.login(document.getElementById("loginUser").value.trim(), document.getElementById("loginPassword").value);
      if (valid) renderShell(); else document.getElementById("loginError").textContent = "Usuario o contraseña incorrectos.";
    }
    if (event.target.id === "productForm") await saveProduct(event.target);
    if (event.target.id === "bulkProductForm") await saveBulkProducts(event.target);
    if (event.target.id === "orderForm") await saveOrderEdit(event.target);
    if (event.target.id === "categoryVisibilityForm") {
      const settings = Store.getSettings();
      settings.categoryVisibility = {};
      settings.categoryLabels = {};
      document.querySelectorAll("[data-category-visibility]").forEach((checkbox) => {
        settings.categoryVisibility[checkbox.dataset.categoryVisibility] = checkbox.checked;
      });
      document.querySelectorAll("[data-category-label]").forEach((input) => {
        const value = input.value.trim();
        if (value && value !== input.dataset.defaultLabel) settings.categoryLabels[input.dataset.categoryLabel] = value;
      });
      await Store.setSettings(settings);
      renderCategories(document.getElementById("adminMain"));
      savedToast("Categorías guardadas");
    }
    if (event.target.id === "bankForm") {
      const settings = Store.getSettings();
      settings.bank = {
        beneficiary: document.getElementById("bankBeneficiary").value.trim(),
        bank: document.getElementById("bankName").value.trim(),
        card: document.getElementById("bankCard").value.trim(),
        currency: document.getElementById("bankCurrency").value.trim(),
        instructions: document.getElementById("bankInstructions").value.trim()
      };
      await Store.setSettings(settings); renderBank(document.getElementById("adminMain"));
      savedToast();
    }
    if (event.target.id === "subscriberForm") {
      const email = document.getElementById("subscriberEmail").value.trim().toLowerCase(); const list = Store.getSubscribers();
      if (!list.includes(email)) list.push(email); await Store.setSubscribers(list); renderCampaigns(document.getElementById("adminMain"));
      savedToast();
    }
    if (event.target.id === "campaignForm") {
      const emails = [...document.querySelectorAll(".subscriber-check:checked")].map((checkbox) => checkbox.value);
      if (!emails.length) return document.getElementById("campaignSelectionError").textContent = "Selecciona al menos un correo.";
      window.open(gmailComposeUrl({
        bcc: emails.join(","),
        subject: document.getElementById("campaignSubject").value,
        body: document.getElementById("campaignBody").value
      }), "_blank", "noopener");
    }
    if (event.target.id === "pricingForm") {
      const settings = Store.getSettings();
      settings.rate = Number(document.getElementById("settingRate").value);
      settings.shippingMxnPerKg = Number(document.getElementById("settingKg").value);
      settings.minimumShippingGrams = Number(document.getElementById("settingMinimumGrams").value);
      settings.margin = Number(document.getElementById("settingMargin").value) / 100;
      await Store.setSettings(settings); renderSettings(document.getElementById("adminMain"));
      savedToast();
    }
    if (event.target.id === "operationForm") {
      const settings = Store.getSettings();
      settings.cancelHours = Number(document.getElementById("settingCancelHours").value);
      settings.whatsapp = document.getElementById("settingWhatsapp").value.trim();
      settings.orderNotificationEmail = document.getElementById("settingOrderNotificationEmail").value.trim();
      settings.orderNotificationFrom = document.getElementById("settingOrderNotificationFrom").value.trim();
      settings.preparationTime = document.getElementById("settingPreparationTime").value.trim();
      settings.deliveryTime = document.getElementById("settingDeliveryTime").value.trim();
      settings.pickupAddress = document.getElementById("settingPickup").value.trim();
      settings.depositTerms = document.getElementById("settingDepositTerms").value.trim();
      settings.cancellationPolicy = document.getElementById("settingCancellationPolicy").value.trim();
      settings.privacyPolicy = document.getElementById("settingPrivacyPolicy").value.trim();
      await Store.setSettings(settings); renderSettings(document.getElementById("adminMain"));
      savedToast();
    }
  });

  async function saveProduct(form) {
    const products = Store.getProducts();
    const existing = products.find((product) => product.id === form.dataset.productId);
    const variants = [...document.querySelectorAll(".variant-editor")].map((row, index) => ({
      ...(existing?.variants?.[index] || {}),
      label: row.querySelector(".variant-label").value.trim(),
      shippingWeightGrams: Number(row.querySelector(".variant-weight").value),
      mxn: Number(row.querySelector(".variant-mxn").value),
      bioaleiPriceMxn: Number(row.querySelector(".variant-mxn").value),
      publicPriceCup: Number(row.querySelector(".variant-public-price").value),
      stock: row.querySelector(".variant-stock").value === "" ? null : Number(row.querySelector(".variant-stock").value)
    }));
    const value = {
      ...(existing || {}),
      id: existing?.id || form.dataset.pendingProductId || slug(document.getElementById("productName").value),
      name: document.getElementById("productName").value.trim(),
      category: document.getElementById("productSubcategory").value === "Fragancias" ? "Fragancias" : "Insumos",
      family: document.getElementById("productFamily").value,
      subcategory: document.getElementById("productSubcategory").value,
      description: document.getElementById("productDescription").value.trim(),
      image: adminState.productImage || document.getElementById("productImageUrl").value.trim() || "assets/lumea-logo-square.png",
      active: document.getElementById("productActive").checked,
      variants
    };
    form.dataset.pendingProductId = value.id;
    const button = form.querySelector('button[type="submit"], button.admin-primary');
    if (button) {
      button.disabled = true;
      button.textContent = "Guardando…";
    }
    try {
      await Store.saveProduct(value);
      document.getElementById("adminProductDialog").close();
      renderProducts(document.getElementById("adminMain"));
      savedToast("Producto guardado");
    } catch (error) {
      if (button) {
        button.disabled = false;
        button.textContent = "Guardar producto";
      }
      savedToast(error.message || "No se pudo guardar el producto");
    }
  }

  async function saveBulkProducts(form) {
    const selected = Store.getProducts().filter((product) => adminState.selectedProducts.has(product.id)).sort(compareProducts);
    const files = [...document.getElementById("bulkProductImages").files];
    const imageUrl = document.getElementById("bulkProductImageUrl").value.trim();
    const applyDescription = document.getElementById("bulkApplyDescription").checked;
    const description = document.getElementById("bulkProductDescription").value.trim();
    const applyCategory = document.getElementById("bulkApplyCategory").checked;
    const family = document.getElementById("bulkProductFamily").value;
    const subcategory = document.getElementById("bulkProductSubcategory").value;
    if (!selected.length) return savedToast("Selecciona al menos un producto");
    if (files.length > 1 && files.length !== selected.length) {
      return savedToast(`Elige una foto o exactamente ${selected.length} fotos`);
    }
    if (!files.length && !imageUrl && !applyDescription && !applyCategory) {
      return savedToast("Elige una foto o activa el cambio de descripción o categoría");
    }
    const button = form.querySelector(".admin-primary");
    button.disabled = true;
    button.textContent = "Guardando…";
    try {
      const images = files.length ? await Promise.all(files.map(readImage)) : [];
      const changed = selected.map((product, index) => ({
        ...product,
        image: images.length === 1 ? images[0] : images.length ? images[index] : imageUrl || product.image,
        description: applyDescription ? description : product.description,
        category: applyCategory ? (subcategory === "Fragancias" ? "Fragancias" : "Insumos") : product.category,
        family: applyCategory ? family : product.family,
        subcategory: applyCategory ? subcategory : product.subcategory
      }));
      await Store.saveProducts(changed);
      adminState.selectedProducts.clear();
      document.getElementById("adminBulkProductDialog").close();
      renderProducts(document.getElementById("adminMain"));
      savedToast(`${changed.length} producto${changed.length === 1 ? "" : "s"} actualizado${changed.length === 1 ? "" : "s"}`);
    } catch (error) {
      button.disabled = false;
      button.textContent = "Guardar cambios";
      savedToast(error.message || "No se pudieron guardar los productos");
    }
  }

  async function saveMunicipalities() {
    const settings = Store.getSettings();
    settings.municipalities = [...document.querySelectorAll("[data-municipality]")].map((row) => ({
      id: row.dataset.municipality,
      name: row.querySelector(".municipality-name").value.trim(),
      fee: Number(row.querySelector(".municipality-fee").value),
      active: row.querySelector(".municipality-active").checked
    })).filter((item) => item.name);
    await Store.setSettings(settings);
    renderDelivery(document.getElementById("adminMain"));
    savedToast();
  }

  window.addEventListener("hashchange", route);
  route();
})();
