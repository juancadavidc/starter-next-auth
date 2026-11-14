# Arquitectura de referencia — e-commerce

**Para qué es este documento.** `starter-next-auth` resuelve lo que toda idea necesita
(auth, roles, Postgres, storage, despliegue). Este documento define la capa que necesita
**una tienda**: qué módulos tiene, dónde vive cada regla, cómo fluyen un pedido y un pago, y
qué garantiza la arquitectura por diseño para no caer en los errores que más cuestan
conversión.

La vara de medida es el checklist de Instabiz *"25 errores en tu tienda online"* (Home,
Producto, Checkout, Confianza, Mobile). Cada ítem queda asignado a un módulo responsable
(§8): si un ítem falla en una tienda construida sobre esta referencia, se sabe dónde va el
arreglo.

El primer caso de uso es `ecom-nude` (ver su `docs/auditoria-25-errores.md`). Está escrito
para Colombia (COP, Nequi, PSE, contra entrega), pero los puertos (§4) aíslan lo local.

---

## 1. Principios

1. **El dominio es puro.** Precio, carrito, descuentos, envío y el ciclo de vida del pedido
   son funciones sin I/O, testeadas sin base ni red. Las páginas y las server actions solo
   orquestan. Es la diferencia entre "cambiar la regla de envío gratis" en un archivo o en
   seis componentes.
2. **Todo lo externo entra por un puerto.** Pasarela, transportadora, correo, WhatsApp,
   analítica, almacenamiento: una interfaz en el dominio, un adaptador por proveedor. La
   tienda arranca con adaptadores manuales (transferencia, tabla de tarifas, link `wa.me`) y
   cambia a una API sin tocar el checkout.
3. **El servidor es la fuente de verdad del dinero.** El cliente nunca manda un precio ni un
   total: manda SKUs y cantidades, el servidor recalcula. Un webhook de pago se verifica por
   firma y se procesa de forma idempotente.
4. **La operación se configura, no se despliega.** Tarifas, ciudades, cuentas bancarias,
   códigos, WhatsApp, anuncios: tabla `config` editable en `/admin`. Desplegar para cambiar
   una tarifa es un error de arquitectura.
5. **SEO y velocidad son estructura, no pulido.** Catálogo y ficha son Server Components,
   nada indexable se oculta sin JS, imágenes por `next/image` con anchos fijos. Presupuesto
   en §7.
6. **Los efectos secundarios pasan por un outbox.** Correos, recordatorios de carrito,
   pedidos de reseña y eventos de conversión se escriben como filas en la misma transacción
   que el cambio de estado y los despacha un worker. Si Resend se cae, el pedido no se pierde.
7. **Lo que el checklist exige, lo exige un test.** Los ítems verificables (WhatsApp bien
   formado, datos legales sin `PENDIENTE` en producción, CTA visible a 375px, ≥4 fotos por
   producto publicado) son tests o gates de lanzamiento, no buenas intenciones (§9).

---

## 2. Módulos

Extiende el monorepo de la plantilla. Lo de la plantilla no se toca; lo nuevo se agrega.

```
apps/web                      Next 16: tienda, checkout, /admin, webhooks, cron
packages/
├── auth  db  env  storage  ui    ← plantilla (sin cambios)
├── commerce                  dominio PURO: catálogo, precio, carrito, descuentos,
│                             envío (reglas), máquina de estados del pedido
├── payments                  puerto PaymentProvider + adaptadores
├── shipping                  puerto ShippingQuoter + adaptadores
├── notify                    puerto Notifier (correo, WhatsApp) + plantillas
├── jobs                      outbox, worker y tareas programadas
└── analytics                 eventos de e-commerce → GA4 / Meta CAPI / Pinterest
```

| Paquete | Depende de | No puede depender de |
|---------|-----------|----------------------|
| `commerce` | nada (solo tipos) | `db`, `next`, cualquier SDK |
| `payments`, `shipping`, `notify` | `commerce` (tipos), `env` | `next` |
| `jobs` | `db`, `notify`, `analytics` | `next` |
| `apps/web` | todos | SDKs directos (van por su puerto) |

La regla de dependencias se verifica con un test de arquitectura (como el
`architecture.test.ts` que ya tiene `apps/web`).

