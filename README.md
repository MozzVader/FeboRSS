# ☀️ Febo RSS

Un lector de feeds RSS moderno, rápido y bonito.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss)

## Características

- **Agregar feeds** RSS y Atom con un click (incluye ejemplos pre-cargados)
- **Lector integrado** con contenido HTML completo
- **Búsqueda** en tiempo real por título, autor y contenido
- **Filtros**: Todos, No leídos, Favoritos
- **Sistema de favoritos** (estrellar artículos)
- **Dark mode** con toggle
- **Responsive**: se adapta a móvil con sidebar deslizable
- **Infinite scroll** para cargar más artículos
- **Contadores de no leídos** por feed
- **Actualización manual** de feeds (individual o todos)

## Stack

| Tecnología | Uso |
|---|---|
| [Next.js 16](https://nextjs.org/) | Framework fullstack |
| [TypeScript](https://www.typescriptlang.org/) | Tipado estático |
| [Tailwind CSS 4](https://tailwindcss.com/) | Estilos |
| [shadcn/ui](https://ui.shadcn.com/) | Componentes UI |
| [Zustand](https://zustand.docs.pmnd.rs/) | Estado global |
| [Prisma](https://www.prisma.io/) | ORM |
| [SQLite](https://www.sqlite.org/) | Base de datos local |
| [rss-parser](https://github.com/rbren/rss-parser) | Parseo de feeds |

## Setup local

### Requisitos

- Node.js 18+ (o Bun)
- npm, yarn o bun

### Instalación

```bash
# Clonar el repo
git clone https://github.com/MozzVader/FeboRSS.git
cd FeboRSS

# Instalar dependencias
npm install

# Crear la base de datos
npx prisma db push

# Arrancar en modo desarrollo
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000) en tu navegador.

### Comandos útiles

```bash
npm run dev        # Servidor de desarrollo
npm run build      # Build de producción
npm run lint       # Linting
npx prisma studio  # Visor visual de la DB
```

## Estructura del proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── feeds/          # CRUD de feeds + refresh
│   │   └── articles/       # Listado, update, marcar leídos
│   ├── globals.css         # Estilos globales + prose
│   ├── layout.tsx          # Layout con dark mode
│   └── page.tsx            # Página principal
├── components/
│   ├── feed-reader/
│   │   ├── app.tsx         # Componente principal (3 paneles)
│   │   ├── feed-sidebar.tsx
│   │   ├── article-list.tsx
│   │   └── article-reader.tsx
│   └── ui/                 # Componentes shadcn/ui
├── store/
│   └── app.ts              # Estado global (Zustand)
└── lib/
    ├── db.ts               # Cliente Prisma
    └── rss.ts              # Parser de RSS/Atom
prisma/
└── schema.prisma           # Modelo Feed + Article
```

## Licencia

MIT