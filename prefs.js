import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import {ExtensionPreferences} from 'resource:///org/gnome/shell/extensions/prefs.js';

// ---------------------------------------------------------------------------
// App-picker dialog
// ---------------------------------------------------------------------------

class AppPickerDialog extends Gtk.Dialog {

    static {
        GObject.registerClass(this);
    }

    constructor(parent) {
        super({
            title:         'Add Application',
            transient_for: parent,
            modal:         true,
            default_width:  420,
            default_height: 540,
            use_header_bar: 1,
        });

        this.add_button('Cancel', Gtk.ResponseType.CANCEL);
        const addBtn = this.add_button('Add', Gtk.ResponseType.ACCEPT);
        addBtn.add_css_class('suggested-action');

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing:     0,
        });

        // Search bar
        const searchEntry = new Gtk.SearchEntry({
            placeholder_text: 'Search applications…',
            margin_top:    8,
            margin_bottom: 4,
            margin_start:  8,
            margin_end:    8,
        });
        box.append(searchEntry);

        // Scrolled list
        const scroll = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            vexpand:           true,
            margin_start:  8,
            margin_end:    8,
            margin_top:    4,
            margin_bottom: 8,
        });

        this._listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.SINGLE,
            activate_on_single_click: false,
        });
        this._listBox.add_css_class('boxed-list');
        scroll.set_child(this._listBox);
        box.append(scroll);

        this.get_content_area().append(box);

        // Populate
        const apps = Gio.AppInfo.get_all()
            .filter(a => a.should_show())
            .sort((a, b) =>
                a.get_display_name().localeCompare(b.get_display_name()));

        for (const app of apps) {
            const row  = new Gtk.ListBoxRow();
            const hbox = new Gtk.Box({spacing: 10, margin_start: 8, margin_end: 8,
                                      margin_top: 6, margin_bottom: 6});
            hbox.append(new Gtk.Image({gicon: app.get_icon(), pixel_size: 24}));
            hbox.append(new Gtk.Label({label: app.get_display_name(),
                                       xalign: 0, hexpand: true}));
            row.set_child(hbox);
            row._appInfo = app;
            this._listBox.append(row);
        }

        // Filter
        this._listBox.set_filter_func(row => {
            const q = searchEntry.get_text().toLowerCase().trim();
            if (!q) return true;
            return row._appInfo?.get_display_name().toLowerCase().includes(q) ||
                   row._appInfo?.get_id()?.toLowerCase().includes(q);
        });

        searchEntry.connect('search-changed', () =>
            this._listBox.invalidate_filter());

        // Double-click to accept
        this._listBox.connect('row-activated', () =>
            this.response(Gtk.ResponseType.ACCEPT));
    }

    get selectedAppId() {
        return this._listBox.get_selected_row()?._appInfo?.get_id() ?? null;
    }
}

// ---------------------------------------------------------------------------
// Preferences window
// ---------------------------------------------------------------------------

export default class LauncherDrawerPreferences extends ExtensionPreferences {

    fillPreferencesWindow(win) {
        const s = this.getSettings();
        win.set_default_size(640, 700);

        win.add(this._pageAppearance(s));
        win.add(this._pageDrawer(s));
        win.add(this._pageApps(s, win));
    }

    // ── Page: Appearance ───────────────────────────────────────────────────

