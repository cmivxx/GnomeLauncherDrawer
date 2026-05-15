import St from 'gi://St';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// ---------------------------------------------------------------------------
// Panel button + drawer
// ---------------------------------------------------------------------------

const LauncherButton = GObject.registerClass(
class LauncherButton extends PanelMenu.Button {

    _init(settings) {
        // dontCreateMenu = true → we manage our own popup
        super._init(0.5, 'Gnome Launcher Drawer', true);

        this._settings = settings;
        this._drawer   = null;
        this._isOpen   = false;
        this._clickId  = null;
        this._settIds  = [];

        this._icon = new St.Icon({
            icon_name:   settings.get_string('drawer-icon-name'),
            style_class: 'system-status-icon',
        });
        this.add_child(this._icon);

        this._connectSettings();

        this.connect('button-press-event', (_actor, event) => {
            if (event.get_button() === 1) {
                this.toggleDrawer();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    // ── Settings wiring ────────────────────────────────────────────────────

    _connectSettings() {
        const s = this._settings;

        const icon = s.connect('changed::drawer-icon-name', () => {
            this._icon.icon_name = s.get_string('drawer-icon-name');
        });

        // Anything that affects drawer contents/size → rebuild
        const rebuild = ['apps', 'icon-size', 'show-labels',
                         'drawer-width', 'drawer-height'].map(key =>
            s.connect(`changed::${key}`, () => this._rebuildDrawer())
        );

        this._settIds = [icon, ...rebuild];
    }

    _rebuildDrawer() {
        const wasOpen = this._isOpen;
        this._destroyDrawer();
        if (wasOpen)
            this.openDrawer();
    }

    // ── Toggle / open / close ──────────────────────────────────────────────

    toggleDrawer() {
        this._isOpen ? this.closeDrawer() : this.openDrawer();
    }

    openDrawer() {
        if (this._isOpen) return;

        if (!this._drawer)
            this._buildDrawer();

        this._isOpen = true;
        this._positionDrawer();

        const duration = this._settings.get_int('animation-duration');
        this._drawer.show();
        this._drawer.ease({
            opacity: 255,
            scale_y: 1.0,
            duration,
            mode: Clutter.AnimationMode.EASE_OUT_BACK,
        });

        // Dismiss when clicking outside
        this._clickId = global.stage.connect('button-press-event', (_s, ev) => {
            const [ex, ey] = ev.get_coords();
            if (!this._hitTest(this._drawer, ex, ey) &&
                !this._hitTest(this, ex, ey))
                this.closeDrawer();
            return Clutter.EVENT_PROPAGATE;
        });
    }

    closeDrawer() {
        if (!this._isOpen) return;
        this._isOpen = false;

        if (this._clickId !== null) {
            global.stage.disconnect(this._clickId);
            this._clickId = null;
        }

        const duration = Math.round(this._settings.get_int('animation-duration') * 0.65);
        this._drawer.ease({
            opacity: 0,
            scale_y: 0.0,
            duration,
            mode: Clutter.AnimationMode.EASE_IN_QUART,
            onComplete: () => this._drawer?.hide(),
        });
    }

    // ── Drawer construction ────────────────────────────────────────────────

    _buildDrawer() {
        const s            = this._settings;
        const drawerWidth  = s.get_int('drawer-width');
        const drawerHeight = s.get_int('drawer-height');
        const iconSize     = s.get_int('icon-size');
        const showLabels   = s.get_boolean('show-labels');
        const appIds       = s.get_strv('apps');

        this._drawer = new St.BoxLayout({
            style_class: 'launcher-drawer',
            vertical:    true,
            reactive:    true,
            opacity:     0,
        });

        // Must be in the stage before any layout calls (set_size, etc.)
        Main.layoutManager.addChrome(this._drawer, {
            affectsInputRegion: true,
            affectsStruts:      false,
            trackFullscreen:    true,
        });

        // Start collapsed; pivot is adjusted in _positionDrawer()
        this._drawer.set_pivot_point(0.5, 1.0);
        this._drawer.scale_y = 0.0;
        this._drawer.hide();

        // Scrollable icon grid — set_size() is safe now that drawer is in stage
        const scroll = new St.ScrollView({
            style_class:          'launcher-drawer-scroll',
            hscrollbar_policy:    St.PolicyType.NEVER,
            vscrollbar_policy:    St.PolicyType.AUTOMATIC,
            overlay_scrollbars:   true,
        });
        scroll.set_size(drawerWidth, drawerHeight);

        // St.Viewport (not St.Widget) — implements StScrollable so it can
        // live inside St.ScrollView, and accepts a custom layout_manager.
        const grid = new St.Viewport({
            style_class:    'launcher-drawer-grid',
            layout_manager: new Clutter.FlowLayout({
                orientation:    Clutter.Orientation.HORIZONTAL,
                homogeneous:    true,
                column_spacing: 6,
                row_spacing:    6,
            }),
            x_expand: true,
        });

        for (const id of appIds) {
            const info = Gio.DesktopAppInfo.new(id);
            if (!info) continue;
            grid.add_child(this._makeAppButton(info, iconSize, showLabels));
        }

        scroll.set_child(grid);
        this._drawer.add_child(scroll);
    }

    _makeAppButton(info, iconSize, showLabels) {
        const btn = new St.Button({
            style_class: 'launcher-drawer-app-btn',
            reactive:    true,
            track_hover: true,
            can_focus:   true,
        });

        const box = new St.BoxLayout({
            vertical:    true,
            style_class: 'launcher-drawer-app-content',
            x_align:     Clutter.ActorAlign.CENTER,
        });

        const gicon = info.get_icon() ??
            new Gio.ThemedIcon({name: 'application-x-executable'});

        box.add_child(new St.Icon({
            gicon,
            icon_size:   iconSize,
            style_class: 'launcher-drawer-app-icon',
        }));

        if (showLabels) {
            const lbl = new St.Label({
                text:        info.get_display_name(),
                style_class: 'launcher-drawer-app-label',
                x_align:     Clutter.ActorAlign.CENTER,
            });
            lbl.clutter_text.ellipsize      = Pango.EllipsizeMode.END;
            lbl.clutter_text.line_wrap      = false;
            lbl.clutter_text.natural_width  = iconSize + 16;
            box.add_child(lbl);
        }

        btn.set_child(box);

        btn.connect('clicked', () => {
            try {
                info.launch([], null);
            } catch (e) {
                console.error(`Gnome Launcher Drawer: could not launch ${info.get_id()}: ${e.message}`);
            }
            this.closeDrawer();
        });

        return btn;
    }

    // ── Layout helpers ─────────────────────────────────────────────────────

    _positionDrawer() {
        if (!this._drawer) return;

        const monitor     = Main.layoutManager.primaryMonitor;
        const drawerWidth = this._settings.get_int('drawer-width');
        const confH       = this._settings.get_int('drawer-height');

        const [bx, by] = this.get_transformed_position();
        const bw        = this.get_width();
        const bh        = this.get_height();

        // Clamp drawer horizontally
        let x = Math.round(bx + bw / 2 - drawerWidth / 2);
        x = Math.max(monitor.x + 8,
            Math.min(x, monitor.x + monitor.width - drawerWidth - 8));

        // Open towards screen centre (above or below the panel)
        const panelY = Main.panel.get_transformed_position()[1];
        const atTop  = panelY < monitor.height / 2;

        let y, pivotY;
        if (atTop) {
            y      = by + bh + 4;
            pivotY = 0.0;
        } else {
            y      = by - confH - 4;
            pivotY = 1.0;
        }

        this._drawer.set_pivot_point(0.5, pivotY);
        this._drawer.set_position(x, y);
    }

    _hitTest(actor, x, y) {
        const [ax, ay] = actor.get_transformed_position();
        return x >= ax && x <= ax + actor.get_width() &&
               y >= ay && y <= ay + actor.get_height();
    }

    // ── Cleanup ────────────────────────────────────────────────────────────

    _destroyDrawer() {
        if (this._clickId !== null) {
            global.stage.disconnect(this._clickId);
            this._clickId = null;
        }
        if (this._drawer) {
            Main.layoutManager.removeChrome(this._drawer);
            this._drawer.destroy();
            this._drawer = null;
        }
        this._isOpen = false;
    }

    destroy() {
        this._destroyDrawer();
        for (const id of this._settIds)
            this._settings.disconnect(id);
        super.destroy();
    }
});

// ---------------------------------------------------------------------------
// Extension entry-point
// ---------------------------------------------------------------------------

export default class LauncherDrawerExtension extends Extension {

    enable() {
        this._settings = this.getSettings('org.gnome.shell.extensions.launcher-drawer');
        this._button   = null;

        this._makeButton();

        // Bind hotkey
        Main.wm.addKeybinding(
            'hotkey',
            this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => this._button?.toggleDrawer()
        );

        // Re-create button if user moves it to a different panel area
        this._panelBoxId = this._settings.connect('changed::panel-box', () => {
            this._button?.destroy();
            this._makeButton();
        });
    }

    _makeButton() {
        this._button = new LauncherButton(this._settings);
        Main.panel.addToStatusArea(
            this.uuid,
            this._button,
            0,
            this._settings.get_string('panel-box')
        );
    }

    disable() {
        Main.wm.removeKeybinding('hotkey');

        if (this._panelBoxId) {
            this._settings.disconnect(this._panelBoxId);
            this._panelBoxId = null;
        }

        this._button?.destroy();
        this._button   = null;
        this._settings = null;
    }
}
