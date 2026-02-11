📘 SPEC + PROMPT MAESTRO PARA CODEX
Remote Deck & Automation Tool (Windows + Mobile Web)

Versión: 0.1 – “Clean MVP”
Objetivo del documento: describir la visión de producto + arquitectura técnica + contratos para que Codex genere código sin duplicidades, con módulos claros y sin parches solapados.

0) Principios para evitar código sucio (Reglas obligatorias)

Single Source of Truth (SSOT):

El layout y la configuración viven en un único estado en la app de PC (workspace store).

Móvil no guarda configuración persistente; solo renderiza lo que recibe.

Separación estricta:

Modelo/Datos (shared/) → schemas, tipos, validación, migraciones.

Editor UI (desktop/ui/) → solo interfaz y acciones de usuario.

Runtime (desktop/runtime/) → servidor + dispatcher.

Drivers (desktop/drivers/) → teclado, MIDI, etc. Sin UI.

No duplicar lógica de render:

La “vista móvil” del PC (Sección 3 izquierda) y el móvil real deben usar el mismo renderer (ideal: componente compartido en shared/ui o paquete reutilizable).

Cambios incrementales sin solapar:

Cada feature se añade con:

schema update

UI update

runtime update

Nunca se deja “código viejo comentado”; se elimina.

Validación centralizada:

Toda config se valida contra zod (o equivalente) en shared/schema.

El editor no guarda si no valida.

1) Arquitectura general
1.1 Componentes

Desktop App (Windows): Electron + Node

Editor (3 secciones)

Servidor local (HTTP + WebSocket)

Dispatcher de acciones

Drivers (Keyboard/MIDI)

Gestión de assets (iconos/fondos)

Mobile Web App (PWA ligera)

Render de layout

Header (perfil/página)

Input (botones/faders)

Feedback visual local + estado recibido del PC

1.2 Comunicación

PC levanta servidor local:

HTTP: servir la web del móvil + endpoint de estado inicial

WebSocket: eventos (móvil→PC) y state updates (PC→móvil)

2) Modelo de Datos (schemas obligatorios)
2.1 Workspace
Workspace {
  version: number,
  profiles: Profile[],
  assets: AssetsIndex,
  lastSession: {
    activeProfileId?: string,
    activePageId?: string
  }
}

2.2 Assets (iconos y fondos)

Objetivo: permitir PNG para iconos y fondos custom.

AssetsIndex {
  icons: Record<assetId, AssetRef>,
  backgrounds: Record<assetId, AssetRef>
}

AssetRef {
  id: string,
  kind: "icon" | "background",
  filename: string,
  mime: "image/png" | "image/jpeg",
  storage: {
    type: "file",
    relativePath: string // e.g. "assets/icons/kick.png"
  }
}


Regla: el editor copia los archivos importados a una carpeta local del proyecto (no referencias externas).

2.3 Profiles y Pages
Profile {
  id: string,
  name: string,
  iconAssetId?: string,
  pages: Page[]
}

Page {
  id: string,
  name: string,
  background: PageBackground,
  grid: { rows: number, cols: number },
  style: PageStyle,
  controls: Control[],
  folders: Folder[]
}

Background (fondo)
PageBackground =
  | { type: "solid", value: string }            // "#101010"
  | { type: "image", assetId: string, fit: "cover" | "contain" | "stretch" }

2.4 Controls (elementos colocables en rejilla)
Control {
  id: string,
  type: "button" | "fader" | "toggle" | "folderButton",
  name: string,
  iconAssetId?: string,
  layout: { row: number, col: number, rowSpan: number, colSpan: number },
  styleOverride?: ControlStyleOverride,
  actionBinding: ActionBinding // (ver acciones)
}


Reglas de tamaño:

Button/Toggle/FolderButton: rowSpan y colSpan editables.

Fader: colSpan fijo = 1; rowSpan editable.

2.5 Folders (navegables en móvil)

Concepto definitivo: una “carpeta” abre una vista tipo lista en el móvil.
No se diseña en rejilla.

Folder {
  id: string,
  name: string,
  iconAssetId?: string,
  allowedItemTypes: ("launcher" | "hotkey" | "macro" | "textEnter")[],
  items: FolderItem[] // ordenados
}

FolderItem {
  id: string,
  name: string,
  iconAssetId?: string,
  type: "launcher" | "hotkey" | "macro" | "textEnter",
  action: Action // acción concreta
}


Nota: Para abrir una carpeta desde el grid se usa un Control.type = "folderButton" con acción interna openFolder(folderId).

3) Acciones (Action system definitivo)
3.1 Binding

Cada control tiene un binding principal:

Button/Toggle: puede ser single o macro

Fader: normalmente midi_cc

FolderButton: openFolder

ActionBinding =
  | { kind: "single", action: Action }
  | { kind: "macro", steps: ActionStep[] }

3.2 Acciones base
Internas

switchPage

switchProfile

openFolder

