import GLib from 'gi://GLib';

import {Extension} from
    'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from
    'resource:///org/gnome/shell/ui/main.js';
import {getRfkillManager} from
    'resource:///org/gnome/shell/ui/status/rfkill.js';

export default class LockScreenNetworkGuard extends Extension {
    enable() {
        this._airplaneToggle = null;
        this._bluetoothToggle = null;
        this._bluetoothClient = null;

        this._airplaneProtected = false;
        this._bluetoothProtected = false;
        this._baselineAirplaneMode = null;
        this._baselineBluetoothActive = null;
        this._restoringBluetooth = false;
        this._savedBluetoothDeviceStates = new Map();
        this._bluetoothContents = null;
        this._savedBluetoothContentsReactive = null;
        this._savedBluetoothContentsCanFocus = null;
        this._savedBluetoothToggleActive = null;
        this._savedBluetoothToggleDevice = null;
        this._blockedBluetoothToggleActive = null;
        this._blockedBluetoothToggleDevice = null;

        this._airplaneVisibilitySignal = 0;
        this._bluetoothStateSignal = 0;
        this._bluetoothDevicesSignal = 0;
        this._bluetoothDeviceSyncSource = 0;
        this._bluetoothRestoreSource = 0;
        this._retrySource = 0;

        this._rfkillManager = getRfkillManager();
        this._rfkillSignal = this._rfkillManager.connect(
            'notify::airplane-mode',
            () => this._onAirplaneModeChanged());

        this._sessionSignal = Main.sessionMode.connect(
            'updated',
            () => this._syncProtection());

        this._findControls();

        if (!this._haveAllControls())
            this._scheduleControlSearch();

        this._syncProtection();

        console.log(
            `Lock Screen Network Guard: extension enabled; ` +
            `mode=${Main.sessionMode.currentMode}`);
    }

    disable() {
        if (this._retrySource) {
            GLib.source_remove(this._retrySource);
            this._retrySource = 0;
        }

        if (this._bluetoothRestoreSource) {
            GLib.source_remove(this._bluetoothRestoreSource);
            this._bluetoothRestoreSource = 0;
        }

        if (this._bluetoothDeviceSyncSource) {
            GLib.source_remove(this._bluetoothDeviceSyncSource);
            this._bluetoothDeviceSyncSource = 0;
        }

        this._releaseAirplaneToggle();
        this._releaseBluetoothToggle();

        if (this._sessionSignal) {
            Main.sessionMode.disconnect(this._sessionSignal);
            this._sessionSignal = 0;
        }

        if (this._rfkillSignal) {
            this._rfkillManager.disconnect(this._rfkillSignal);
            this._rfkillSignal = 0;
        }

        if (this._bluetoothStateSignal &&
            this._bluetoothClient) {
            this._bluetoothClient.disconnect(
                this._bluetoothStateSignal);
            this._bluetoothStateSignal = 0;
        }

        if (this._bluetoothDevicesSignal &&
            this._bluetoothClient) {
            this._bluetoothClient.disconnect(
                this._bluetoothDevicesSignal);
            this._bluetoothDevicesSignal = 0;
        }

        this._rfkillManager = null;
        this._airplaneToggle = null;
        this._bluetoothToggle = null;
        this._bluetoothClient = null;

        console.log(
            'Lock Screen Network Guard: extension disabled');
    }

    _findControls() {
        const indicatorBox =
            Main.panel?.statusArea?.quickSettings?._indicators;

        const indicators =
            indicatorBox?.get_children?.() ?? [];

        if (!this._airplaneToggle) {
            const rfkillIndicator = indicators.find(
                indicator => indicator._rfkillToggle);

            this._airplaneToggle =
                rfkillIndicator?._rfkillToggle ?? null;
        }

        if (!this._bluetoothToggle) {
            const bluetoothIndicator =
                indicators.find(indicator => {
                    const client = indicator._client;

                    return client &&
                        typeof client.toggleActive ===
                            'function' &&
                        typeof client.toggleDevice ===
                            'function' &&
                        typeof client.getDevices ===
                            'function';
                });

            const item =
                bluetoothIndicator?.quickSettingsItems?.[0] ??
                null;

            if (item &&
                bluetoothIndicator &&
                item._client === bluetoothIndicator._client) {
                this._bluetoothToggle = item;
                this._bluetoothClient =
                    bluetoothIndicator._client;

                this._connectBluetoothSignals();
            }
        }
    }

    _connectBluetoothSignals() {
        if (!this._bluetoothClient)
            return;

        if (!this._bluetoothStateSignal) {
            this._bluetoothStateSignal =
                this._bluetoothClient.connect(
                    'notify::active',
                    () => this._onBluetoothActiveChanged());
        }

        if (!this._bluetoothDevicesSignal) {
            this._bluetoothDevicesSignal =
                this._bluetoothClient.connect(
                    'devices-changed',
                    () => this._queueBluetoothDeviceSync());
        }
    }

