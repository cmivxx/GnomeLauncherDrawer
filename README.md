# Launcher Drawer

> A slick, configurable app-launcher drawer for the GNOME taskbar.

Click the panel icon — or tap a hotkey — and a smooth, animated grid of your favourite apps slides into view. Everything from drawer size and animation speed to icon appearance and keyboard shortcuts is tweakable from the Preferences UI.

---

## Features

- **Panel button** — sits in any area of the taskbar (left, center, right); icon is fully customisable
- **Animated drawer** — slides open toward the screen centre with a configurable easing effect; set duration to `0` to disable animation entirely
- **Scrollable icon grid** — automatically reflows icons to fit the drawer width; optionally show or hide app name labels
- **App manager** — add any installed app via a searchable picker, then drag-reorder or remove with one click
- **Global hotkey** — toggle the drawer from anywhere on the desktop
- **Live settings** — all changes in Preferences take effect immediately; no shell restart required
- **Dash to Panel compatible** — works alongside the popular taskbar extension

---

## Requirements

| Requirement | Version |
|---|---|
| GNOME Shell | 45 – 49 |
| Ubuntu | 24.04+ (tested on 25.10) |

---

## Installation

### From source

```bash
# 1. Clone
git clone git@github.com:cmivxx/GnomeLauncherDrawer.git ~/Projects/GnomeLauncherDrawer

# 2. Symlink into the extensions directory
ln -s ~/Projects/GnomeLauncherDrawer \
  ~/.local/share/gnome-shell/extensions/launcher-drawer@cmivxx

# 3. Compile the GSettings schema
glib-compile-schemas \
  ~/.local/share/gnome-shell/extensions/launcher-drawer@cmivxx/schemas/

# 4. Log out and back in, then enable
gnome-extensions enable launcher-drawer@cmivxx
```

### Quick dev loop

Because the extension directory is a symlink to the repo, editing files in `~/Projects/GnomeLauncherDrawer/` is immediately reflected. To reload after a JS change:

```bash
gnome-extensions disable launcher-drawer@cmivxx
gnome-extensions enable  launcher-drawer@cmivxx
```

---

## Configuration

Open **Settings → Extensions → Launcher Drawer → Preferences**, or:

```bash
gnome-extensions prefs launcher-drawer@cmivxx
```

### All options

| Setting | Key | Default | Range / Values | Description |
|---|---|---|---|---|
| Panel icon | `drawer-icon-name` | `view-grid-symbolic` | Any themed icon name | Icon shown in the taskbar button |
| Panel position | `panel-box` | `right` | `left` · `center` · `right` | Which taskbar area to place the button |
| Toggle hotkey | `hotkey` | `<Super>F1` | Any GTK accelerator string | Global keyboard shortcut to open/close the drawer |
| App list | `apps` | *(empty)* | Array of `.desktop` IDs | Ordered list of apps shown in the drawer |
| Drawer width | `drawer-width` | `320` px | 120 – 1200 | Width of the open drawer |
| Drawer height | `drawer-height` | `400` px | 80 – 1200 | Height of the open drawer (scrollable beyond this) |
| Icon size | `icon-size` | `48` px | 16 – 128 | App icon size inside the drawer |
| Show labels | `show-labels` | `true` | `true` / `false` | Display app names below icons |
| Animation duration | `animation-duration` | `280` ms | 0 – 2000 | Open/close animation duration; `0` disables animation |

### Hotkey format

Hotkeys use GTK accelerator syntax. Examples:

```
<Super>F1
<Ctrl><Alt>l
<Shift>F12
```

---

## Project structure

```
GnomeLauncherDrawer/
├── extension.js       # Main extension: panel button, drawer, hotkey binding
├── prefs.js           # Preferences UI (libadwaita)
├── stylesheet.css     # Dark-glass drawer styling
├── metadata.json      # Extension identity and GNOME Shell version targets
└── schemas/
    └── org.gnome.shell.extensions.launcher-drawer.gschema.xml
```

---

## License

[MIT](LICENSE)