**Para una tienda pequeña de un solo paquete** (como `ecom-nude/tienda`), los mismos
módulos viven como carpetas en `src/lib/` (`lib/commerce`, `lib/pagos`, …) con la misma
regla de dependencias. Lo que importa es el límite, no el número de `package.json`.

---

## 3. Modelo de datos

Tablas nuevas en `packages/db/src/schema/app.ts` (migraciones solo aditivas, como siempre).

```
catálogo
  categoria        slug, nombre, intro_seo, orden, publicada
  producto         slug, nombre, categoria_id, coleccion, precio_base, descripcion,
                   detalles[], estado (borrador|publicado|agotado|proximamente),
                   seo {titulo, descripcion}, guia_tallas_id, medidas jsonb
  variante         producto_id, sku (único), color, hex, talla, precio (null = base),
                   disponible bool, stock int null   ← null = sin control de inventario
  imagen           producto_id, color, clave_storage, ancho, alto, alt, rol
                   (frente|espalda|detalle|uso|escala), orden
  combina_con      producto_id → producto_id, orden
  guia_tallas      nombre, tabla jsonb, como_medirse

carrito (servidor, no solo localStorage)
  carrito          id (cookie), correo null, celular null, estado
                   (activo|convertido|abandonado), actualizado_en
  carrito_item     carrito_id, sku, cantidad

pedido
  pedido           numero corto, estado, contacto, dirección, metodo_pago,
                   subtotal, envio, descuento, total, codigo, guia, carrito_id
  pedido_item      copia congelada de lo comprado (sku, nombre, color, talla, precio, foto)
  pedido_evento    pedido_id, de, a, actor, nota, creado_en     ← auditoría de estados
  pago             pedido_id, proveedor, referencia_externa (única), estado, monto,
                   payload jsonb, creado_en                     ← idempotencia de webhooks

confianza
  resena           producto_id, pedido_id, nombre, calificacion 1–5, texto, fotos[],
                   estado (pendiente|publicada|rechazada), verificada bool
  suscriptora      correo, origen, acepto_datos_en           (Ley 1581)

operación
  config           clave, valor jsonb       ← tarifas, ciudades, cuentas, WhatsApp, anuncios
  descuento        codigo, tipo (% | fijo | envio), valor, minimo, vigencia, usos_max
  outbox           tipo, payload, ejecutar_en, intentos, procesado_en, error
```

Decisiones que vale la pena no rediscutir:

- **El carrito vive en el servidor.** `localStorage` hace imposible el recordatorio de
  carrito abandonado (ítem 13) y pierde el carrito al cambiar de dispositivo (de Instagram
  en el celular al computador). El cliente guarda solo el id en una cookie.
- **`pedido_item` es una copia.** Si el producto cambia de precio o de foto, el pedido no.
- **`stock` es nullable.** Una marca chica arranca con "disponible sí/no"; el día que mida
  inventario, la columna ya está.
- **Las fotos tienen `rol`.** Así el panel puede decir "a este producto le falta la foto de
  detalle" en vez de solo contar (ítem 06).

---

## 4. Puertos y adaptadores

```ts
// packages/commerce/src/ports.ts — el dominio define, los adaptadores cumplen

interface PaymentProvider {
  id: 'transferencia' | 'contraentrega' | 'wompi' | 'mercadopago' | 'bold' | 'addi'
  // Manual: devuelve instrucciones. Pasarela: devuelve URL o datos del widget.
  iniciar(pedido: PedidoParaPago): Promise<InicioPago>
  // Solo pasarelas: valida firma, normaliza el estado. Nunca confía en el body sin firma.
  verificarWebhook?(req: Request): Promise<EventoPago | null>
}

interface ShippingQuoter {
  cotizar(destino: { departamento: string; ciudad: string }, carrito: CarritoTotales):
    Promise<{ valor: number; dias: [min: number, max: number]; transportadora: string }>
}

interface Notifier {
  enviar(mensaje: { canal: 'correo' | 'whatsapp'; plantilla: Plantilla; a: string; datos: object }):
    Promise<void>
}
```

