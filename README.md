# COMERZIA

**Gestión inteligente para el comercio moderno.**
**Todo tu comercio en un solo lugar.**

COMERZIA es un **ERP comercial SaaS** para administrar un negocio de comercio: punto de venta con caja, inventario con trazabilidad, compras, proveedores, cotizaciones, finanzas, marketing, facturación electrónica, usuarios con roles y reportes. Construida con Next.js 16, TypeScript, Tailwind CSS 4, shadcn/ui y Prisma (SQLite para la demo, PostgreSQL/Supabase para producción).

---

## Funcionalidades

### Sitio público (landing)
- Hero con la propuesta de valor y mockup del panel
- Secciones de producto, módulos y planes de precios
- Pie de página fijo, diseño responsive y modo oscuro automático

### Panel de gestión (16 módulos)

**Operación**
| Módulo | Descripción |
| --- | --- |
| **Resumen** | KPIs de ventas, compras del mes, CxC, CxP, valor del inventario, ingresos de 30 días, categorías, métodos de pago y últimas ventas |
| **Punto de venta (POS)** | Carrito con búsqueda, cliente, método de pago (incl. crédito), descuentos, **cupones**, IVA y cobro con folio automático. Descuenta stock, registra el movimiento y el ingreso en caja |
| **Caja** | Apertura con base inicial, movimientos automáticos de ventas en efectivo, movimientos manuales y cierre con arqueo y diferencia calculada |
| **Ventas** | Historial con búsqueda y filtro por estado, detalle de la venta y cancelación con devolución de stock |
| **Cotizaciones** | Cotizaciones con vigencia para mayoristas, conversión a venta con validación de stock y estados (borrador → enviada → aprobada → convertida) |

**Catálogo y suministro**
| Módulo | Descripción |
| --- | --- |
| **Productos** | CRUD completo: código de barras, marca, unidad, precios (mayorista incl.), costos, categorías, stock mínimo y activación |
| **Inventario** | Entradas, salidas y ajustes de stock con historial de movimientos (kardex) |
| **Compras** | Órdenes de compra por proveedor, recepción (aumenta stock y actualiza costo), anulación y registro de pagos |
| **Proveedores** | Fichas con NIT, contacto comercial, condiciones de pago y notas |

**Relaciones**
| Módulo | Descripción |
| --- | --- |
| **Clientes** | Fichas con datos de contacto, tipo (particular/empresa) y métricas de compra |
| **Marketing** | Cupones de descuento (porcentaje/monto) con mínimo de compra, vencimiento, activación y contador de usos |

**Finanzas**
| Módulo | Descripción |
| --- | --- |
| **Finanzas** | KPIs de CxC y CxP, ingresos/egresos manuales, abonos de clientes a ventas a crédito y registro de pagos a proveedores |
| **Facturación electrónica** | Emisión simulada con CUFE (SHA-384), estado DIAN y descarga del XML (estructura UBL 2.1 de referencia) |

**Gestión**
| Módulo | Descripción |
| --- | --- |
| **Reportes** | Periodos de 7 / 30 días / histórico, evolución de ingresos, top de productos, categorías, IVA y exportación CSV |
| **Usuarios** | RBAC con 9 roles (OWNER, ADMIN, CAJERO, VENDEDOR, INVENTARIO, COMPRAS, CONTADOR, LOGISTICA, AUDITOR); el OWNER no puede autoasignarse |
| **Ajustes** | Nombre y NIT del comercio, dirección, moneda (COP/MXN/USD/EUR), porcentaje de IVA y alertas de stock |

## Stack técnico

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Estilos:** Tailwind CSS 4 + shadcn/ui (New York) + Lucide Icons
- **Base de datos:** SQLite vía Prisma ORM (`db/custom.db`) — demo local
- **Producción SaaS:** PostgreSQL/Supabase con esquema multi-tenant y RLS (carpeta `supabase/`)
- **Gráficos:** Recharts
- **Notificaciones:** Sonner
- **Tema:** next-themes (claro / oscuro)

## Estructura del proyecto

```
├── prisma/schema.prisma        # 16 modelos: Products, Sales, Suppliers, Purchases, Cash, Quotations, Coupons, Finance, Users…
├── db/custom.db                # Base de datos SQLite (incluye datos de demostración)
├── supabase/                   # SQL para producción SaaS (esquema + RLS + seed de planes)
├── scripts/seed.ts             # Semilla de datos demo (24 productos, 12 clientes, ~140 ventas)
├── public/comerzia-logo.svg    # Logotipo de la marca
└── src/
    ├── app/
    │   ├── page.tsx            # Vista raíz (landing ↔ panel)
    │   ├── layout.tsx          # Metadatos, tema y fuentes
    │   └── api/                # API REST
    │       ├── products/       # GET, POST, PATCH, DELETE
    │       ├── customers/      # GET, POST, PATCH, DELETE
    │       ├── sales/          # GET, POST, PATCH, DELETE (transacciones + cupón + caja)
    │       ├── movements/      # GET, POST (entradas/salidas/ajustes)
    │       ├── suppliers/      # CRUD de proveedores
    │       ├── purchases/      # Órdenes de compra + recibir / anular / pagar
    │       ├── cash/           # Caja: open / close / movement
    │       ├── quotations/     # Cotizaciones + conversión a venta
    │       ├── coupons/        # Cupones + validación en servidor
    │       ├── finance/        # Transacciones, CxC, CxP y abonos
    │       ├── users/          # Usuarios y roles (RBAC)
    │       ├── einvoice/       # Emisión electrónica (CUFE) + descarga XML
    │       ├── metrics/        # GET (KPIs y series del panel)
    │       └── settings/       # GET, PUT (configuración del comercio)
    ├── components/comerzia/
    │   ├── landing.tsx         # Sitio público con planes y precios
    │   ├── dashboard.tsx       # Casco del panel (sidebar agrupado) + contexto
    │   └── modules/            # 16 módulos: overview, pos, cash, sales, quotations, products, inventory, purchases, suppliers, customers, marketing, finance, einvoice, reports, users, settings
    └── lib/
        ├── db.ts               # Cliente Prisma
        └── format.ts           # Formato de moneda y fechas (es-CO)
```

