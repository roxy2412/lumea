const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function constantTimeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function cookieValue(request, name) {
  const cookie = request.headers.get("cookie") || "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

async function adminAuthorized(request, env) {
  const session = cookieValue(request, "lumea_admin_session");
  const [expires, signature] = session.split(".");
  if (!expires || !signature || Number(expires) <= Date.now()) return false;
  const expected = await hmac(env.SESSION_SECRET || "", expires);
  return constantTimeEqual(signature, expected);
}

function sessionCookie(value, maxAge) {
  return `lumea_admin_session=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function publicSettings(settings) {
  if (!settings) return null;
  const { adminAuth, ...safe } = settings;
  return safe;
}

function publicProduct(product) {
  const lightImages = {
    "assets/lumea-organic-products-spanish.png": "assets/lumea-productos-ligero.jpg",
    "assets/lumea-productos-sin-foto.png": "assets/lumea-productos-ligero.jpg",
    "assets/lumea-lavanda-deshidratada.jpg": "assets/lumea-lavanda-deshidratada-ligero.jpg",
    "assets/lumea-calendula-deshidratada.jpg": "assets/lumea-calendula-deshidratada-ligero.jpg",
    "assets/lumea-insumo-liquido.jpg": "assets/lumea-insumo-liquido-ligero.jpg",
    "assets/lumea-baba-de-caracol.jpg": "assets/lumea-baba-de-caracol-ligero.jpg",
    "assets/lumea-fragancias.jpg": "assets/lumea-fragancias-ligero.jpg",
    "assets/lumea-cola-de-caballo.jpg": "assets/lumea-cola-de-caballo-ligero.jpg"
  };
  const image = lightImages[product.image] || product.image;
  const deferredImage = /^https:\/\//i.test(String(image || "")) || /^data:image\//i.test(String(image || ""));
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    family: product.family,
    subcategory: product.subcategory,
    description: product.description,
    image: deferredImage ? `/media/products/${encodeURIComponent(product.id)}` : image,
    active: product.active !== false,
    quoteOnly: Boolean(product.quoteOnly),
    variants: (product.variants || []).map((variant) => ({
      label: variant.label,
      amount: variant.amount,
      unit: variant.unit,
      shippingWeightGrams: variant.shippingWeightGrams,
      bioaleiPriceMxn: variant.bioaleiPriceMxn ?? variant.mxn,
      publicPriceCup: variant.publicPriceCup,
      stock: variant.stock
    }))
  };
}

function rowToOrder(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at || "",
    status: row.status,
    archived: Boolean(row.archived),
    archivedAt: row.archived_at || "",
    cancelledAt: row.cancelled_at || "",
    cancellationRefund: Boolean(row.cancellation_refund),
    customer: safeJson(row.customer_json, {}),
    fulfillment: row.fulfillment,
    municipality: row.municipality || "",
    deliveryFee: Number(row.delivery_fee) || 0,
    payment: row.payment,
    paymentPortion: row.payment_portion || "",
    paymentAmount: Number(row.payment_amount) || 0,
    balanceDue: Number(row.balance_due) || 0,
    proof: row.proof_key ? `/api/admin/orders/${encodeURIComponent(row.id)}/proof` : "",
    lines: safeJson(row.lines_json, []),
    subtotal: Number(row.subtotal) || 0,
    total: Number(row.total) || 0
  };
}

async function getProducts(env) {
  const result = await env.DB.prepare("SELECT data_json FROM products ORDER BY rowid").all();
  return result.results.map((row) => safeJson(row.data_json, null)).filter(Boolean);
}

async function getSettings(env) {
  const row = await env.DB.prepare("SELECT data_json FROM app_settings WHERE id = 1").first();
  return row ? safeJson(row.data_json, null) : null;
}

async function productImage(request, env, url, context) {
  if (request.method !== "GET") return json({ error: "Método no permitido." }, 405);
  const productId = decodeURIComponent(url.pathname.slice("/media/products/".length));
  if (!productId) return json({ error: "Imagen no encontrada." }, 404);
  const cached = await caches.default.match(request);
  if (cached) return cached;
  const row = await env.DB.prepare("SELECT data_json FROM products WHERE id = ?").bind(productId).first();
  const product = row ? safeJson(row.data_json, null) : null;
  if (!product?.image) return json({ error: "Imagen no encontrada." }, 404);
  const embedded = String(product.image).match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is);
  if (embedded) {
    const binary = atob(embedded[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const response = new Response(bytes, {
      status: 200,
      headers: {
        "content-type": embedded[1],
        "cache-control": "public, max-age=604800, s-maxage=604800",
        "x-content-type-options": "nosniff"
      }
    });
    context?.waitUntil(caches.default.put(request, response.clone()));
    return response;
  }
  let source;
  try {
    source = new URL(product.image);
  } catch {
    return env.ASSETS.fetch(new Request(new URL(product.image, request.url)));
  }
  const allowedHost = source.hostname === "bioalei.com" || source.hostname.endsWith(".bioalei.com");
  if (source.protocol !== "https:" || !allowedHost) {
    return env.ASSETS.fetch(new Request(new URL("/assets/lumea-logo-square.png", request.url)));
  }
  const upstream = await fetch(source.toString(), {
    cf: { cacheEverything: true, cacheTtl: 604800 }
  });
  if (!upstream.ok || !(upstream.headers.get("content-type") || "").startsWith("image/")) {
    return env.ASSETS.fetch(new Request(new URL("/assets/lumea-logo-square.png", request.url)));
  }
  const headers = new Headers();
  headers.set("content-type", upstream.headers.get("content-type"));
  headers.set("cache-control", "public, max-age=604800, s-maxage=604800");
  headers.set("x-content-type-options", "nosniff");
  const response = new Response(upstream.body, { status: 200, headers });
  context?.waitUntil(caches.default.put(request, response.clone()));
  return response;
}

async function getOrders(env) {
  const result = await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  return result.results.map(rowToOrder);
}

async function getEmailTemplates(env) {
  const result = await env.DB.prepare("SELECT data_json FROM email_templates ORDER BY rowid").all();
  return result.results.map((row) => safeJson(row.data_json, null)).filter(Boolean);
}

async function getSubscribers(env) {
  const result = await env.DB.prepare("SELECT email FROM subscribers ORDER BY email").all();
  return result.results.map((row) => row.email);
}

function money(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("es-MX")} CUP`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function paymentLabel(order) {
  if (order.payment === "card") return order.paymentPortion === "full" ? "Tarjeta - pago total" : "Tarjeta - anticipo del 20%";
  if (order.payment === "cash") return "Efectivo - anticipo del 20% por tarjeta";
  if (order.payment === "transfer") return "Transferencia";
  return order.payment || "No especificado";
}

function orderNotificationText(order, origin) {
  const delivery = order.fulfillment === "delivery"
    ? `${order.municipality || "Entrega"} - ${order.customer?.address || ""}`
    : "Recogida";
  return [
    `Nuevo pedido LUMEA: ${order.id}`,
    "",
    `Cliente: ${order.customer?.name || ""}`,
    `Telefono: ${order.customer?.phone || ""}`,
    `Correo: ${order.customer?.email || ""}`,
    `Entrega: ${delivery}`,
    `Pago: ${paymentLabel(order)}`,
    `Pago enviado: ${money(order.paymentAmount)}`,
    `Saldo pendiente: ${money(order.balanceDue)}`,
    "",
    "Productos:",
    ...(order.lines || []).map((line) => `${line.qty} x ${line.name} (${line.variant}) - ${money(Number(line.unitPrice) * Number(line.qty))}`),
    "",
    `Subtotal: ${money(order.subtotal)}`,
    `Total: ${money(order.total)}`,
    "",
    `Panel administrativo: ${origin}/#admin`
  ].join("\n");
}

function orderNotificationHtml(order, origin) {
  const lines = (order.lines || []).map((line) =>
    `<li>${escapeHtml(line.qty)} x ${escapeHtml(line.name)} (${escapeHtml(line.variant)}) - <b>${escapeHtml(money(Number(line.unitPrice) * Number(line.qty)))}</b></li>`
  ).join("");
  const delivery = order.fulfillment === "delivery"
    ? `${order.municipality || "Entrega"} - ${order.customer?.address || ""}`
    : "Recogida";
  return `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#26301f">
    <h2>Nuevo pedido LUMEA</h2>
    <p><b>Pedido:</b> ${escapeHtml(order.id)}</p>
    <p><b>Cliente:</b> ${escapeHtml(order.customer?.name)}<br>
    <b>Telefono:</b> ${escapeHtml(order.customer?.phone)}<br>
    <b>Correo:</b> ${escapeHtml(order.customer?.email)}</p>
    <p><b>Entrega:</b> ${escapeHtml(delivery)}</p>
    <p><b>Pago:</b> ${escapeHtml(paymentLabel(order))}<br>
    <b>Pago enviado:</b> ${escapeHtml(money(order.paymentAmount))}<br>
    <b>Saldo pendiente:</b> ${escapeHtml(money(order.balanceDue))}</p>
    <h3>Productos</h3>
    <ul>${lines}</ul>
    <p><b>Total:</b> ${escapeHtml(money(order.total))}</p>
    <p><a href="${escapeHtml(origin)}/#admin">Abrir panel administrativo</a></p>
  </div>`;
}

async function sendOrderNotification(env, order, origin) {
  if (!env.RESEND_API_KEY) return { skipped: "missing_api_key" };
  const settings = await getSettings(env).catch(() => null);
  const to = settings?.orderNotificationEmail || env.ORDER_NOTIFICATION_EMAIL || env.ADMIN_EMAIL;
  const from = settings?.orderNotificationFrom || env.ORDER_NOTIFICATION_FROM || env.EMAIL_FROM || "";
  if (!to || !from) return { skipped: "missing_email_config" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
      "user-agent": "LUMEA Store Worker"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Nuevo pedido LUMEA ${order.id}`,
      text: orderNotificationText(order, origin),
      html: orderNotificationHtml(order, origin)
    })
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`order_notification_failed:${response.status}:${details.slice(0, 160)}`);
  }
  return { ok: true };
}

async function storeProof(env, orderId, dataUrl) {
  if (!dataUrl) return "";
  if (!env.PROOFS) throw new Error("proof_storage_missing");
  if (dataUrl.length > 2_500_000) throw new Error("proof_too_large");
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) throw new Error("invalid_proof");
  const contentType = match[1];
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const key = `orders/${orderId}.${extension}`;
  await env.PROOFS.put(key, bytes, {
    httpMetadata: { contentType, cacheControl: "private, no-store" }
  });
  return key;
}

async function insertOrder(env, order, proofKey = "") {
  await env.DB.prepare(`
    INSERT INTO orders (
      id, created_at, updated_at, status, archived, archived_at,
      cancelled_at, cancellation_refund, customer_json,
      fulfillment, municipality, delivery_fee, payment, payment_portion,
      payment_amount, balance_due, proof_key, lines_json, subtotal, total
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      updated_at = excluded.updated_at,
      status = excluded.status,
      archived = excluded.archived,
      archived_at = excluded.archived_at,
      cancelled_at = excluded.cancelled_at,
      cancellation_refund = excluded.cancellation_refund,
      customer_json = excluded.customer_json,
      fulfillment = excluded.fulfillment,
      municipality = excluded.municipality,
      delivery_fee = excluded.delivery_fee,
      payment = excluded.payment,
      payment_portion = excluded.payment_portion,
      payment_amount = excluded.payment_amount,
      balance_due = excluded.balance_due,
      proof_key = COALESCE(NULLIF(excluded.proof_key, ''), orders.proof_key),
      lines_json = excluded.lines_json,
      subtotal = excluded.subtotal,
      total = excluded.total
  `).bind(
    order.id,
    order.createdAt || new Date().toISOString(),
    order.updatedAt || "",
    order.status || "Pedido recibido",
    order.archived ? 1 : 0,
    order.archivedAt || "",
    order.cancelledAt || "",
    order.cancellationRefund ? 1 : 0,
    JSON.stringify(order.customer || {}),
    order.fulfillment || "pickup",
    order.municipality || "",
    Number(order.deliveryFee) || 0,
    order.payment || "card",
    order.paymentPortion || "",
    Number(order.paymentAmount) || 0,
    Number(order.balanceDue) || 0,
    proofKey || "",
    JSON.stringify(order.lines || []),
    Number(order.subtotal) || 0,
    Number(order.total) || 0
  ).run();
}

async function decrementInventory(env, lines) {
  const updates = [];
  for (const line of lines) {
    const row = await env.DB.prepare("SELECT data_json FROM products WHERE id = ?").bind(line.productId).first();
    if (!row) continue;
    const product = safeJson(row.data_json, null);
    if (!product) continue;
    const variant = (product.variants || []).find((item) => item.label === line.variant);
    if (!variant || variant.stock === "" || variant.stock == null) continue;
    if (product.inventoryAvailable !== "" && product.inventoryAvailable != null && Number(variant.inventoryAmount) > 0) {
      const availableInventory = Math.max(0, Number(product.inventoryAvailable));
      const requiredInventory = Number(variant.inventoryAmount) * Number(line.qty);
      if (availableInventory < requiredInventory) throw new Error(`stock:${product.name}`);
      product.inventoryAvailable = availableInventory - requiredInventory;
      product.variants = product.variants.map((item) => ({
        ...item,
        stock: Number(item.inventoryAmount) > 0
          ? Math.floor(product.inventoryAvailable / Number(item.inventoryAmount))
          : item.stock
      }));
      updates.push(env.DB.prepare(
        "UPDATE products SET data_json = ?, updated_at = ? WHERE id = ?"
      ).bind(JSON.stringify(product), new Date().toISOString(), product.id));
      continue;
    }
    const available = Math.max(0, Number(variant.stock));
    if (available < Number(line.qty)) throw new Error(`stock:${product.name}`);
    variant.stock = available - Number(line.qty);
    updates.push(env.DB.prepare(
      "UPDATE products SET data_json = ?, updated_at = ? WHERE id = ?"
    ).bind(JSON.stringify(product), new Date().toISOString(), product.id));
  }
  if (updates.length) await env.DB.batch(updates);
}

async function handleApi(request, env, url, context) {
  if (request.method === "GET" && url.pathname === "/api/bootstrap") {
    const [products, settings] = await Promise.all([getProducts(env), getSettings(env)]);
    return json({
      products: products.length ? products.map(publicProduct) : null,
      settings: publicSettings(settings)
    }, 200, { "cache-control": "public, max-age=60, stale-while-revalidate=86400" });
  }

  if (request.method === "POST" && url.pathname === "/api/orders") {
    let order = null;
    try {
      order = await request.json();
    } catch {
      return json({ error: "No pudimos leer el pedido. Si adjuntaste una captura, prueba con una imagen mas ligera." }, 400);
    }
    if (!order?.id || !order?.customer?.name || !order?.customer?.phone || !Array.isArray(order.lines) || !order.lines.length) {
      return json({ error: "Pedido incompleto." }, 400);
    }
    let proofKey = "";
    let inserted = false;
    try {
      proofKey = await storeProof(env, order.id, order.proof || "");
      await insertOrder(env, { ...order, proof: "" }, proofKey);
      inserted = true;
      await decrementInventory(env, order.lines);
      const savedOrder = { ...order, proof: proofKey ? `/api/admin/orders/${encodeURIComponent(order.id)}/proof` : "" };
      const notification = sendOrderNotification(env, savedOrder, url.origin).catch((error) => {
        console.error("order notification failed", error.message);
      });
      if (context?.waitUntil) context.waitUntil(notification);
      else await notification;
      return json({
        ok: true,
        order: savedOrder
      }, 201);
    } catch (error) {
      if (inserted) await env.DB.prepare("DELETE FROM orders WHERE id = ?").bind(order.id).run().catch(() => {});
      if (proofKey) await env.PROOFS.delete(proofKey).catch(() => {});
      if (error.message === "proof_too_large") return json({ error: "El comprobante es demasiado grande." }, 413);
      if (error.message === "invalid_proof") return json({ error: "El comprobante no es una imagen válida." }, 400);
      if (error.message === "proof_storage_missing") return json({ error: "No pudimos guardar el comprobante. El almacenamiento de comprobantes no esta conectado." }, 500);
      if (error.message.startsWith("stock:")) return json({ error: `No hay existencias suficientes de ${error.message.slice(6)}.` }, 409);
      throw error;
    }
  }

  if (request.method === "POST" && url.pathname === "/api/orders/lookup") {
    const query = await request.json();
    const row = await env.DB.prepare("SELECT * FROM orders WHERE lower(id) = lower(?)").bind(String(query.id || "")).first();
    if (!row) return json({ error: "No encontramos un pedido con esos datos." }, 404);
    const order = rowToOrder(row);
    const expectedPhone = String(order.customer.phone || "").replace(/\D/g, "");
    const suppliedPhone = String(query.phone || "").replace(/\D/g, "");
    if (!suppliedPhone || expectedPhone !== suppliedPhone) return json({ error: "No encontramos un pedido con esos datos." }, 404);
    order.proof = "";
    return json({ order });
  }

  const cancelMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/cancel$/);
  if (request.method === "POST" && cancelMatch) {
    const orderId = decodeURIComponent(cancelMatch[1]);
    const query = await request.json();
    const row = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first();
    if (!row) return json({ error: "Pedido no encontrado." }, 404);
    const order = rowToOrder(row);
    const expectedPhone = String(order.customer.phone || "").replace(/\D/g, "");
    const suppliedPhone = String(query.phone || "").replace(/\D/g, "");
    if (!suppliedPhone || expectedPhone !== suppliedPhone) return json({ error: "Pedido no encontrado." }, 404);
    if (["Cancelado", "Entregado", "Recogido"].includes(order.status)) {
      return json({ error: "Este pedido ya no puede cancelarse." }, 409);
    }
    const settings = await getSettings(env);
    const cancelHours = Number(settings?.cancelHours) || 24;
    const refundable = Date.now() - new Date(order.createdAt).getTime() <= cancelHours * 60 * 60 * 1000;
    const cancelledAt = new Date().toISOString();
    await env.DB.prepare(`
      UPDATE orders
      SET status = 'Cancelado', updated_at = ?, cancelled_at = ?, cancellation_refund = ?
      WHERE id = ?
    `).bind(cancelledAt, cancelledAt, refundable ? 1 : 0, orderId).run();
    return json({
      order: { ...order, status: "Cancelado", updatedAt: cancelledAt, cancelledAt, cancellationRefund: refundable }
    });
  }

  if (request.method === "POST" && url.pathname === "/api/subscribers") {
    const data = await request.json();
    const email = String(data.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Correo inválido." }, 400);
    await env.DB.prepare(
      "INSERT OR IGNORE INTO subscribers (email, created_at) VALUES (?, ?)"
    ).bind(email, new Date().toISOString()).run();
    return json({ ok: true });
  }

  if (request.method === "POST" && url.pathname === "/api/admin/login") {
    if (!env.ADMIN_PASSWORD_HASH || !env.SESSION_SECRET) return json({ error: "La administración aún no está configurada." }, 503);
    const credentials = await request.json();
    const emailMatches = String(credentials.email || "").trim().toLowerCase() === String(env.ADMIN_EMAIL || "").toLowerCase();
    const passwordHash = await sha256(String(credentials.password || ""));
    if (!emailMatches || !constantTimeEqual(passwordHash, env.ADMIN_PASSWORD_HASH)) {
      return json({ error: "Usuario o contraseña incorrectos." }, 401);
    }
    const maxAge = 8 * 60 * 60;
    const expires = String(Date.now() + maxAge * 1000);
    const signature = await hmac(env.SESSION_SECRET, expires);
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(`${expires}.${signature}`, maxAge) });
  }

  if (request.method === "POST" && url.pathname === "/api/admin/logout") {
    return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
  }

  if (!url.pathname.startsWith("/api/admin/")) return json({ error: "No encontrado." }, 404);
  if (!(await adminAuthorized(request, env))) return json({ error: "Sesión no autorizada." }, 401);

  if (request.method === "GET" && url.pathname === "/api/admin/bootstrap") {
    const [products, settings, orders, emailTemplates, subscribers] = await Promise.all([
      getProducts(env),
      getSettings(env),
      getOrders(env),
      getEmailTemplates(env),
      getSubscribers(env)
    ]);
    return json({ products: products.length ? products : null, settings, orders, emailTemplates, subscribers });
  }

  const productMatch = url.pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
  if (productMatch && request.method === "PUT") {
    const productId = decodeURIComponent(productMatch[1]);
    const product = await request.json();
    if (!product?.id || product.id !== productId || !product.name || !Array.isArray(product.variants)) {
      return json({ error: "Producto inválido." }, 400);
    }
    await env.DB.prepare(
      "INSERT INTO products (id, data_json, updated_at) VALUES (?, ?, ?)"
      + " ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at"
    ).bind(product.id, JSON.stringify(product), new Date().toISOString()).run();
    return json({ ok: true, product });
  }

  if (productMatch && request.method === "DELETE") {
    const productId = decodeURIComponent(productMatch[1]);
    await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(productId).run();
    return json({ ok: true });
  }

  if (request.method === "DELETE" && url.pathname === "/api/admin/products") {
    const payload = await request.json();
    const ids = payload?.ids;
    if (!Array.isArray(ids) || !ids.length || ids.length > 40) {
      return json({ error: "Selección de productos inválida." }, 400);
    }
    await env.DB.batch(ids.map((id) =>
      env.DB.prepare("DELETE FROM products WHERE id = ?").bind(String(id))
    ));
    return json({ ok: true, count: ids.length });
  }

  if (request.method === "PUT" && url.pathname === "/api/admin/products") {
    const payload = await request.json();
    const products = Array.isArray(payload) ? payload : payload.products;
    if (!Array.isArray(products) || products.length > 40) return json({ error: "Bloque de catálogo inválido." }, 400);
    const statements = [
      ...(payload.reset ? [env.DB.prepare("DELETE FROM products")] : []),
      ...products.map((product) => env.DB.prepare(
        "INSERT INTO products (id, data_json, updated_at) VALUES (?, ?, ?)"
        + " ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at"
      ).bind(product.id, JSON.stringify(product), new Date().toISOString()))
    ];
    await env.DB.batch(statements);
    return json({ ok: true, count: products.length });
  }

  if (request.method === "PUT" && url.pathname === "/api/admin/settings") {
    const settings = await request.json();
    await env.DB.prepare(`
      INSERT INTO app_settings (id, data_json, updated_at) VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at
    `).bind(JSON.stringify(settings), new Date().toISOString()).run();
    return json({ ok: true });
  }

  if (request.method === "PUT" && url.pathname === "/api/admin/email-templates") {
    const templates = await request.json();
    if (!Array.isArray(templates)) return json({ error: "Formatos inválidos." }, 400);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM email_templates"),
      ...templates.map((template) => env.DB.prepare(
        "INSERT INTO email_templates (id, data_json, updated_at) VALUES (?, ?, ?)"
      ).bind(template.id, JSON.stringify(template), new Date().toISOString()))
    ]);
    return json({ ok: true, count: templates.length });
  }

  if (request.method === "PUT" && url.pathname === "/api/admin/subscribers") {
    const payload = await request.json();
    const subscribers = Array.isArray(payload) ? payload : payload.subscribers;
    if (!Array.isArray(subscribers) || subscribers.length > 40) return json({ error: "Bloque de suscriptores inválido." }, 400);
    await env.DB.batch([
      ...(payload.reset ? [env.DB.prepare("DELETE FROM subscribers")] : []),
      ...subscribers.map((email) => env.DB.prepare(
        "INSERT INTO subscribers (email, created_at) VALUES (?, ?)"
      ).bind(String(email).trim().toLowerCase(), new Date().toISOString()))
    ]);
    return json({ ok: true, count: subscribers.length });
  }

  const orderMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);
  if (orderMatch && request.method === "PUT") {
    const orderId = decodeURIComponent(orderMatch[1]);
    const order = await request.json();
    if (!order?.id || order.id !== orderId || !order.customer?.name || !order.customer?.phone || !Array.isArray(order.lines) || !order.lines.length) {
      return json({ error: "Pedido inválido." }, 400);
    }
    await insertOrder(env, {
      ...order,
      updatedAt: new Date().toISOString()
    });
    const row = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first();
    return json({ ok: true, order: rowToOrder(row) });
  }

  if (orderMatch && request.method === "DELETE") {
    const orderId = decodeURIComponent(orderMatch[1]);
    const row = await env.DB.prepare("SELECT proof_key FROM orders WHERE id = ?").bind(orderId).first();
    await env.DB.prepare("DELETE FROM orders WHERE id = ?").bind(orderId).run();
    if (row?.proof_key && env.PROOFS) await env.PROOFS.delete(row.proof_key).catch(() => {});
    return json({ ok: true });
  }

  if (request.method === "PUT" && url.pathname === "/api/admin/orders") {
    const orders = await request.json();
    if (!Array.isArray(orders) || orders.length > 40) return json({ error: "Bloque de pedidos inválido." }, 400);
    for (const order of orders) await insertOrder(env, order);
    return json({ ok: true, count: orders.length });
  }

  const proofMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)\/proof$/);
  if (request.method === "GET" && proofMatch) {
    const orderId = decodeURIComponent(proofMatch[1]);
    const row = await env.DB.prepare("SELECT proof_key FROM orders WHERE id = ?").bind(orderId).first();
    if (!row?.proof_key) return json({ error: "Comprobante no encontrado." }, 404);
    const object = await env.PROOFS.get(row.proof_key);
    if (!object) return json({ error: "Comprobante no encontrado." }, 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("cache-control", "private, no-store");
    headers.set("content-security-policy", "default-src 'none'; img-src 'self'");
    return new Response(object.body, { headers });
  }

  return json({ error: "No encontrado." }, 404);
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/media/products/")) return await productImage(request, env, url, context);
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env, url, context);
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      headers.set("x-content-type-options", "nosniff");
      headers.set("referrer-policy", "strict-origin-when-cross-origin");
      headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
      headers.set("content-security-policy", "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://mail.google.com");
      if (/\.(?:png|jpe?g|webp|gif|svg|mp4)$/i.test(url.pathname)) {
        headers.set("cache-control", "public, max-age=604800, stale-while-revalidate=2592000");
      } else if (/\.(?:css|js)$/i.test(url.pathname)) {
        headers.set("cache-control", "public, max-age=86400, stale-while-revalidate=604800");
      } else {
        headers.set("cache-control", "no-cache");
      }
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch (error) {
      console.error(error);
      return json({ error: "No pudimos completar la solicitud." }, 500);
    }
  }
};
