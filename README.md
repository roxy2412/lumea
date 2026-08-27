# LUMEA Cosmetics Store

Tienda en línea de LUMEA para Cuba, publicada en:

**https://lumea.vixo.com.mx**

Incluye catálogo, cantidades y precios en CUP, inventario, pedidos, anticipo,
comprobantes, entregas o recogidas, opiniones de clientes y administración
protegida. Los pedidos, productos, suscriptores, opiniones y formatos de correo
se guardan en Cloudflare D1; los comprobantes se guardan en Cloudflare R2.

## Publicación recomendada

La versión completa debe publicarse como **Cloudflare Worker**, porque GitHub
Pages y otros alojamientos estáticos no ejecutan la base de datos, la carga de
comprobantes ni el acceso administrativo.

El repositorio puede guardarse en GitHub y conectarse al Worker para publicar
automáticamente cada cambio. La guía completa está en
[`GUIA-PUBLICACION.md`](GUIA-PUBLICACION.md).

## Conexiones limitadas

La versión pública usa imágenes reducidas, carga las fotos según se necesitan,
sirve un catálogo público simplificado y guarda una copia local para las
siguientes visitas. Después de abrirla una vez, el navegador puede reutilizar
gran parte de la tienda aunque la conexión sea lenta o se interrumpa.

Los usuarios deben abrir el dominio propio, no la dirección `workers.dev`:

**https://lumea.vixo.com.mx**

No se necesita VPN para el funcionamiento normal del sitio. La disponibilidad
final también depende de la red y del proveedor de Internet del visitante.

## Administración

En `https://lumea.vixo.com.mx/#admin` se pueden gestionar productos, precios,
inventario, pedidos, comprobantes y categorías. En la sección Categorías, los
nombres se editan directamente en los campos visibles y se guardan sin abrir
una ventana adicional.

## Publicar desde este proyecto

```text
npm install
npm run deploy
```

La configuración está en `wrangler.jsonc`. No deben subirse `.dev.vars`,
contraseñas, sesiones ni carpetas internas de Wrangler; ya están excluidas por
`.gitignore`.

ACTUALIZAR
