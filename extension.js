import GLib from 'gi://GLib';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {getRfkillManager} from 'resource:///org/gnome/shell/ui/status/rfkill.js';

const RETRY_INTERVAL_MS = 250;
const BLUETOOTH_RESTORE_INTERVAL_MS = 250;

export default class LockScreenNetworkGuardExtension extends Extension {
    enable() {
        this._airplaneToggle = null;
        this._wifiToggle = null;
        this._bluetoothToggle = null;
        this._bluetoothClient = null;

        this._airplaneProtected = false;
        this._wifiProtected = false;
        this._bluetoothProtected = false;

        this._airplaneVisibleId = 0;
        this._wifiVisibleId = 0;
        this._bluetoothVisibleId = 0;
        this._bluetoothActiveId = 0;

        this._savedAirplaneVisible = null;
        this._savedWifiVisible = null;
        this._savedBluetoothVisible = null;

        this._airplaneBaseline = null;
        this._bluetoothBaseline = null;
        this._restoringAirplane = false;
        this._restoringBluetooth = false;

        this._retrySourceId = 0;
        this._bluetoothRestoreSourceId = 0;

        this._rfkillManager = getRfkillManager();
        this._rfkillSignalId = this._rfkillManager.connect(
            'notify::airplane-mode',
            () => this._onAirplaneModeChanged());

        this._sessionSignalId = Main.sessionMode.connect(
            'updated',
            () => this._syncProtection());

        this._findControls();
        this._startRetry();
        this._syncProtection();

        console.log('Lock Screen Network Guard: extension enabled');
    }

    disable() {
        this._removeRetry();
        this._removeBluetoothRestore();

        this._releaseAirplaneProtection();
        this._releaseWifiProtection();
        this._releaseBluetoothProtection();

        if (this._sessionSignalId) {
            Main.sessionMode.disconnect(this._sessionSignalId);
            this._sessionSignalId = 0;
        }

        if (this._rfkillSignalId && this._rfkillManager) {
            this._rfkillManager.disconnect(this._rfkillSignalId);
            this._rfkillSignalId = 0;
        }

        if (this._bluetoothActiveId && this._bluetoothClient) {
            this._bluetoothClient.disconnect(this._bluetoothActiveId);
            this._bluetoothActiveId = 0;
        }

        this._rfkillManager = null;
        this._airplaneToggle = null;
        this._wifiToggle = null;
        this._bluetoothToggle = null;
        this._bluetoothClient = null;

        console.log('Lock Screen Network Guard: extension disabled');
    }

    _shouldProtect() {
        return Main.sessionMode.currentMode === 'gdm' ||
            Main.sessionMode.isLocked;
    }

    _findControls() {
        const quickSettings = Main.panel.statusArea.quickSettings;
        if (!quickSettings)
            return false;

        const indicators = quickSettings._indicators?.get_children?.() ?? [];

        for (const indicator of indicators) {
            if (!this._airplaneToggle && indicator._rfkillToggle)
                this._airplaneToggle = indicator._rfkillToggle;

            if (!this._wifiToggle && indicator._wirelessToggle)
                this._wifiToggle = indicator._wirelessToggle;

            if (!this._bluetoothClient &&
                typeof indicator._client?.toggleActive === 'function' &&
                typeof indicator._client?.toggleDevice === 'function' &&
                typeof indicator._client?.getDevices === 'function') {
                this._bluetoothClient = indicator._client;
                this._bluetoothToggle = indicator.quickSettingsItems?.[0] ?? null;

                this._bluetoothActiveId = this._bluetoothClient.connect(
                    'notify::active',
                    () => this._onBluetoothActiveChanged());
            }
        }

        return Boolean(
            this._airplaneToggle &&
            this._wifiToggle &&
            this._bluetoothToggle &&
            this._bluetoothClient);
    }