| Puerto | Adaptador de arranque | Siguiente adaptador |
|--------|----------------------|---------------------|
| Pago | transferencia (Nequi/Bancolombia), contra entrega | Wompi o Mercado Pago (tarjeta + **PSE** + Nequi), Addi/Sistecrédito (cuotas) |
| Envío | tabla por zona desde `config` | API de transportadora (Coordinadora, Envia, Mipaquete) |
| Correo | Resend | — |
| WhatsApp | link `wa.me` con mensaje precargado | WhatsApp Cloud API para recordatorios |
| Analítica | GA4 + Meta Pixel en cliente | + Meta Conversions API desde el servidor (compras reales, no bloqueables) |

**La cotización de envío es una sola función** y la usan la ficha, el carrito y el checkout.
Por eso el costo no puede "aparecer al final" (ítems 10 y 14): las tres pantallas muestran
el mismo número porque llaman a lo mismo.

---

## 5. Flujos

### 5.1 Compra

```
Instagram/Ads ─► Home ─► Catálogo ─► Ficha ─► Carrito (panel) ─► Checkout (1 página) ─► Confirmación
                                       │          │                   │
                                       │          │                   ├─ 1. Contacto  ← correo/celular
                                       │          │                   │     se guardan en `carrito`
                                       │          │                   │     al salir del campo (§5.3)
                                       │          │                   ├─ 2. Entrega   ← cotiza envío en vivo
                                       │          │                   └─ 3. Pago      ← total exacto, sin "por calcular"
                                       │          └─ subtotal + envío estimado + "faltan $X para envío gratis" (si existe)
                                       └─ precio, envío estimado, CTA fijo en móvil, WhatsApp con el producto
```

Checkout de invitada, siempre (ítem 11). La cuenta, si algún día existe, se ofrece en la
confirmación. Tres bloques en una página con indicador de progreso (ítem 12).

### 5.2 Ciclo de vida del pedido

```
                  ┌──────────── cancelado ◄──────────┐
                  │                                   │
 nuevo ─► confirmado ─► pagado ─► enviado ─► entregado ─► (reseña solicitada)
   │                      ▲
   └── pasarela ──────────┘   webhook firmado: nuevo → pagado directo
```

- La máquina de estados vive en `commerce` y es la única que decide qué transición es
  válida. El panel y el webhook llaman a `transicionar(pedido, a, actor)`; cada transición
  escribe `pedido_evento` y, en la misma transacción, sus filas de `outbox`.
- **Contra entrega pasa por `confirmado`** (llamada o WhatsApp antes de despachar): es el
  control operativo contra la devolución.
- **Transferencia** espera el comprobante; el admin lo marca `pagado`.

| Transición | Outbox |
|-----------|--------|
| → `nuevo` | correo de confirmación, evento `purchase` server-side, aviso a la tienda |
| → `pagado` | correo "pago recibido" |
| → `enviado` | correo con guía y link de rastreo |
| → `entregado` | `solicitar_resena` con `ejecutar_en = +7 días` |

### 5.3 Carrito abandonado (ítem 13)

1. El carrito guarda correo/celular en cuanto la clienta los escribe en el bloque 1 del
   checkout (con el consentimiento de Ley 1581 en el mismo bloque).
2. Un job programado marca `abandonado` los carritos con contacto, sin pedido y sin
   actividad hace 1 h, y encola tres recordatorios: **1 h, 24 h, 72 h**.
3. El correo lleva el producto con foto y un link que restaura ese carrito (`/c/<token>`).
4. Si el carrito se convierte, los recordatorios pendientes se cancelan.

### 5.4 Reseñas (ítem 09)

Reseña **verificada por pedido**: el job de `entregado + 7 días` manda un link único por
pedido. La reseña entra `pendiente`, se modera en `/admin` y se publica. La ficha muestra
promedio + conteo + JSON-LD `AggregateRating`. No se importan ni se inventan reseñas: la
arquitectura solo acepta las que vienen de un pedido.

### 5.5 Jobs y cron

El worker es la misma imagen con otro comando (`node worker.ts`) o un cron de Coolify que
llama `POST /api/cron/<tarea>` con un secreto compartido. Tareas:

| Tarea | Frecuencia |
|-------|-----------|
| `outbox:despachar` | cada minuto |
| `carritos:marcar-abandonados` | cada 15 min |
| `pedidos:transferencia-sin-pago` (recordatorio a 24 h, cancelación a 72 h) | cada hora |

---

## 6. Superficies (rutas)