    _pageAppearance(s) {
        const page = new Adw.PreferencesPage({
            title:      'Appearance',
            icon_name:  'applications-graphics-symbolic',
        });

        // --- Panel button group ---
        const btnGroup = new Adw.PreferencesGroup({title: 'Panel Button'});
        page.add(btnGroup);

        const iconRow = new Adw.EntryRow({
            title:  'Icon Name',
            text:   s.get_string('drawer-icon-name'),
        });
        iconRow.connect('changed', () =>
            s.set_string('drawer-icon-name', iconRow.get_text()));
        s.connect('changed::drawer-icon-name', () =>
            iconRow.set_text(s.get_string('drawer-icon-name')));
        btnGroup.add(iconRow);

        const posRow = new Adw.ComboRow({
            title:   'Position in Taskbar',
            subtitle: 'Which panel area to place the button in',
            model:   Gtk.StringList.new(['left', 'center', 'right']),
        });
        const panelBoxes = ['left', 'center', 'right'];
        posRow.selected = Math.max(0, panelBoxes.indexOf(s.get_string('panel-box')));
        posRow.connect('notify::selected', () =>
            s.set_string('panel-box', panelBoxes[posRow.selected]));
        btnGroup.add(posRow);

        // --- Hotkey group ---
        const hkGroup = new Adw.PreferencesGroup({title: 'Keyboard Shortcut'});
        page.add(hkGroup);

        const hkRow = new Adw.EntryRow({
            title: 'Toggle Hotkey',
            text:  s.get_strv('hotkey')[0] ?? '',
        });
        hkRow.set_input_purpose(Gtk.InputPurpose.FREE_FORM);
        hkRow.connect('apply', () => {
            const val = hkRow.get_text().trim();
            if (val === '') {
                s.set_strv('hotkey', []);
            } else {
                const [ok] = Gtk.accelerator_parse(val);
                if (ok)
                    s.set_strv('hotkey', [val]);
                else
                    hkRow.set_text(s.get_strv('hotkey')[0] ?? '');
            }
        });
        s.connect('changed::hotkey', () => {
            const v = s.get_strv('hotkey')[0] ?? '';
            if (hkRow.get_text() !== v) hkRow.set_text(v);
        });

        const hkHint = new Adw.ActionRow({
            title:    'Format hint',
            subtitle: 'e.g. <Super>F1  ·  <Ctrl><Alt>l  ·  <Shift>F12',
            activatable: false,
        });
        hkGroup.add(hkRow);
        hkGroup.add(hkHint);

        // --- Icons group ---
        const iconsGroup = new Adw.PreferencesGroup({title: 'Icons'});
        page.add(iconsGroup);

        iconsGroup.add(this._spinRow('Icon Size', 'px', 'icon-size', s, 16, 128, 4));
        iconsGroup.add(this._switchRow('Show App Labels', 'show-labels', s));

        return page;
    }

    // ── Page: Drawer ───────────────────────────────────────────────────────

    _pageDrawer(s) {
        const page = new Adw.PreferencesPage({
            title:     'Drawer',
            icon_name: 'view-grid-symbolic',
        });

        const sizeGroup = new Adw.PreferencesGroup({title: 'Size'});
        page.add(sizeGroup);
        sizeGroup.add(this._spinRow('Width',  'px', 'drawer-width',  s, 120, 1200, 10));
        sizeGroup.add(this._spinRow('Height', 'px', 'drawer-height', s,  80, 1200, 10));

        const animGroup = new Adw.PreferencesGroup({title: 'Animation'});
        page.add(animGroup);
        animGroup.add(this._spinRow('Duration', 'ms', 'animation-duration', s, 0, 2000, 20));

        const animHint = new Adw.ActionRow({
            title:       'Tip',
            subtitle:    'Set duration to 0 to disable animation entirely.',
            activatable: false,
        });
        animGroup.add(animHint);

        return page;
    }

    // ── Page: Apps ─────────────────────────────────────────────────────────