    _startRetry() {
        if (this._retrySourceId)
            return;

        this._retrySourceId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            RETRY_INTERVAL_MS,
            () => {
                const foundAllControls = this._findControls();
                this._syncProtection();

                if (foundAllControls) {
                    this._retrySourceId = 0;
                    return GLib.SOURCE_REMOVE;
                }

                return GLib.SOURCE_CONTINUE;
            });
    }

    _removeRetry() {
        if (!this._retrySourceId)
            return;

        GLib.source_remove(this._retrySourceId);
        this._retrySourceId = 0;
    }

    _syncProtection() {
        this._findControls();

        if (this._shouldProtect()) {
            this._protectAirplaneMode();
            this._protectWifi();
            this._protectBluetooth();
        } else {
            this._releaseAirplaneProtection();
            this._releaseWifiProtection();
            this._releaseBluetoothProtection();
        }
    }

    _protectAirplaneMode() {
        if (!this._airplaneToggle || this._airplaneProtected)
            return;

        this._airplaneBaseline = this._rfkillManager.airplane_mode;
        this._savedAirplaneVisible = this._airplaneToggle.visible;
        this._airplaneProtected = true;

        this._airplaneVisibleId = this._airplaneToggle.connect(
            'notify::visible',
            () => {
                if (this._airplaneProtected && this._airplaneToggle.visible)
                    this._airplaneToggle.visible = false;
            });

        this._airplaneToggle.visible = false;
        console.log('Lock Screen Network Guard: Airplane Mode tile hidden');
    }

    _releaseAirplaneProtection() {
        if (!this._airplaneProtected)
            return;

        this._airplaneProtected = false;
        this._airplaneBaseline = null;
        this._restoringAirplane = false;

        if (this._airplaneVisibleId && this._airplaneToggle) {
            this._airplaneToggle.disconnect(this._airplaneVisibleId);
            this._airplaneVisibleId = 0;
        }

        if (this._airplaneToggle) {
            this._airplaneToggle.visible =
                this._rfkillManager?.show_airplane_mode ??
                this._savedAirplaneVisible ?? true;
        }

        this._savedAirplaneVisible = null;
        console.log('Lock Screen Network Guard: Airplane Mode tile restored');
    }

    _onAirplaneModeChanged() {
        if (!this._airplaneProtected || this._airplaneBaseline === null ||
            this._restoringAirplane)
            return;

        if (this._rfkillManager.airplane_mode === this._airplaneBaseline)
            return;

        this._restoringAirplane = true;
        this._rfkillManager.airplane_mode = this._airplaneBaseline;

        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._restoringAirplane = false;
            return GLib.SOURCE_REMOVE;
        });
    }

    _protectWifi() {
        if (!this._wifiToggle || this._wifiProtected)
            return;

        this._savedWifiVisible = this._wifiToggle.visible;
        this._wifiProtected = true;

        this._wifiVisibleId = this._wifiToggle.connect(
            'notify::visible',
            () => {
                if (this._wifiProtected && this._wifiToggle.visible)
                    this._wifiToggle.visible = false;
            });

        this._wifiToggle.visible = false;
        console.log('Lock Screen Network Guard: Wi-Fi tile hidden');
    }

    _releaseWifiProtection() {
        if (!this._wifiProtected)
            return;

        this._wifiProtected = false;

        if (this._wifiVisibleId && this._wifiToggle) {
            this._wifiToggle.disconnect(this._wifiVisibleId);
            this._wifiVisibleId = 0;
        }

        if (this._wifiToggle) {
            try {
                this._wifiToggle._sync();
            } catch (error) {
                console.warn(
                    `Lock Screen Network Guard: could not resync Wi-Fi tile: ${error.message}`);
                this._wifiToggle.visible = this._savedWifiVisible ?? true;
            }
        }

        this._savedWifiVisible = null;
        console.log('Lock Screen Network Guard: Wi-Fi tile restored');
    }

    _protectBluetooth() {
        if (!this._bluetoothToggle || !this._bluetoothClient ||
            this._bluetoothProtected)
            return;

        this._bluetoothBaseline = this._bluetoothClient.active;
        this._savedBluetoothVisible = this._bluetoothToggle.visible;
        this._bluetoothProtected = true;

        this._bluetoothVisibleId = this._bluetoothToggle.connect(
            'notify::visible',
            () => {
                if (this._bluetoothProtected && this._bluetoothToggle.visible)
                    this._bluetoothToggle.visible = false;
            });

        this._bluetoothToggle.visible = false;
        console.log('Lock Screen Network Guard: Bluetooth tile hidden');
    }

    _releaseBluetoothProtection() {
        if (!this._bluetoothProtected)
            return;

        this._bluetoothProtected = false;
        this._bluetoothBaseline = null;
        this._restoringBluetooth = false;
        this._removeBluetoothRestore();

        if (this._bluetoothVisibleId && this._bluetoothToggle) {
            this._bluetoothToggle.disconnect(this._bluetoothVisibleId);
            this._bluetoothVisibleId = 0;
        }

        if (this._bluetoothToggle) {
            this._bluetoothToggle.visible =
                this._bluetoothClient?.available ??
                this._savedBluetoothVisible ?? true;
        }

        this._savedBluetoothVisible = null;
        console.log('Lock Screen Network Guard: Bluetooth tile restored');
    }

    _onBluetoothActiveChanged() {
        if (!this._bluetoothProtected || this._bluetoothBaseline === null ||
            this._restoringBluetooth)
            return;

        if (this._bluetoothClient.active === this._bluetoothBaseline)
            return;

        this._restoreBluetoothState();
    }

    _restoreBluetoothState() {
        if (!this._bluetoothClient || !this._bluetoothProtected ||
            this._bluetoothBaseline === null)
            return;

        if (this._bluetoothClient.active === this._bluetoothBaseline) {
            this._restoringBluetooth = false;
            this._removeBluetoothRestore();
            return;
        }

        if (!this._restoringBluetooth) {
            this._restoringBluetooth = true;
            this._bluetoothClient.toggleActive();
        }

        if (this._bluetoothRestoreSourceId)
            return;

        this._bluetoothRestoreSourceId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            BLUETOOTH_RESTORE_INTERVAL_MS,
            () => {
                this._bluetoothRestoreSourceId = 0;

                if (!this._bluetoothProtected || !this._bluetoothClient) {
                    this._restoringBluetooth = false;
                    return GLib.SOURCE_REMOVE;
                }

                if (this._bluetoothClient.active !== this._bluetoothBaseline)
                    this._bluetoothClient.toggleActive();

                this._restoringBluetooth = false;
                return GLib.SOURCE_REMOVE;
            });
    }

    _removeBluetoothRestore() {
        if (!this._bluetoothRestoreSourceId)
            return;

        GLib.source_remove(this._bluetoothRestoreSourceId);
        this._bluetoothRestoreSourceId = 0;
    }
}