## Puesta en marcha

Requisitos: **Node.js 20+** (recomendado) o **Bun 1.1+**. El proyecto es 100 % compatible con ambos gestores — usa el que prefieras, los comandos son equivalentes.

### Opción A — con npm (Node.js clásico)

```bash
# 1. Instalar dependencias (genera package-lock.json)
npm install

# 2. Crear el esquema en la base de datos (.env ya incluido)
npm run db:push

# 3. (Opcional) Regenerar los datos de demostración
npm run db:seed

# 4. Arrancar en desarrollo → http://localhost:3000
npm run dev
```

### Opción B — con Bun

```bash
# 1. Instalar dependencias (genera bun.lock)
bun install

# 2. Crear el esquema
bun run db:push

# 3. (Opcional) Regenerar los datos de demostración
bun run db:seed

# 4. Arrancar en desarrollo → http://localhost:3000
bun run dev
```

### Notas sobre Bun y npm

- **Lockfiles:** npm genera `package-lock.json` y Bun genera `bun.lock`; son archivos distintos y no se necesitan a la vez. El proyecto no incluye ninguno: el primer gestor que uses creará el suyo. En equipo, conviene estandarizar un solo gestor.
- **El código no usa APIs exclusivas de Bun** (todo es Node.js estándar + Next.js), por eso ambos gestores funcionan sin cambios.
- **Producción:** `npm run build` y `npm run start` (o sus equivalentes con Bun) compilan y sirven la app con el output standalone de Next.js mediante Node.
- **Windows / macOS / Linux:** todos los scripts son multiplataforma (Node.js puro, sin comandos Unix) y funcionan en PowerShell sin cambios ni WSL.

La base de datos incluida ya viene sembrada con datos de demostración: 24 productos en 5 categorías (con código de barras, marca y precios mayoristas), 12 clientes, 6 proveedores, 10 órdenes de compra, 5 cotizaciones, 4 cupones, 10 usuarios con roles, 141 ventas de los últimos 45 días (incluye ventas a crédito), una sesión de caja cerrada con arqueo y transacciones financieras. El paso 2 solo es necesario si la borras; el paso 3 la regenera con datos frescos.

## Reglas de negocio implementadas

- Al registrar una venta **completada** se descuenta el stock, se crea un movimiento de salida y, si el pago es en efectivo con caja abierta, un ingreso de caja automático.
- No se permite vender más unidades que el stock disponible (validación en cliente y servidor).
- Los **cupones** se validan en el servidor (activo, vigencia y mínimo de compra) y su descuento se recalcula autoritativamente; el uso se contabiliza.
- Al **recibir una compra** se incrementa el stock, se registra la entrada y se actualiza el costo de adquisición del producto.
- Las compras recibidas sin pagar alimentan las **cuentas por pagar**; el pago crea el egreso en Finanzas.
- Las ventas a crédito alimentan las **cuentas por cobrar**; los abonos se registran como ingresos referenciados a la venta.
- Al **cancelar** una venta completada se devuelve el stock y se registra el movimiento de reversión.
- La **conversión de cotización** a venta valida stock, crea la venta con sus líneas y marca la cotización como convertida.
- El IVA se calcula con el porcentaje configurado en Ajustes sobre el subtotal menos descuentos y cupón.
- Los folios son incrementales por tipo: `F-<año>`, `C-<año>` (compras) y `COT-<año>`.
- El rol **OWNER** no puede crearse ni eliminarse desde el panel (protección en API).
- La emisión electrónica genera un **CUFE SHA-384** y XML UBL 2.1 de referencia; la validación real ante la DIAN requiere un proveedor tecnológico autorizado.

## Migración a producción con Supabase

La carpeta [`supabase/`](supabase/README.md) contiene los scripts SQL para montar el modelo **SaaS multi-tenant** en PostgreSQL con Row Level Security:

```text
supabase/01_schema.sql   → ~45 tablas con organization_id (multi-tenant)
supabase/02_rls.sql      → RLS, roles y protección del rol OWNER
supabase/03_seed.sql     → Planes Básico $89.900 / Profesional $149.900 / Premium $229.900 + organización demo
```

Ejecútalos en orden desde el SQL Editor de Supabase; los detalles de conexión
(`@supabase/supabase-js`), creación de usuarios y consulta de límites del plan
están en `supabase/README.md`.

## Solución de problemas

- **Puerto 3000 ocupado:** arranca en otro puerto con `npm run dev -- -p 3001`.
- **La app se ve sin datos:** comprueba que `.env` contiene `DATABASE_URL=file:../db/custom.db` y ejecuta `npm run db:push`. Si existe una carpeta `prisma/db` con una base de datos vacía (de una instalación antigua), bórrala: la base de datos real vive en `db/custom.db`.
- **Error `"tee" no se reconoce` o `"cp" no se reconoce` en Windows:** usa la versión actualizada del proyecto; los scripts ya no dependen de comandos Unix.
- **Producción en local:** `npm run build` y después `npm run start` (puerto configurable con la variable de entorno `PORT`).
