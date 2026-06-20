<div align="center">

<img src="public/logo.png" alt="FeboRSS" width="80" height="80" />

# FeboRSS

**Un lector de RSS moderno, limpio y veloz.**

Lectura de feeds sin distracciones, con todo lo que necesitás y nada que sobre.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2d3748?logo=prisma)](https://www.prisma.io/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003b57?logo=sqlite)](https://sqlite.org/)
[![License](https://img.shields.io/badge/License-CC_BY--NC_4.0-ef9421?logo=creativecommons)](#license)

</div>

---

## ✨ Funcionalidades

### 📰 Lectura de feeds
- **Agregá feeds RSS/Atom** desde cualquier URL
- **Vista de cards** estilo Feedly con thumbnail, título, resumen y metadata
- **Modal de lectura** con contenido completo, HTML enrichido e imagen hero
- **Scroll infinito** con carga progresiva de artículos
- **Limpieza automática** de artículos leídos mayores a 30 días (excepto favoritos)
- **Tiempo estimado de lectura** en cada card (~200 palabras/min)

### ⭐ Organización
- **Categorías** para agrupar feeds (carpetas colapsables)
- **Drag & drop** para reordenar feeds y moverlos entre categorías
- **Filtros**: Todos, No leídos, Favoritos
- **Contador de no leídos** por feed y total
- **Menú contextual** (click derecho) en cada feed con acciones rápidas

### 🔔 Estado de feeds
- **Detección de feeds caídos**: ícono rojo de advertencia cuando un feed falla al refrescar
- **Auto-refresh** cada 60 minutos
- **Backpatch inteligente**: se actualizan artículos existentes con datos faltantes (contenido HTML, imágenes)

### 🎨 Interfaz
- **Tema claro/oscuro** con persistencia
- **Diseño responsivo** — mobile-first con sidebar deslizable
- **Toast notifications** para feedback de acciones (leído, favorito, errores)
- **Diálogo de confirmación** al eliminar un feed

### 📤 Importar / Exportar
- **OPML completo**: importá y exportá tus suscripciones compatible con cualquier lector RSS
- **Importación inteligente**: detecta feeds duplicados y los saltea

### ⌨️ Atajos de teclado

| Atajo | Acción |
|---|---|
| `j` / `↓` | Artículo siguiente |
| `k` / `↑` | Artículo anterior |
| `o` / `Enter` | Abrir artículo |
| `Escape` | Cerrar modal / salir de búsqueda |
| `s` | Toggle favorito |
| `m` | Toggle leído/no leído |
| `Shift + m` | Marcar todos como leídos (feed actual) |
| `r` | Refrescar todos los feeds |
| `a` | Filtro: Todos |
| `u` | Filtro: No leídos |
| `f` | Filtro: Favoritos |
| `/` | Foco en búsqueda |
| `t` | Cambiar tema claro/oscuro |
| `?` | Ver atajos de teclado |

### 🔧 Técnico
- **Reddit-ready**: manejo especial de imágenes y contenido de subreddits
- **Todos los links externos** se abren en nueva pestaña
- **State management** con Zustand (sin hydration issues)
- **UI components** con shadcn/ui + Radix UI

---

## 🚀 Setup

### Requisitos previos
- [Node.js](https://nodejs.org/) 18+
- npm, bun o yarn

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/MozzVader/FeboRSS.git
cd FeboRSS

# Instalar dependencias
npm install

# Configurar base de datos
cp .env.example .env
```

### Variables de entorno

En `.env`:

```env
DATABASE_URL="file:./db/custom.db"
```

FeboRSS usa SQLite — no necesitás instalar ningún servidor de base de datos.

### Inicializar la DB

```bash
# Generar cliente de Prisma
npx prisma generate

# Aplicar schema a la DB (sin perder datos)
npx prisma db push
```

### Levantar el servidor

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000) y empezá a agregar feeds.

### Scripts disponibles

```bash
npm run dev          # Servidor de desarrollo (puerto 3000)
npm run build        # Build de producción
npm run start        # Servidor de producción
npm run lint         # Linter
npm run db:push      # Aplicar cambios al schema de DB
npm run db:generate  # Regenerar cliente Prisma
npm run db:migrate   # Crear nueva migración
```

---

## 🏗️ Stack

| Capa | Tecnología |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, Turbopack) |
| UI | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Estilos | [Tailwind CSS 4](https://tailwindcss.com/) |
| Componentes | [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) |
| Estado | [Zustand](https://zustand.docs.pmnd.rs/) |
| Base de datos | [SQLite](https://sqlite.org/) via [Prisma 6](https://www.prisma.io/) |
| Iconos | [Lucide React](https://lucide.dev/) |
| RSS | [rss-parser](https://github.com/rbren/rss-parser) |
| Temas | [next-themes](https://github.com/pacocoursey/next-themes) |
| Drag & Drop | [dnd-kit](https://dndkit.com/) |

---

## 📁 Estructura

```
src/
├── app/                    # API Routes (Next.js App Router)
│   ├── api/
│   │   ├── articles/       # CRUD artículos, marcar leídos, cleanup
│   │   ├── categories/     # CRUD categorías
│   │   ├── feeds/          # CRUD feeds, refresh, move, refresh-all
│   │   └── opml/           # Import/export OPML
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── feed-reader/        # Componentes principales
│   │   ├── app.tsx                # Layout principal + header + atajos
│   │   ├── article-cards.tsx      # Grid de cards con scroll infinito
│   │   ├── article-reader-modal.tsx  # Modal de lectura
│   │   └── feed-sidebar.tsx       # Sidebar con feeds, categorías, DnD
│   └── ui/                 # Componentes shadcn/ui
├── hooks/
│   └── use-toast.ts        # Hook de notificaciones toast
├── lib/
│   ├── db.ts               # Instancia de Prisma Client
│   ├── rss.ts              # Parser de RSS con soporte especial para Reddit
│   └── utils.ts            # Utilidades (cn, etc.)
└── store/
    └── app.ts              # Zustand store (feeds, artículos, filtros, estado)
```

---

## 📄 Licencia

Este proyecto está bajo la licencia **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**.

Esto significa que podés:
- ✅ **Compartir** — copiar y redistribuir el material en cualquier medio o formato
- ✅ **Adaptar** — remezclar, transformar y construir sobre el material

Con las siguientes condiciones:
- 📝 **Atribución** — tenés que dar crédito apropiado, proporcionar un link a la licencia e indicar si se hicieron cambios
- 🚫 **No comercial** — no podés usar el material para fines comerciales

Ver el texto completo en [LICENSE](LICENSE).

---

<div align="center">

Hecho con ❤️ por [MozzVader](https://github.com/MozzVader)

</div>