Sistema

openApp

openFile

openUrl

Teclado

hotkey

typeText

keyPress

MIDI

midi_cc

midi_note

Macro steps

delay(ms)

cualquiera de las anteriores como step

4) UI Desktop (3 secciones)
Sección 1 — Navegación (Structure)

Izquierda: árbol Profile → Page → Folder

Añadir / renombrar / borrar / reordenar

Derecha (Inspector):

Nombre (input)

Icono (import PNG → assetId)

Tipo (solo aplica a “FolderItem” o “Control”; para Profile/Page/Folder es fijo)

Para Folder: allowedItemTypes + lista editable de items (orden)

Sección 2 — Rejilla (Grid Editor)

Izquierda:

Selector: perfil + página

Lista de controls disponibles en esa página (icon + name + type)

Derecha: Canvas

Editar grid: rows/cols

Editar fondo:

solid color presets

importar imagen → asignar background.image

Editar estilo global (PageStyle):

botón: borde sí/no, mostrar label, color fondo default

fader: skin preset (por defecto)

Colocar controles:

seleccionas control en lista → aparecen “+” en celdas válidas → click → se coloca

Seleccionar control en canvas → panel de propiedades:

tamaño (spans)

override estilo (opcional)

eliminar del canvas

Sección 3 — Acciones (Behavior)

Izquierda: preview clicable de la página (mismo renderer que móvil)

click control → selecciona

Derecha: Action Editor

Muestra acciones permitidas según tipo:

Button/Toggle: hotkey, macro, open*, text+enter, switchPage, switchProfile

Fader: midi_cc

FolderButton: openFolder

Editor específico por acción

Para macro: lista de steps (add/reorder/remove)

5) UI Mobile (Web App)
5.1 Header fijo

Dropdown Perfil

Dropdown Página (opcional override)

Botón “Back” solo cuando estés dentro de un Folder

(Opcional) botón “Lock”

5.2 Render de Page

Render grid según rows/cols

Render controls con icono, label (según style)

Feedback local:

botón: pressed animación

toggle: estado visual ON/OFF

fader: mueve knob con el dedo

5.3 Folder View

Lista vertical de items (icon + name)

Tap item → envía acción al PC

Back → vuelve a la página anterior

6) Comunicación (contrato de mensajes)
6.1 Estado inicial (HTTP)

GET /api/state → devuelve:

activeProfileId, activePageId

layout completo (page + folders metadata necesaria)

style y background

assets URLs (servidos por el PC)

6.2 WebSocket (eventos)

Móvil → PC

buttonPress(controlId)

toggleChange(controlId, value: boolean) (si decides que el toggle se gestione)

faderChange(controlId, value01)

selectProfile(profileId)

selectPage(pageId)

openFolder(folderId)

folderItemPress(folderItemId)

PC → Móvil

stateUpdate(...) cuando cambie perfil/página/layout/estilo

ack(controlId, visualState) opcional

7) Integración FL Studio (MVP)
Objetivo

Que un fader del móvil controle un parámetro en FL en tiempo real.

Método

PC envía midi_cc a un puerto MIDI virtual.

FL Studio recibe ese puerto.

Usuario hace “Link controller” al parámetro.

Usuario activa grabación de automatización si quiere escribirla.

No se implementa feedback DAW→móvil en v0.1.

8) Drivers Windows (MVP)

KeyboardDriver: AutoHotkey v2 (ejecutar hotkeys y macros)

MidiDriver: salida MIDI (puerto virtual recomendado)

Server: Node WebSocket + Express (o equivalente)

9) Repo GitHub (estructura)
/desktop
  /main        (electron main process)
  /renderer    (ui)
  /runtime     (server + dispatcher)
  /drivers     (keyboard/midi)
/mobile
  /src         (web app)
/shared
  /schema      (zod types)
  /protocol    (ws message types)
/docs
  spec.md

10) Plan de implementación sin solapamientos (pasos “limpios”)

shared/schema + workspace.json (load/save + validation)

Desktop app skeleton con 3 tabs vacíos

Sección 1: crear Profile/Page/Folder + inspector (name/icon)

Sección 2: grid editor + background (solid/image) + canvas placement

Server: HTTP state + servir /mobile

Mobile web: conectar, render page, botones “dummy”

WS eventos: buttonPress → log

KeyboardDriver: hotkey simple

MidiDriver: midi_cc desde fader

Folder view en móvil + FolderItems

Acción editor (Sección 3) + bindings

Lo que este documento ya cubre (para tus dudas)

✅ Cambio de fondo (color/imagen) con modelo PageBackground
✅ Importar PNG para iconos y fondos via AssetsIndex
✅ Carpetas definidas como “subvista” en móvil (lista), sin rejilla
✅ Actions claras y sin duplicidades
✅ Comunicación PC→móvil basada en JSON + assets servidos por el PC
✅ Reglas anti-ensuciar código (SSOT + separación + validación)
