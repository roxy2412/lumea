# Guía para publicar LUMEA

## 1. Dirección que deben usar los compradores

Comparte solamente:

**https://lumea.vixo.com.mx**

No compartas la dirección terminada en `workers.dev`. El dominio propio está
conectado al Worker de producción y utiliza HTTPS.

Los compradores pueden abrir el enlace con Chrome, Safari, Firefox o el
navegador del teléfono. No necesitan iniciar sesión ni instalar una VPN.

## 2. Qué se hizo para conexiones limitadas

- Las fotografías grandes de LUMEA tienen versiones ligeras.
- Las fotografías de productos se cargan solo cuando se acercan a la pantalla.
- El servidor envía únicamente los campos necesarios del catálogo público.
- Los datos repetidos de precios y pesos no se descargan dos veces.
- La tienda guarda archivos y catálogo en la caché del navegador.
- En visitas posteriores puede abrir mucho más rápido.
- Se puede añadir la tienda a la pantalla de inicio del teléfono.

La primera visita siempre necesita conexión. Para enviar un pedido, subir un
comprobante o ver cambios recientes también se necesita Internet.

## 3. Comprobaciones en Cloudflare

En Cloudflare abre **Workers & Pages → lumea-vixo → Settings → Domains & Routes**.

Debe aparecer:

```text
lumea.vixo.com.mx     Production
```

Después comprueba:

1. Que el dominio esté activo.
2. Que el sitio sea público y no exija iniciar sesión con Cloudflare Access.
3. Que el certificado HTTPS esté activo.
4. Que D1 `lumea-store` y R2 `lumea-comprobantes` sigan conectados.

Si deseas una dirección adicional de respaldo, puedes agregar otro subdominio,
por ejemplo `tienda.vixo.com.mx`, al mismo Worker desde **Add Custom Domain**.

## 4. Subir el proyecto a GitHub

Usa la carpeta `SUBIR-A-GITHUB` que acompaña esta entrega.

1. Entra en GitHub.
2. Pulsa **New repository**.
3. Escribe un nombre, por ejemplo `lumea-tienda`.
4. Elige repositorio **Private** mientras terminas la configuración.
5. Crea el repositorio sin agregar archivos de ejemplo.
6. En el repositorio pulsa **Add file → Upload files**.
7. Abre la carpeta `SUBIR-A-GITHUB` y arrastra su contenido, no la carpeta
   completa como un único archivo.
8. Confirma con **Commit changes**.

No subas `.dev.vars`, contraseñas, cookies, sesiones ni archivos de
configuración personal. El paquete entregado no incluye esos datos.

## 5. Conectar GitHub con el Worker existente

En Cloudflare:

1. Abre **Workers & Pages**.
2. Selecciona `lumea-vixo`.
3. Abre **Settings → Builds**.
4. En **Git Repository**, pulsa **Connect**.
5. Autoriza Cloudflare para acceder al repositorio de LUMEA.
6. Selecciona la rama `main`.
7. Usa `/` como directorio raíz.
8. Usa `npm install` como comando de instalación si Cloudflare lo solicita.
9. Usa `npm run deploy` como comando de publicación.
10. Guarda la configuración.

A partir de ese momento, cada cambio confirmado en `main` podrá desplegar una
nueva versión del mismo Worker. Las vinculaciones D1 y R2 están declaradas en
`wrangler.jsonc`.

Los secretos `ADMIN_PASSWORD_HASH` y `SESSION_SECRET` deben permanecer
configurados en **Settings → Variables and Secrets**. Nunca deben escribirse en
GitHub.

## 6. Publicar manualmente

Desde una computadora con Node.js:

```text
npm install
npx wrangler login
npm run deploy
```

Wrangler mostrará la versión publicada. Después abre
`https://lumea.vixo.com.mx` y actualiza la página.

## 6.1. Activar correo automático de nuevos pedidos

La tienda ya está preparada para avisar al administrador cuando entra un pedido
nuevo. Para que el correo salga de verdad, falta configurar el servicio de
envío:

1. Crea una cuenta en Resend.
2. Verifica el dominio o remitente que usará LUMEA.
3. Copia la API Key de Resend.
4. En Cloudflare abre **Workers & Pages → lumea-vixo → Settings → Variables and Secrets**.
5. Pulsa **Add**.
6. Tipo: **Secret**.
7. Nombre: `RESEND_API_KEY`.
8. Valor: pega la API Key de Resend.
9. Guarda y despliega de nuevo el Worker.

El correo destino configurado es `lumea.cosmeticnatural@gmail.com`.
El remitente sugerido es `LUMEA <pedidos@vixo.com.mx>`.

No subas la API Key a GitHub. Debe quedar solo como secreto dentro de
Cloudflare.

## 7. Otros alojamientos

GitHub Pages, Netlify o un alojamiento de archivos estáticos pueden mostrar la
parte visual, pero por sí solos no proporcionan D1, R2, pedidos sincronizados,
comprobantes ni administración segura.

Para conservar todas las funciones, utiliza Cloudflare Workers como
publicación principal. GitHub debe utilizarse como repositorio y fuente de
despliegue automático.

## 8. Prueba desde Cuba

Pide a una persona en Cuba que pruebe con datos móviles y con Wi‑Fi:

1. Abrir `https://lumea.vixo.com.mx`.
2. Entrar en **Tienda**.
3. Buscar un producto.
4. Abrirlo y cambiar la presentación.
5. Agregarlo a la bolsa.
6. Volver a abrir la página para comprobar que la segunda carga sea más rápida.

Si una red específica no abre el dominio, prueba otra conexión o contacta al
proveedor. Ningún alojamiento puede garantizar que todos los proveedores
locales mantengan siempre la misma ruta internacional.

## 9. Documentación oficial

- Cloudflare Workers, dominios personalizados:
  https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- Cloudflare Workers, conexión con GitHub:
  https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/
- Cloudflare Cache:
  https://developers.cloudflare.com/cache/get-started/