    _pageApps(s, win) {
        const page = new Adw.PreferencesPage({
            title:     'Apps',
            icon_name: 'application-x-executable-symbolic',
        });

        const group = new Adw.PreferencesGroup({
            title:       'Launcher Apps',
            description: 'Apps appear in the drawer in the order listed here.',
        });
        page.add(group);

        // We'll rebuild the rows whenever the list changes
        const refreshList = () => {
            // Remove all existing rows
            let child = group.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                // PreferencesGroup wraps rows in a private box; target only ActionRows
                if (child instanceof Adw.ActionRow)
                    group.remove(child);
                child = next;
            }

            const appIds = s.get_strv('apps');
            for (let i = 0; i < appIds.length; i++) {
                const id   = appIds[i];
                const info = Gio.DesktopAppInfo.new(id);
                const name = info?.get_display_name() ?? id;

                const row = new Adw.ActionRow({
                    title:    name,
                    subtitle: id,
                    icon_name: 'application-x-executable-symbolic',
                });

                if (info?.get_icon()) {
                    const img = new Gtk.Image({
                        gicon:      info.get_icon(),
                        pixel_size: 32,
                    });
                    row.add_prefix(img);
                    row.icon_name = null; // suppress default icon
                }

                // Move up
                if (i > 0) {
                    const upBtn = new Gtk.Button({
                        icon_name:     'go-up-symbolic',
                        valign:        Gtk.Align.CENTER,
                        tooltip_text:  'Move up',
                        css_classes:   ['flat'],
                    });
                    upBtn.connect('clicked', () => {
                        const list = s.get_strv('apps');
                        [list[i - 1], list[i]] = [list[i], list[i - 1]];
                        s.set_strv('apps', list);
                    });
                    row.add_suffix(upBtn);
                }

                // Move down
                if (i < appIds.length - 1) {
                    const downBtn = new Gtk.Button({
                        icon_name:     'go-down-symbolic',
                        valign:        Gtk.Align.CENTER,
                        tooltip_text:  'Move down',
                        css_classes:   ['flat'],
                    });
                    downBtn.connect('clicked', () => {
                        const list = s.get_strv('apps');
                        [list[i], list[i + 1]] = [list[i + 1], list[i]];
                        s.set_strv('apps', list);
                    });
                    row.add_suffix(downBtn);
                }

                // Remove
                const rmBtn = new Gtk.Button({
                    icon_name:    'list-remove-symbolic',
                    valign:       Gtk.Align.CENTER,
                    tooltip_text: 'Remove',
                    css_classes:  ['flat', 'destructive-action'],
                });
                rmBtn.connect('clicked', () => {
                    const list = s.get_strv('apps').filter(x => x !== id);
                    s.set_strv('apps', list);
                });
                row.add_suffix(rmBtn);

                group.add(row);
            }
        };

        s.connect('changed::apps', refreshList);
        refreshList();

        // Add button
        const addRow = new Adw.ActionRow({title: 'Add Application'});
        const addBtn = new Gtk.Button({
            label:       'Add…',
            valign:      Gtk.Align.CENTER,
            css_classes: ['suggested-action'],
        });
        addBtn.connect('clicked', () => {
            const dlg = new AppPickerDialog(win);
            dlg.connect('response', (_d, response) => {
                if (response === Gtk.ResponseType.ACCEPT) {
                    const id = dlg.selectedAppId;
                    if (id) {
                        const list = s.get_strv('apps');
                        if (!list.includes(id)) {
                            list.push(id);
                            s.set_strv('apps', list);
                        }
                    }
                }
                dlg.destroy();
            });
            dlg.present();
        });
        addRow.add_suffix(addBtn);
        addRow.set_activatable_widget(addBtn);
        group.add(addRow);

        return page;
    }

    // ── Widget helpers ─────────────────────────────────────────────────────

    _spinRow(title, unit, key, s, min, max, step) {
        const adj = new Gtk.Adjustment({
            lower:          min,
            upper:          max,
            step_increment: step,
            value:          s.get_int(key),
        });

        const row = new Adw.SpinRow({
            title,
            subtitle: unit ? `(${unit})` : '',
            adjustment: adj,
            digits: 0,
            snap_to_ticks: true,
            climb_rate: step,
        });

        row.connect('notify::value', () => s.set_int(key, row.get_value()));
        s.connect(`changed::${key}`, () => {
            if (row.get_value() !== s.get_int(key))
                row.set_value(s.get_int(key));
        });

        return row;
    }

    _switchRow(title, key, s) {
        const row = new Adw.SwitchRow({
            title,
            active: s.get_boolean(key),
        });
        row.connect('notify::active', () => s.set_boolean(key, row.active));
        s.connect(`changed::${key}`, () => {
            if (row.active !== s.get_boolean(key))
                row.active = s.get_boolean(key);
        });
        return row;
    }
}
