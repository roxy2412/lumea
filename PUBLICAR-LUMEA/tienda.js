(async function () {
  const Store = window.LumeaStore;
  const $ = (selector) => document.querySelector(selector);
  await Store.ready;
  const state = {
    products: Store.getProducts(),
    settings: Store.getSettings(),
    cart: Store.getCart(),
    family: "Todos",
    subcategory: "",
    categoryMenuFamily: "",
    query: "",
    visible: 24,
    selectedProduct: null,
    checkout: {
      step: 1,
      fulfillment: "",
      name: "",
      email: "",
      phone: "",
      address: "",
      municipality: "",
      payment: "",
      paymentPortion: "",
      proof: ""
    }
  };

  const activeProducts = () => state.products.filter((product) => product.active !== false);
  const productById = (id) => state.products.find((product) => product.id === id);
  const pricePending = (product) => product.quoteOnly && product.variants.every((variant) =>
    Number(variant.publicPriceCup) <= 0 && Number(variant.bioaleiPriceMxn ?? variant.mxn) <= 0
  );
  const stockLimit = (variant) => variant.stock === "" || variant.stock == null ? Infinity : Math.max(0, Number(variant.stock));
  const cartKey = (line) => `${line.productId}::${line.variantIndex}`;
  const lineTotal = (line) => {
    const product = productById(line.productId);
    return product ? Store.price(product.variants[line.variantIndex], state.settings) * line.qty : 0;
  };
  const cartSubtotal = () => state.cart.reduce((sum, line) => sum + lineTotal(line), 0);
  const selectedMunicipality = () => state.settings.municipalities.find((item) => item.id === state.checkout.municipality);
  const deliveryFee = () => state.checkout.fulfillment === "delivery" ? Number(selectedMunicipality()?.fee || 0) : 0;
  const checkoutTotal = () => cartSubtotal() + deliveryFee();
  const depositAmount = () => Math.round(checkoutTotal() * .2);
  const paymentAmount = () => state.checkout.payment === "card" && state.checkout.paymentPortion === "full" ? checkoutTotal() : depositAmount();
  const paymentLabel = () => {
    if (state.checkout.payment === "card") return state.checkout.paymentPortion === "full" ? "Tarjeta · pago total" : "Tarjeta · anticipo del 20%";
    if (state.checkout.payment === "cash") return "Efectivo · anticipo del 20% por tarjeta";
    return "";
  };

  function renderCommercialInfo() {
    const settings = state.settings;
    const whatsapp = String(settings.whatsapp || "+5353691859");
    const whatsappLink = $("#commerceWhatsapp");
    if (whatsappLink) {
      whatsappLink.href = `https://wa.me/${whatsapp.replace(/\D/g, "")}`;
      whatsappLink.textContent = whatsapp;
    }
    if ($("#commercePreparation")) $("#commercePreparation").textContent = settings.preparationTime;
    if ($("#commerceDelivery")) $("#commerceDelivery").textContent = settings.deliveryTime;
    if ($("#commerceDeposit")) $("#commerceDeposit").textContent = settings.depositTerms;
    if ($("#commerceCancellation")) $("#commerceCancellation").textContent = settings.cancellationPolicy;
    if ($("#commercePrivacy")) $("#commercePrivacy").textContent = settings.privacyPolicy;
  }

  function filteredProducts() {
    const query = state.query.toLocaleLowerCase("es");
    return activeProducts().filter((product) => {
      const category = state.family === "Todos" || product.family === state.family;
      const subcategory = !state.subcategory || product.subcategory === state.subcategory;
      const text = !query || `${product.name} ${product.category} ${product.family || ""} ${product.subcategory || ""} ${familyLabel(product)} ${subcategoryLabel(product)}`.toLocaleLowerCase("es").includes(query);
      return category && subcategory && text;
    });
  }

  function categoryLabel(key, fallback) {
    return state.settings.categoryLabels?.[key] || fallback;
  }

  function familyLabel(product) {
    const family = product.family || product.category || "";
    return categoryLabel(`family::${family}`, family);
  }

  function subcategoryLabel(product) {
    const subcategory = product.subcategory || product.category || "";
    return categoryLabel(`subcategory::${product.family}::${subcategory}`, subcategory);
  }

  function card(product) {
    const pending = pricePending(product);
    const prices = pending ? [] : product.variants.map((variant) => Store.price(variant, state.settings));
    const minimum = pending ? 0 : Math.min(...prices);
    return `<article class="product-card">
      <div class="product-photo">
        <img src="${product.image}" alt="${product.name}" loading="lazy" decoding="async" onerror="this.src='assets/lumea-logo-icono.webp'" />
        <span class="badge">${subcategoryLabel(product)}</span>
        <button data-view="${product.id}" aria-label="Ver ${product.name}"></button>
      </div>
      <div class="card-info"><span>${familyLabel(product)}</span><h3>${product.name}</h3>
        <div class="price">${pending ? "Precio por confirmar" : `Desde ${Store.money(minimum)}`} <span class="variant-note">${product.variants.length} ${product.variants.length === 1 ? "presentación" : "presentaciones"}</span></div>
      </div>
    </article>`;
  }

  function renderProducts() {
    state.products = Store.getProducts();
    state.settings = Store.getSettings();
    const filtered = filteredProducts();
    $("#productGrid").innerHTML = filtered.slice(0, state.visible).map(card).join("");
    $("#productCount").textContent = `${filtered.length} productos disponibles`;
    $("#emptyProducts").style.display = filtered.length ? "none" : "block";
    $("#loadMore").style.display = filtered.length > state.visible ? "block" : "none";
  }

  function renderTaxonomy() {
    const taxonomy = window.LUMEA_TAXONOMY || {};
    const visibility = state.settings.categoryVisibility || {};
    const families = Object.entries(taxonomy).filter(([family]) => visibility[`family::${family}`] !== false);
    if (state.family !== "Todos" && !families.some(([family]) => family === state.family)) {
      state.family = "Todos";
      state.subcategory = "";
    }
    if (state.subcategory && visibility[`subcategory::${state.family}::${state.subcategory}`] === false) state.subcategory = "";
    $("#categoryFilter").innerHTML = `<option value="Todos">Todos los insumos</option>${families.map(([family]) => `<option value="${family}">${categoryLabel(`family::${family}`, family)}</option>`).join("")}`;
    $("#categoryFilter").value = state.family;
    $("#taxonomyMenu").innerHTML = families.map(([family, subcategories]) => {
      const open = state.categoryMenuFamily === family;
      const visibleSubcategories = subcategories.filter((subcategory) => visibility[`subcategory::${family}::${subcategory}`] !== false);
      return `<article class="category-root ${open ? "open" : ""}">
        <button class="category-family" data-category-toggle="${family}" aria-expanded="${open}"><span>${categoryLabel(`family::${family}`, family)}</span><span>${open ? "−" : "+"}</span></button>
        <div class="category-children">
          <button class="category-all ${state.family === family && !state.subcategory ? "active" : ""}" data-family="${family}">Ver todos los productos de esta familia</button>
          ${visibleSubcategories.map((subcategory) => {
          const count = activeProducts().filter((product) => product.family === family && product.subcategory === subcategory).length;
          return `<button class="${state.subcategory === subcategory ? "active" : ""}" data-subcategory="${subcategory}" data-subcategory-family="${family}" ${count ? "" : "disabled title='Sin productos disponibles actualmente'"}>${categoryLabel(`subcategory::${family}::${subcategory}`, subcategory)}</button>`;
        }).join("")}</div></article>`;
    }).join("") + `<article class="category-root"><button class="category-family" data-family="Todos"><span>Ver todos los insumos</span><span>→</span></button></article>`;
  }

  function recommendedProducts(product) {
    return activeProducts()
      .filter((candidate) => candidate.id !== product.id)
      .sort((left, right) => {
        const leftScore = left.subcategory === product.subcategory ? 0 : left.family === product.family ? 1 : 2;
        const rightScore = right.subcategory === product.subcategory ? 0 : right.family === product.family ? 1 : 2;
        return leftScore - rightScore || left.name.localeCompare(right.name, "es");
      })
      .slice(0, 4);
  }

  function openProduct(id) {
    const product = productById(id);
    if (!product) return;
    state.selectedProduct = id;
    const pending = pricePending(product);
    const availableIndex = pending ? -1 : product.variants.findIndex((variant) => stockLimit(variant) > 0);
    const initialIndex = availableIndex >= 0 ? availableIndex : 0;
    const options = product.variants.map((variant, index) => {
      const stock = stockLimit(variant);
      const availability = Number.isFinite(stock) ? ` · ${stock} disponibles` : "";
      return `<option value="${index}" ${index === initialIndex ? "selected" : ""} ${pending || stock <= 0 ? "disabled" : ""}>${variant.label}${pending ? "" : ` · ${Store.money(Store.price(variant, state.settings))}${availability}`}</option>`;
    }
    ).join("");
    const recommendations = recommendedProducts(product);
    $("#productDetail").innerHTML = `<div class="product-detail">
      <img src="${product.image}" alt="${product.name}" onerror="this.src='assets/lumea-logo-icono.webp'" />
      <div><p class="eyebrow">${familyLabel(product)} · ${subcategoryLabel(product)}</p><h2>${product.name}</h2>
        <p class="detail-description">${product.description || "Producto para tus creaciones y fórmulas."}</p>
        <label class="field">Presentación<select id="detailVariant">${options}</select></label>
        <span class="detail-price" id="detailPrice">${pending ? "Precio por confirmar" : Store.money(Store.price(product.variants[initialIndex], state.settings))}</span>
        <p class="product-variation-note">Precio sujeto a cambios. El color, tono o apariencia puede variar ligeramente respecto a la fotografía.</p>
        <button class="primary-btn" id="detailAdd" ${availableIndex < 0 ? "disabled" : ""}>${pending ? "Próximamente" : availableIndex < 0 ? "Agotado" : "Agregar a la bolsa ＋"}</button>
      </div></div>
      ${recommendations.length ? `<section class="product-recommendations"><p class="eyebrow">PRODUCTOS RECOMENDADOS</p><h3>También te puede gustar</h3><div>${recommendations.map((item) =>
        `<button type="button" data-recommended-product="${item.id}"><img src="${item.image}" alt="" loading="lazy" decoding="async" onerror="this.src='assets/lumea-logo-icono.webp'" /><span>${item.name}</span><small>${subcategoryLabel(item)}</small></button>`
      ).join("")}</div></section>` : ""}`;
    if (!$("#productDialog").open) $("#productDialog").showModal();
    $("#detailVariant").addEventListener("change", (event) => {
      const variant = product.variants[Number(event.target.value)];
      $("#detailPrice").textContent = pending ? "Precio por confirmar" : Store.money(Store.price(variant, state.settings));
      $("#detailAdd").disabled = stockLimit(variant) <= 0;
      $("#detailAdd").textContent = stockLimit(variant) <= 0 ? "Agotado" : "Agregar a la bolsa ＋";
    });
    $("#detailAdd").addEventListener("click", () => {
      if (!addToCart(product.id, Number($("#detailVariant").value))) return;
      $("#productDialog").close();
      openCart();
    });
  }

  function persistCart() {
    Store.setCart(state.cart);
  }

  function addToCart(productId, variantIndex) {
    const product = productById(productId);
    const variant = product?.variants[variantIndex];
    if (!variant) return false;
    const match = state.cart.find((line) => line.productId === productId && line.variantIndex === variantIndex);
    if (match && match.qty >= stockLimit(variant)) {
      toast("No hay más unidades disponibles");
      return false;
    }
    if (match) match.qty += 1;
    else state.cart.push({ productId, variantIndex, qty: 1 });
    persistCart();
    renderCart();
    toast("Producto añadido a tu bolsa");
    return true;
  }

  function changeQty(key, amount) {
    const line = state.cart.find((item) => cartKey(item) === key);
    if (!line) return;
    const variant = productById(line.productId)?.variants[line.variantIndex];
    if (amount > 0 && variant && line.qty >= stockLimit(variant)) return toast("No hay más unidades disponibles");
    line.qty += amount;
    if (line.qty <= 0) state.cart = state.cart.filter((item) => cartKey(item) !== key);
    persistCart();
    renderCart();
  }

  function renderCart() {
    const originalLength = state.cart.length;
    state.cart = state.cart.filter((line) => {
      const product = productById(line.productId);
      return product && product.variants[line.variantIndex];
    });
    if (state.cart.length !== originalLength) persistCart();
    const count = state.cart.reduce((sum, line) => sum + line.qty, 0);
    $("#cartCount").textContent = count;
    $("#drawerCount").textContent = `(${count})`;
    $("#cartLines").innerHTML = state.cart.map((line) => {
      const product = productById(line.productId);
      const variant = product.variants[line.variantIndex];
      const key = cartKey(line);
      return `<article class="cart-line"><img src="${product.image}" alt="${product.name}" onerror="this.src='assets/lumea-logo-icono.webp'" />
        <div><h3>${product.name}</h3><small>${variant.label} · ${Store.money(Store.price(variant, state.settings))}</small>
          <div class="qty"><button data-minus="${key}" aria-label="Quitar uno">−</button><span>${line.qty}</span><button data-plus="${key}" aria-label="Agregar uno">+</button></div>
        </div><button class="remove" data-remove="${key}" aria-label="Eliminar">×</button></article>`;
    }).join("");
    $("#cartEmpty").style.display = count ? "none" : "flex";
    $("#cartTotalBox").style.display = count ? "block" : "none";
    $("#cartSubtotal").textContent = Store.money(cartSubtotal());
  }

  function openCart() {
    $("#cartDrawer").classList.add("open");
    $("#overlay").classList.add("open");
    $("#cartDrawer").setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeCart() {
    $("#cartDrawer").classList.remove("open");
    $("#overlay").classList.remove("open");
    $("#cartDrawer").setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function openCategories() {
    $("#headerTaxonomy").classList.add("open");
    $("#categoriesOpen").classList.add("active");
    $("#mobileMenu").classList.remove("open");
  }

  function closeCategories() {
    $("#headerTaxonomy").classList.remove("open");
    if (location.hash !== "#tienda") $("#categoriesOpen").classList.remove("active");
  }

  function routePage() {
    const hash = location.hash || "#inicio";
    const page = hash === "#tienda" ? "shop" : "home";
    document.querySelectorAll("[data-page]").forEach((section) => {
      section.hidden = section.dataset.page !== page;
    });
    $("#mobileMenu").classList.remove("open");
    if (hash === "#categorias") openCategories();
    else if (!hash.startsWith("#admin")) closeCategories();
    $("#categoriesOpen").classList.toggle("active", page === "shop" || $("#headerTaxonomy").classList.contains("open"));
    if (page === "shop") renderProducts();
  }

  function checkoutHeader(title) {
    return `<div class="checkout-head"><p class="eyebrow">PASO ${state.checkout.step} DE 4</p><h2>${title}</h2>
      <div class="checkout-progress">${[1,2,3,4].map((step) => `<span class="${step <= state.checkout.step ? "active" : ""}"></span>`).join("")}</div></div>`;
  }

  function navButtons(nextLabel = "Continuar") {
    return `<div class="checkout-nav">${state.checkout.step > 1 ? '<button class="secondary-btn" data-checkout-back>← Atrás</button>' : "<span></span>"}
      <button class="primary-btn" data-checkout-next>${nextLabel} →</button></div>`;
  }

  function renderCheckout() {
    const data = state.checkout;
    let body = "";
    if (data.step === 1) {
      body = `${checkoutHeader("¿Cómo recibirás tu pedido?")}
        <div class="choice-grid">
          <button class="choice ${data.fulfillment === "pickup" ? "selected" : ""}" data-fulfillment="pickup"><span>⌂</span><b>Pasaré a recoger</b><small>Sin costo de entrega. Te mostraremos el punto de recogida.</small></button>
          <button class="choice ${data.fulfillment === "delivery" ? "selected" : ""}" data-fulfillment="delivery"><span>✈</span><b>Entrega a domicilio</b><small>El costo depende del municipio de La Habana.</small></button>
        </div>${navButtons()}`;
    } else if (data.step === 2) {
      const municipalities = state.settings.municipalities.filter((item) => item.active).map((item) =>
        `<option value="${item.id}" ${data.municipality === item.id ? "selected" : ""}>${item.name} · ${Store.money(item.fee)}</option>`
      ).join("");
      body = `${checkoutHeader("Tus datos")}
        <div class="form-grid">
          <label class="field">Nombre completo<input id="checkoutName" value="${data.name}" required /></label>
          <label class="field">Teléfono / WhatsApp<input id="checkoutPhone" value="${data.phone}" required /></label>
          <label class="field wide">Correo electrónico<input id="checkoutEmail" type="email" value="${data.email}" required /></label>
          ${data.fulfillment === "delivery" ? `<label class="field wide">Municipio<select id="checkoutMunicipality"><option value="">Selecciona</option>${municipalities}</select></label>
          <label class="field wide">Dirección completa<textarea id="checkoutAddress" rows="3" placeholder="Calle, número, entrecalles y referencia">${data.address}</textarea></label>` :
          `<div class="bank-box wide"><b>Punto de recogida</b><br />${state.settings.pickupAddress}</div>`}
        </div>${navButtons()}`;
    } else if (data.step === 3) {
      const bank = state.settings.bank;
      const total = checkoutTotal();
      const deposit = depositAmount();
      const dueNow = data.payment ? paymentAmount() : 0;
      const balance = Math.max(0, total - dueNow);
      body = `${checkoutHeader("Forma de pago")}
        <div class="payment-intro"><b>Solicita tu pedido con un anticipo del 20%</b><span>El anticipo es de ${Store.money(deposit)} sobre un total de ${Store.money(total)}.</span></div>
        <div class="choice-grid">
          <button class="choice ${data.payment === "card" ? "selected" : ""}" data-payment="card"><span>▣</span><b>Tarjeta</b><small>Paga el pedido completo o reserva con el 20%.</small></button>
          <button class="choice ${data.payment === "cash" ? "selected" : ""}" data-payment="cash"><span>◉</span><b>Efectivo</b><small>Abona el 20% por tarjeta y paga el saldo en efectivo.</small></button>
        </div>
        ${data.payment === "card" ? `<div class="payment-amounts">
          <button class="payment-amount ${data.paymentPortion === "full" ? "selected" : ""}" data-payment-portion="full"><b>Pagar todo</b><small>${Store.money(total)} ahora</small></button>
          <button class="payment-amount ${data.paymentPortion === "deposit" ? "selected" : ""}" data-payment-portion="deposit"><b>Pagar el 20%</b><small>${Store.money(deposit)} ahora · saldo ${Store.money(total - deposit)}</small></button>
        </div>` : ""}
        ${data.payment && (data.payment === "cash" || data.paymentPortion) ? `<div class="payment-breakdown"><b>${data.payment === "cash" ? "Anticipo por tarjeta" : "Pago por tarjeta"}: ${Store.money(dueNow)}</b>${balance ? `<span>Saldo pendiente: ${Store.money(balance)}${data.payment === "cash" ? " en efectivo" : ""}</span>` : "<span>El pedido queda pagado en su totalidad.</span>"}</div>` : ""}
        ${data.payment ? `<div class="bank-box"><b>${bank.bank}</b><br />Beneficiario: ${bank.beneficiary}<br />Cuenta/tarjeta: ${bank.card}<br />Moneda: ${bank.currency}<br />${bank.instructions}</div>
        <label class="field">Comprobante del pago por tarjeta<input id="proofFile" type="file" accept="image/*" />${data.proof ? '<small>✓ Comprobante adjuntado</small><img class="proof-preview" src="' + data.proof + '" alt="Comprobante" />' : ""}</label>` : ""}
        ${navButtons()}`;
    } else {
      const municipality = selectedMunicipality();
      const fee = deliveryFee();
      body = `${checkoutHeader("Revisa tu pedido")}
        <div class="checkout-summary">
          ${state.cart.map((line) => {
            const product = productById(line.productId);
            const variant = product.variants[line.variantIndex];
            return `<div class="summary-row"><span>${line.qty} × ${product.name} (${variant.label})</span><b>${Store.money(lineTotal(line))}</b></div>`;
          }).join("")}
          <div class="summary-row"><span>Productos</span><b>${Store.money(cartSubtotal())}</b></div>
          <div class="summary-row"><span>${data.fulfillment === "delivery" ? `Entrega · ${municipality?.name || ""}` : "Recogida"}</span><b>${fee ? Store.money(fee) : "Sin costo"}</b></div>
          <div class="summary-row total"><span>Total</span><b>${Store.money(cartSubtotal() + fee)}</b></div>
          <div class="summary-row"><span>Pago enviado ahora</span><b>${Store.money(paymentAmount())}</b></div>
          ${checkoutTotal() - paymentAmount() > 0 ? `<div class="summary-row"><span>Saldo pendiente</span><b>${Store.money(checkoutTotal() - paymentAmount())}</b></div>` : ""}
        </div>
        <p class="detail-description"><b>${data.name}</b> · ${data.phone} · ${data.email}<br />${data.fulfillment === "delivery" ? data.address : state.settings.pickupAddress}<br />Pago: ${paymentLabel()}</p>
        ${navButtons("Completar pedido")}`;
    }
    $("#checkoutContent").innerHTML = `<div class="checkout-shell">${body}</div>`;
  }

  function collectCheckoutFields() {
    const data = state.checkout;
    if (data.step === 2) {
      data.name = $("#checkoutName")?.value.trim() || "";
      data.email = $("#checkoutEmail")?.value.trim() || "";
      data.phone = $("#checkoutPhone")?.value.trim() || "";
      data.municipality = $("#checkoutMunicipality")?.value || data.municipality;
      data.address = $("#checkoutAddress")?.value.trim() || "";
    }
  }

  function validateStep() {
    const data = state.checkout;
    if (data.step === 1 && !data.fulfillment) return "Selecciona recogida o entrega a domicilio";
    if (data.step === 2) {
      collectCheckoutFields();
      if (!data.name || !data.phone || !data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return "Completa nombre, teléfono y un correo válido";
      if (data.fulfillment === "delivery" && (!data.municipality || !data.address)) return "Selecciona el municipio y escribe la dirección";
    }
    if (data.step === 3 && !data.payment) return "Selecciona una forma de pago";
    if (data.step === 3 && data.payment === "card" && !data.paymentPortion) return "Elige si pagarás el total o el anticipo del 20%";
    if (data.step === 3 && !data.proof) return "Adjunta el comprobante del pago por tarjeta";
    return "";
  }

  const PROOF_MAX_SIDE = 1200;
  const PROOF_MAX_PIXELS = 1_000_000;
  const PROOF_MAX_DATA_URL_LENGTH = 1_400_000;

  function resizeProof(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//i.test(file.type || "")) {
        reject(new Error("El comprobante debe ser una imagen JPG, PNG o WEBP."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("No pudimos leer esa imagen. Intenta con otra captura."));
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          try {
            const width = image.naturalWidth || image.width || 1;
            const height = image.naturalHeight || image.height || 1;
            const sideScale = Math.min(1, PROOF_MAX_SIDE / Math.max(width, height));
            const pixelScale = Math.min(1, Math.sqrt(PROOF_MAX_PIXELS / Math.max(1, width * height)));
            let scale = Math.min(sideScale, pixelScale);
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            let result = "";
            for (const quality of [.7, .6, .5, .42]) {
              canvas.width = Math.max(1, Math.round(width * scale));
              canvas.height = Math.max(1, Math.round(height * scale));
              context.fillStyle = "#fff";
              context.fillRect(0, 0, canvas.width, canvas.height);
              context.drawImage(image, 0, 0, canvas.width, canvas.height);
              result = canvas.toDataURL("image/jpeg", quality);
              if (result.length <= PROOF_MAX_DATA_URL_LENGTH) break;
              scale *= .82;
            }
            if (result.length > PROOF_MAX_DATA_URL_LENGTH) {
              reject(new Error("El comprobante sigue demasiado pesado. Recorta la captura para que se vea solo el pago e intenta de nuevo."));
              return;
            }
            resolve(result);
          } catch {
            reject(new Error("El comprobante sigue demasiado pesado. Recorta la captura para que se vea solo el pago e intenta de nuevo."));
          }
        };
        image.onerror = () => reject(new Error("No pudimos abrir esa imagen. Usa una captura JPG o PNG."));
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function completeOrder() {
    const data = state.checkout;
    const fee = deliveryFee();
    const total = checkoutTotal();
    const paidNow = paymentAmount();
    const order = {
      id: Store.orderNumber(),
      createdAt: new Date().toISOString(),
      status: "Pedido recibido",
      customer: { name: data.name, email: data.email, phone: data.phone, address: data.address },
      fulfillment: data.fulfillment,
      municipality: selectedMunicipality()?.name || "",
      deliveryFee: fee,
      payment: data.payment,
      paymentPortion: data.paymentPortion,
      paymentAmount: paidNow,
      balanceDue: Math.max(0, total - paidNow),
      proof: data.proof,
      lines: state.cart.map((line) => {
        const product = productById(line.productId);
        const variant = product.variants[line.variantIndex];
        return { productId: product.id, name: product.name, variant: variant.label, qty: line.qty, unitPrice: Store.price(variant, state.settings) };
      }),
      subtotal: cartSubtotal(),
      total
    };
    try {
      await Store.saveOrder(order);
    } catch (error) {
      toast(error.message || "No pudimos registrar el pedido. Intenta nuevamente.");
      return;
    }
    const orderEmailBody = [
      `Pedido: ${order.id}`,
      `Cliente: ${order.customer.name}`,
      `Teléfono: ${order.customer.phone}`,
      `Entrega: ${order.fulfillment === "delivery" ? `${order.municipality} · ${order.customer.address}` : "Recogida"}`,
      `Forma de pago: ${paymentLabel()}`,
      `Pago enviado: ${Store.money(order.paymentAmount)}`,
      `Saldo pendiente: ${Store.money(order.balanceDue)}`,
      "",
      ...order.lines.map((line) => `${line.qty} × ${line.name} (${line.variant}) · ${Store.money(line.unitPrice * line.qty)}`),
      "",
      `Total: ${Store.money(order.total)}`
    ].join("\n");
    const orderEmailHref = `mailto:${state.settings.ordersEmail}?subject=${encodeURIComponent(`Pedido LUMEA ${order.id}`)}&body=${encodeURIComponent(orderEmailBody)}`;
    state.cart = [];
    persistCart();
    renderCart();
    $("#checkoutContent").innerHTML = `<div class="checkout-shell"><div class="order-success"><span>✓</span><h2>Gracias por tu pedido.</h2>
      <p>Guarda este número para consultar o cancelar tu pedido durante las próximas ${state.settings.cancelHours} horas.</p>
      <div class="order-number">${order.id}</div><p><b>Total: ${Store.money(order.total)}</b><br />Pago enviado para verificar: ${Store.money(order.paymentAmount)}${order.balanceDue ? `<br />Saldo pendiente: ${Store.money(order.balanceDue)}` : ""}</p>
      <a class="secondary-btn" href="${orderEmailHref}">Enviar copia a LUMEA por correo</a>
      <button class="primary-btn" data-order-done>Volver a la tienda</button></div></div>`;
  }

  function openCheckout() {
    if (!state.cart.length) return;
    closeCart();
    state.checkout = { step: 1, fulfillment: "", name: "", email: "", phone: "", address: "", municipality: "", payment: "", paymentPortion: "", proof: "" };
    renderCheckout();
    $("#checkoutDialog").showModal();
  }

  function openTracking() {
    $("#trackResult").innerHTML = "";
    $("#trackForm").reset();
    $("#trackDialog").showModal();
  }

  async function trackOrder(number, phone) {
    let order = null;
    try {
      order = await Store.lookupOrder(number, phone);
    } catch {
      order = null;
    }
    if (!order) {
      $("#trackResult").innerHTML = `<div class="track-result">No encontramos un pedido con esos datos.</div>`;
      return;
    }
    const cancellable = Store.canCancel(order, state.settings);
    const refundable = Store.cancellationRefundable(order, state.settings);
    const cancellationMessage = refundable
      ? `Puedes cancelar y recibir la devolución del anticipo durante las primeras ${state.settings.cancelHours} horas.`
      : "Puedes cancelar, pero el anticipo ya no es reembolsable.";
    const refundResult = order.status === "Cancelado"
      ? `<small>${order.cancellationRefund ? "El anticipo corresponde a devolución." : "El anticipo no es reembolsable por haberse cancelado después de 24 horas."}</small>`
      : "";
    $("#trackResult").innerHTML = `<div class="track-result"><p class="eyebrow">${order.id}</p><h3>${order.status}</h3>
      <p>${new Date(order.createdAt).toLocaleString("es-CU")} · ${Store.money(order.total)}</p>
      ${cancellable ? `<button class="cancel-btn" data-cancel-order="${order.id}">Cancelar pedido</button><small>${cancellationMessage}</small>` : refundResult || "<small>Este pedido ya no admite cancelación.</small>"}</div>`;
  }

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    if (typeof element.showPopover === "function" && !element.matches(":popover-open")) element.showPopover();
    element.classList.add("show");
    clearTimeout(window.lumeaToast);
    window.lumeaToast = setTimeout(() => {
      element.classList.remove("show");
      setTimeout(() => {
        if (typeof element.hidePopover === "function" && element.matches(":popover-open")) element.hidePopover();
      }, 220);
    }, 2300);
  }

  document.addEventListener("click", async (event) => {
    const shopLink = event.target.closest("[data-shop-family]");
    if (shopLink) {
      event.preventDefault();
      state.family = shopLink.dataset.shopFamily || "Todos";
      state.subcategory = shopLink.dataset.shopSubcategory || "";
      state.visible = 24;
      location.hash = "#tienda";
      routePage();
      renderTaxonomy();
      renderProducts();
      requestAnimationFrame(() => $("#tienda")?.scrollIntoView());
      return;
    }
    const pageLink = event.target.closest('a[href="#inicio"],a[href="#tienda"],a[href="#nosotros"],a[href="#informacion"]');
    if (pageLink) {
      event.preventDefault();
      location.hash = pageLink.getAttribute("href");
      routePage();
      requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView());
    }
    const view = event.target.closest("[data-view]");
    if (view) openProduct(view.dataset.view);
    const recommended = event.target.closest("[data-recommended-product]");
    if (recommended) openProduct(recommended.dataset.recommendedProduct);
    const plus = event.target.closest("[data-plus]");
    const minus = event.target.closest("[data-minus]");
    const remove = event.target.closest("[data-remove]");
    if (plus) changeQty(plus.dataset.plus, 1);
    if (minus) changeQty(minus.dataset.minus, -1);
    if (remove) {
      state.cart = state.cart.filter((line) => cartKey(line) !== remove.dataset.remove);
      persistCart(); renderCart();
    }
    const categoryToggle = event.target.closest("[data-category-toggle]");
    if (categoryToggle) {
      state.categoryMenuFamily = state.categoryMenuFamily === categoryToggle.dataset.categoryToggle ? "" : categoryToggle.dataset.categoryToggle;
      renderTaxonomy();
      return;
    }
    const family = event.target.closest("[data-family]");
    if (family) {
      state.family = family.dataset.family; state.subcategory = ""; state.visible = 24;
      $("#categoryFilter").value = state.family; renderTaxonomy(); renderProducts(); closeCategories(); location.hash = "#tienda"; routePage();
    }
    const subcategory = event.target.closest("[data-subcategory]");
    if (subcategory) {
      state.family = subcategory.dataset.subcategoryFamily; state.subcategory = subcategory.dataset.subcategory; state.visible = 24;
      $("#categoryFilter").value = state.family; renderTaxonomy(); renderProducts(); closeCategories(); location.hash = "#tienda"; routePage();
    }
    const fulfillment = event.target.closest("[data-fulfillment]");
    if (fulfillment) { state.checkout.fulfillment = fulfillment.dataset.fulfillment; renderCheckout(); }
    const payment = event.target.closest("[data-payment]");
    if (payment) {
      state.checkout.payment = payment.dataset.payment;
      state.checkout.paymentPortion = payment.dataset.payment === "cash" ? "deposit" : "";
      renderCheckout();
    }
    const paymentPortion = event.target.closest("[data-payment-portion]");
    if (paymentPortion) {
      state.checkout.paymentPortion = paymentPortion.dataset.paymentPortion;
      renderCheckout();
    }
    if (event.target.closest("[data-checkout-back]")) {
      collectCheckoutFields(); state.checkout.step -= 1; renderCheckout();
    }
    if (event.target.closest("[data-checkout-next]")) {
      const error = validateStep();
      if (error) return toast(error);
      if (state.checkout.step === 4) await completeOrder();
      else { state.checkout.step += 1; renderCheckout(); }
    }
    if (event.target.closest("[data-order-done]")) $("#checkoutDialog").close();
    const cancel = event.target.closest("[data-cancel-order]");
    if (cancel) {
      const number = $("#trackNumber").value.trim();
      const phone = $("#trackPhone").value.trim();
      const order = await Store.lookupOrder(number, phone).catch(() => null);
      if (order && Store.canCancel(order, state.settings)) {
        const cancelled = await Store.cancelOrder(order).catch(() => null);
        if (!cancelled) return toast("No pudimos cancelar el pedido.");
        await trackOrder(cancelled.id, cancelled.customer.phone);
        toast(cancelled.cancellationRefund ? "Pedido cancelado · anticipo por devolver" : "Pedido cancelado · anticipo no reembolsable");
      }
    }
    const close = event.target.closest("[data-close]");
    if (close) document.getElementById(close.dataset.close).close();
  });

  document.addEventListener("change", async (event) => {
    if (event.target.id === "proofFile" && event.target.files[0]) {
      toast("Preparando comprobante...");
      try {
        state.checkout.proof = await resizeProof(event.target.files[0]);
        renderCheckout();
        toast("Comprobante adjuntado y optimizado");
      } catch (error) {
        state.checkout.proof = "";
        event.target.value = "";
        toast(error.message || "No pudimos leer esa imagen");
      }
    }
  });

  $("#productSearch").addEventListener("input", (event) => { state.query = event.target.value; state.visible = 24; renderProducts(); });
  $("#categoryFilter").addEventListener("change", (event) => {
    state.family = event.target.value; state.subcategory = ""; state.visible = 24; renderTaxonomy(); renderProducts();
  });
  $("#searchOpen").addEventListener("click", () => {
    location.hash = "#tienda";
    routePage();
    requestAnimationFrame(() => $("#productSearch").focus());
  });
  $("#loadMore").addEventListener("click", () => { state.visible += 24; renderProducts(); });
  $("#cartOpen").addEventListener("click", openCart);
  $("#cartClose").addEventListener("click", closeCart);
  $("#overlay").addEventListener("click", closeCart);
  $("#checkoutOpen").addEventListener("click", openCheckout);
  $("#menuOpen").addEventListener("click", () => $("#mobileMenu").classList.toggle("open"));
  $("#categoriesOpen").addEventListener("click", openCategories);
  $("#mobileCategories").addEventListener("click", openCategories);
  $("#categoriesClose").addEventListener("click", closeCategories);
  $("#trackOpen").addEventListener("click", openTracking);
  $("#mobileTrack").addEventListener("click", openTracking);
  $("#trackForm").addEventListener("submit", async (event) => {
    event.preventDefault(); await trackOrder($("#trackNumber").value.trim(), $("#trackPhone").value.trim());
  });
  $("#newsletterForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#newsletterEmail").value.trim().toLowerCase();
    try {
      await Store.subscribe(email);
      event.target.reset(); toast("¡Ya formas parte del círculo LUMEA!");
    } catch {
      toast("No pudimos guardar tu correo. Intenta nuevamente.");
    }
  });
  window.addEventListener("lumea:data", () => {
    state.settings = Store.getSettings();
    state.products = Store.getProducts();
    renderTaxonomy(); renderProducts(); renderCart(); renderCommercialInfo();
  });

  $("#year").textContent = new Date().getFullYear();
  renderCommercialInfo();
  renderTaxonomy();
  renderProducts();
  renderCart();
  window.addEventListener("hashchange", routePage);
  routePage();
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}), { once: true });
  }
})();