    _haveAllControls() {
        return Boolean(
            this._airplaneToggle &&
            this._bluetoothToggle);
    }

    _scheduleControlSearch() {
        if (this._retrySource)
            return;

        this._retrySource = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            250,
            () => {
                this._findControls();
                this._syncProtection();

                if (!this._haveAllControls())
                    return GLib.SOURCE_CONTINUE;

                this._retrySource = 0;
                return GLib.SOURCE_REMOVE;
            });
    }

    _shouldProtect() {
        return Main.sessionMode.currentMode === 'gdm' ||
            Main.sessionMode.isLocked;
    }

    _syncProtection() {
        if (this._shouldProtect()) {
            this._protectAirplaneToggle();
            this._protectBluetoothToggle();

            if (!this._haveAllControls())
                this._scheduleControlSearch();
        } else {
            this._releaseAirplaneToggle();
            this._releaseBluetoothToggle();
        }
    }

    _protectAirplaneToggle() {
        if (this._airplaneProtected)
            return;

        if (!this._airplaneToggle) {
            this._findControls();

            if (!this._airplaneToggle)
                return;
        }

        const currentState =
            this._rfkillManager.airplane_mode;

        this._baselineAirplaneMode =
            typeof currentState === 'boolean'
                ? currentState
                : null;

        this._airplaneProtected = true;

        this._savedAirplaneReactive =
            this._airplaneToggle.reactive;

        this._savedAirplaneCanFocus =
            this._airplaneToggle.can_focus;

        this._airplaneVisibilitySignal =
            this._airplaneToggle.connect(
                'notify::visible',
                () => {
                    if (this._airplaneProtected &&
                        this._airplaneToggle.visible) {
                        this._airplaneToggle.visible = false;
                    }
                });

        this._airplaneToggle.reactive = false;
        this._airplaneToggle.can_focus = false;
        this._airplaneToggle.visible = false;

        console.log(
            'Lock Screen Network Guard: ' +
            'Airplane Mode protected');
    }

    _releaseAirplaneToggle() {
        if (!this._airplaneProtected)
            return;

        this._airplaneProtected = false;
        this._baselineAirplaneMode = null;

        if (this._airplaneVisibilitySignal) {
            this._airplaneToggle.disconnect(
                this._airplaneVisibilitySignal);

            this._airplaneVisibilitySignal = 0;
        }

        this._airplaneToggle.reactive =
            this._savedAirplaneReactive ?? true;

        this._airplaneToggle.can_focus =
            this._savedAirplaneCanFocus ?? true;

        this._airplaneToggle.visible =
            this._rfkillManager?.show_airplane_mode ?? true;

        console.log(
            'Lock Screen Network Guard: ' +
            'Airplane Mode protection released');
    }

    _protectBluetoothToggle() {
        if (this._bluetoothProtected)
            return;

        if (!this._bluetoothToggle) {
            this._findControls();

            if (!this._bluetoothToggle)
                return;
        }

        const currentState =
            this._bluetoothClient.active;

        this._baselineBluetoothActive =
            typeof currentState === 'boolean'
                ? currentState
                : null;

        this._bluetoothProtected = true;

        /*
         * QuickMenuToggle contains two independent controls:
         *
         * 1. The first child controls Bluetooth power.
         * 2. _menuButton opens the Bluetooth submenu.
         *
         * Disable only the power control. The submenu therefore
         * remains accessible for viewing Bluetooth status.
         */
        this._bluetoothContents =
            this._bluetoothToggle
                ._box
                ?.get_first_child?.() ?? null;

        if (this._bluetoothContents) {
            this._savedBluetoothContentsReactive =
                this._bluetoothContents.reactive;

            this._savedBluetoothContentsCanFocus =
                this._bluetoothContents.can_focus;

            this._bluetoothContents.reactive = false;
            this._bluetoothContents.can_focus = false;
        }

        /*
         * Also replace the Bluetooth mutation functions.
         * This is a secondary UI-layer guard in case an actor
         * produces an activation signal programmatically or a
         * device row is created between synchronization events.
         */
        this._savedBluetoothToggleActive =
            this._bluetoothClient.toggleActive;

        this._savedBluetoothToggleDevice =
            this._bluetoothClient.toggleDevice;

        this._blockedBluetoothToggleActive = () => {
            console.warn(
                'Lock Screen Network Guard: ' +
                'blocked Bluetooth power change');
        };

        this._blockedBluetoothToggleDevice = async () => {
            console.warn(
                'Lock Screen Network Guard: ' +
                'blocked Bluetooth device change');
        };

        try {
            this._bluetoothClient.toggleActive =
                this._blockedBluetoothToggleActive;

            this._bluetoothClient.toggleDevice =
                this._blockedBluetoothToggleDevice;
        } catch (error) {
            console.warn(
                'Lock Screen Network Guard: could not wrap ' +
                `Bluetooth client: ${error}`);
        }

        this._syncBluetoothDeviceItems();

        console.log(
            'Lock Screen Network Guard: ' +
            'Bluetooth visible and read-only');
    }

    _releaseBluetoothToggle() {
        if (!this._bluetoothProtected)
            return;

        this._bluetoothProtected = false;
        this._baselineBluetoothActive = null;
        this._restoringBluetooth = false;

        if (this._bluetoothRestoreSource) {
            GLib.source_remove(
                this._bluetoothRestoreSource);

            this._bluetoothRestoreSource = 0;
        }

        if (this._bluetoothDeviceSyncSource) {
            GLib.source_remove(
                this._bluetoothDeviceSyncSource);

            this._bluetoothDeviceSyncSource = 0;
        }

        if (this._bluetoothContents) {
            this._bluetoothContents.reactive =
                this._savedBluetoothContentsReactive ??
                true;

            this._bluetoothContents.can_focus =
                this._savedBluetoothContentsCanFocus ??
                true;
        }

        this._restoreBluetoothDeviceItems();

        try {
            if (this._bluetoothClient?.toggleActive ===
                this._blockedBluetoothToggleActive) {
                this._bluetoothClient.toggleActive =
                    this._savedBluetoothToggleActive;
            }

            if (this._bluetoothClient?.toggleDevice ===
                this._blockedBluetoothToggleDevice) {
                this._bluetoothClient.toggleDevice =
                    this._savedBluetoothToggleDevice;
            }
        } catch (error) {
            console.warn(
                'Lock Screen Network Guard: could not restore ' +
                `Bluetooth client: ${error}`);
        }

        this._bluetoothContents = null;
        this._savedBluetoothContentsReactive = null;
        this._savedBluetoothContentsCanFocus = null;
        this._savedBluetoothToggleActive = null;
        this._savedBluetoothToggleDevice = null;
        this._blockedBluetoothToggleActive = null;
        this._blockedBluetoothToggleDevice = null;

        console.log(
            'Lock Screen Network Guard: ' +
            'Bluetooth protection released');
    }

    _queueBluetoothDeviceSync() {
        if (!this._bluetoothProtected ||
            this._bluetoothDeviceSyncSource)
            return;

        this._bluetoothDeviceSyncSource =
            GLib.idle_add(
                GLib.PRIORITY_DEFAULT_IDLE,
                () => {
                    this._bluetoothDeviceSyncSource = 0;
                    this._syncBluetoothDeviceItems();

                    return GLib.SOURCE_REMOVE;
                });
    }

    _syncBluetoothDeviceItems() {
        if (!this._bluetoothProtected)
            return;

        const items =
            this._bluetoothToggle
                ?._deviceItems
                ?.values?.();

        if (!items)
            return;

        for (const item of items) {
            if (!this._savedBluetoothDeviceStates.has(item)) {
                this._savedBluetoothDeviceStates.set(
                    item,
                    {
                        sensitive:
                            item._sensitive ??
                            item.sensitive,
                    });
            }

            item.setSensitive(false);
        }
    }

    _restoreBluetoothDeviceItems() {
        for (const [item, state] of
            this._savedBluetoothDeviceStates) {
            try {
                item.setSensitive(state.sensitive);
            } catch (error) {
                /*
                 * The item may have been destroyed if the
                 * Bluetooth device disappeared.
                 */
            }
        }

        this._savedBluetoothDeviceStates.clear();
    }

    _onAirplaneModeChanged() {
        if (!this._airplaneProtected)
            return;

        const currentState =
            this._rfkillManager.airplane_mode;

        if (typeof currentState !== 'boolean')
            return;

        if (this._baselineAirplaneMode === null) {
            this._baselineAirplaneMode = currentState;
            return;
        }

        if (currentState !==
            this._baselineAirplaneMode) {
            console.warn(
                'Lock Screen Network Guard: restoring ' +
                'protected Airplane Mode state');

            this._rfkillManager.airplane_mode =
                this._baselineAirplaneMode;
        }
    }

    _onBluetoothActiveChanged() {
        if (!this._bluetoothProtected)
            return;

        const currentState =
            this._bluetoothClient.active;

        if (typeof currentState !== 'boolean')
            return;

        if (this._baselineBluetoothActive === null) {
            this._baselineBluetoothActive = currentState;
            return;
        }

        if (currentState ===
            this._baselineBluetoothActive) {
            this._restoringBluetooth = false;
            return;
        }

        if (this._restoringBluetooth)
            return;

        this._restoringBluetooth = true;

        console.warn(
            'Lock Screen Network Guard: restoring ' +
            'protected Bluetooth state');

        /*
         * Use the saved original method here, rather than the
         * blocked public method, to restore the protected state.
         */
        if (this._savedBluetoothToggleActive) {
            this._savedBluetoothToggleActive.call(
                this._bluetoothClient);
        }

        this._bluetoothRestoreSource =
            GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                2000,
                () => {
                    this._bluetoothRestoreSource = 0;
                    this._restoringBluetooth = false;
                    this._onBluetoothActiveChanged();

                    return GLib.SOURCE_REMOVE;
                });
    }
}