```
(tienda)/                 header + footer completos
  /                       home
  /[categoria]            catálogo con filtros en la URL
  /[categoria]/[slug]     ficha
  /buscar                 resultados (+ /api/buscar para autocompletar)
  /nosotros /envios /cambios /guia-de-tallas /contacto /legales
(checkout)/               header solo con logo
  /checkout  /pedido/[id]  /c/[token] (restaura carrito)
admin/                    requirePermission("catalogo.*" | "pedidos.*" | "config.*" | "resenas.*")
api/
  webhooks/<proveedor>    pagos (firma + idempotencia por referencia_externa)
  cron/<tarea>            jobs (secreto)
  health  health/db
feed/productos.xml        Google Merchant, Meta Commerce, Pinterest
sitemap.xml  robots.txt
```

Permisos nuevos en `packages/auth/src/permissions.ts`: `catalogo.editar`,
`pedidos.ver`, `pedidos.gestionar`, `config.editar`, `resenas.moderar`. Una persona de
despachos puede gestionar pedidos sin tocar precios — con roles como datos, sin código.

### Componentes obligatorios del shell de tienda

| Componente | Regla |
|-----------|-------|
| `BotonWhatsApp` flotante | Visible en móvil, fuera del área del CTA fijo, número desde `config` normalizado a E.164 y **mensaje precargado según la página** ("Hola, tengo una pregunta sobre *Legging Duna* talla M"). Se oculta en checkout para no competir con "Confirmar" |
| `BarraAnuncio` | Oferta o beneficio concreto, desde `config`. Nunca "Bienvenidos" |
| `Footer` | Datos legales (razón social, NIT, dirección, teléfono) leídos de `config`, medios de pago con íconos, links a cambios/envíos/legales, redes |
| `FranjaConfianza` | Envío, pagos, cambios: los mismos textos que la ficha |
| `PrecioYEnvio` | Precio + "Envío desde $X · llega en N–M días", vía `ShippingQuoter` |
| `BarraCompraMovil` | CTA fijo inferior en la ficha a < 768px |
| `Galeria` | Swipe en móvil, **zoom/lightbox al tocar**, ≥ 4 fotos |
| Captura de correo | Inline (home, footer). Si hay modal, nunca antes de 30 s o del segundo scroll, con cerrar de 44px |

---

## 7. Presupuesto de rendimiento y móvil

| Métrica (móvil, 4G, p75) | Límite |
|--------------------------|--------|
| LCP | < 2.5 s |
| CLS | < 0.1 |
| INP | < 200 ms |
| JS de la ficha (gzip) | < 120 KB |
| PageSpeed móvil (home y ficha) | ≥ 80 (el checklist pide > 50; nuestro piso es más alto) |

Reglas que lo sostienen: Server Components por defecto; `next/image` con anchos fijos y
`priority` solo en el hero; fuentes con solo los pesos usados; scripts de analítica con
`afterInteractive` y un único punto de entrada; ninguna librería de carrusel (scroll-snap
en CSS). Se mide con Lighthouse CI en el smoke de staging, no a ojo.

---

## 8. Matriz: los 25 ítems y quién los garantiza

| # | Ítem | Responsable | Cómo lo garantiza la arquitectura |
|---|------|-------------|-----------------------------------|
| 01 | Se entiende qué vendes en 5 s | Contenido + `config` | El hero tiene campos separados: título de marca **y** línea de producto obligatoria ("Enterizos, sets y leggings…") |
| 02 | Categorías arriba del fold | Shell | El menú se genera desde `categoria` publicada; nunca un único "Productos" |
| 03 | Prueba social en home | `resena` + contenido | Bloque de reseñas destacadas + UGC; antes de tener reseñas, contador real de pedidos o prensa |
| 04 | WhatsApp roto o invisible | `BotonWhatsApp` | Número normalizado y testeado; mensaje precargado por contexto |
| 05 | Banner sin oferta concreta | `BarraAnuncio` + hero | Campo de oferta/novedad en `config`; revisión en el gate de lanzamiento |
| 06 | Una sola foto | `imagen.rol` + admin | El panel avisa si un producto publicado tiene < 4 fotos o le falta un rol |
| 07 | Descripción en bloque | Modelo de producto | `descripcion` corta + `detalles[]` en lista; no hay campo de texto libre largo |
| 08 | Sin tabla de talles | `guia_tallas` + `producto.medidas` | Guía genérica enlazada desde la ficha + medidas reales por producto |
| 09 | Cero reseñas | Flujo §5.4 | Pedido de reseña automático a entregado + 7 días |
| 10 | Envío no visible antes del checkout | `ShippingQuoter` | `PrecioYEnvio` en la ficha con la misma función que el checkout |
| 11 | Obliga a crear cuenta | Checkout | Solo invitada; no existe ruta que exija sesión para comprar |
| 12 | Demasiados pasos | Checkout | Una página, tres bloques, indicador de progreso |
| 13 | Sin carrito abandonado | `carrito` en servidor + `jobs` | Flujo §5.3: 1 h, 24 h, 72 h |
| 14 | Envío sorpresa al final | `ShippingQuoter` | El carrito ya muestra envío estimado; el total final nunca dice "por calcular" |
| 15 | Un solo método de pago | `PaymentProvider` | Agregar un método es un adaptador; objetivo: transferencia + contra entrega + pasarela con tarjeta y PSE |
| 16 | Política de cambios invisible | Shell + ficha | Link en footer **y** acordeón en la ficha, mismo texto desde `copy` |
| 17 | Sin datos de empresa | `Footer` + gate | El build de producción falla si los datos legales tienen `PENDIENTE` |
| 18 | Sin "Sobre nosotros" | Contenido | `/nosotros` con historia, fotos del equipo/taller; parte del gate |
| 19 | Sin badges ni medios de pago | `Footer` + ficha | Íconos generados desde los `PaymentProvider` activos — si el método existe, el ícono aparece |
| 20 | Instagram desactualizado | Operación | Link desde `config`; se apaga desde el panel sin desplegar |
| 21 | Web pesada | §7 | Presupuesto medido en CI |
| 22 | CTA bajo el fold en móvil | `BarraCompraMovil` | Test de Playwright a 375×667: el CTA es visible sin scroll |
| 23 | Filtros y búsqueda inútiles | Catálogo + `/buscar` | Filtros en la URL con panel inferior en móvil; búsqueda con autocompletar y sin resultados vacíos ("Quizás buscabas…" + categorías) |
| 24 | Imágenes sin zoom | `Galeria` | Lightbox con pinch-zoom; foto de 1600 px disponible |
| 25 | Popups que tapan todo | Shell | No hay modal de captura en la primera visita; si se agrega, la regla está en el componente |

---

## 9. Gates de calidad

**En CI (cada PR):** typecheck, lint, `brand-lint`, unit tests del dominio (`commerce` con
cobertura alta: es donde está el dinero), test de arquitectura de dependencias, migraciones
aditivas.

**Smoke en staging (Playwright, 375 y 1440 px):** home → categoría → ficha → agregar →
checkout con transferencia → confirmación; CTA visible sin scroll en la ficha móvil; link de
WhatsApp con formato `https://wa.me/<E.164>?text=…`; `/buscar?q=<producto existente>`
devuelve resultados; Lighthouse móvil sobre home y una ficha contra §7.

**Gate de lanzamiento** (un test que corre solo con `NODE_ENV=production` e `INDEXAR=si`):
sin `PENDIENTE` en datos legales; WhatsApp, cuentas bancarias y tarifas configuradas;
todo producto publicado con ≥ 4 fotos y `alt`; `/nosotros`, `/cambios`, `/envios` y
`/legales` con contenido; correo de pedido de prueba entregado; IDs de analítica presentes.

---

## 10. Orden de construcción para una tienda nueva

1. **Plantilla + `commerce` + catálogo + admin de productos** — la marca carga producto
   mientras se construye la tienda.
2. **Ficha y catálogo** con `PrecioYEnvio`, galería con zoom, CTA fijo, WhatsApp.
3. **Carrito en servidor + checkout** con adaptadores manuales (transferencia, contra
   entrega, tabla de envío).
4. **Outbox + correos + panel de pedidos.**
5. **Confianza:** footer legal, `/nosotros`, gate de lanzamiento → se indexa.
6. **Recuperación:** carrito abandonado, reseñas verificadas.
7. **Pasarela** (tarjeta + PSE) y Conversions API. Se agrega cuando haya volumen que lo
   justifique; la arquitectura ya tiene el hueco.
