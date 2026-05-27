package com.godive.plugin.dive;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.Intent;
import android.os.ParcelUuid;
import android.util.Log;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class BleMeshManager {
    private static final String TAG = "BleMeshManager";
    
    // Core Service UUID indicating Distress
    public static final UUID DISTRESS_SERVICE_UUID = UUID.fromString("0000DEAD-0000-1000-8000-00805F9B34FB");
    // Characteristic to read the payload
    public static final UUID PAYLOAD_CHARACTERISTIC_UUID = UUID.fromString("0000DEAE-0000-1000-8000-00805F9B34FB");
    // Characteristic to write 'safe' status back
    public static final UUID SAFE_CHARACTERISTIC_UUID = UUID.fromString("0000DEAF-0000-1000-8000-00805F9B34FB");

    public static final String ACTION_DISTRESS_RECEIVED = "com.godive.plugin.dive.DISTRESS_RECEIVED";
    public static final String ACTION_SAFE_RECEIVED = "com.godive.plugin.dive.SAFE_RECEIVED";

    private Context context;
    private BluetoothManager bluetoothManager;
    private BluetoothAdapter bluetoothAdapter;
    
    // Advertiser
    private BluetoothLeAdvertiser advertiser;
    private BluetoothGattServer gattServer;
    private String currentPayload = "";

    // Scanner
    private BluetoothLeScanner scanner;

    public BleMeshManager(Context context) {
        this.context = context;
        this.bluetoothManager = (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
        if (bluetoothManager != null) {
            this.bluetoothAdapter = bluetoothManager.getAdapter();
        }
    }

    public void startAdvertising(String diverId, double lat, double lng, int battery) {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            Log.e(TAG, "Bluetooth not enabled");
            return;
        }

        try {
            JSONObject json = new JSONObject();
            json.put("id", diverId);
            json.put("lat", lat);
            json.put("lng", lng);
            json.put("bat", battery);
            this.currentPayload = json.toString();
        } catch (Exception e) {
            this.currentPayload = "{}";
        }

        setupGattServer();

        advertiser = bluetoothAdapter.getBluetoothLeAdvertiser();
        if (advertiser == null) return;

        AdvertiseSettings settings = new AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .setConnectable(true)
                .build();

        AdvertiseData data = new AdvertiseData.Builder()
                .setIncludeDeviceName(false)
                .addServiceUuid(new ParcelUuid(DISTRESS_SERVICE_UUID))
                .build();

        advertiser.startAdvertising(settings, data, advertiseCallback);
        Log.i(TAG, "Started Distress Advertising");
    }

    public void stopAdvertising() {
        if (advertiser != null && bluetoothAdapter != null && bluetoothAdapter.isEnabled()) {
            try { advertiser.stopAdvertising(advertiseCallback); } catch (Exception ignored) {}
        }
        if (gattServer != null) {
            gattServer.close();
        }
    }

    private void setupGattServer() {
        gattServer = bluetoothManager.openGattServer(context, gattServerCallback);
        if (gattServer == null) return;

        BluetoothGattService service = new BluetoothGattService(DISTRESS_SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY);

        BluetoothGattCharacteristic payloadChar = new BluetoothGattCharacteristic(
                PAYLOAD_CHARACTERISTIC_UUID,
                BluetoothGattCharacteristic.PROPERTY_READ,
                BluetoothGattCharacteristic.PERMISSION_READ
        );

        BluetoothGattCharacteristic safeChar = new BluetoothGattCharacteristic(
                SAFE_CHARACTERISTIC_UUID,
                BluetoothGattCharacteristic.PROPERTY_WRITE,
                BluetoothGattCharacteristic.PERMISSION_WRITE
        );

        service.addCharacteristic(payloadChar);
        service.addCharacteristic(safeChar);
        gattServer.addService(service);
    }

    private final AdvertiseCallback advertiseCallback = new AdvertiseCallback() {
        @Override
        public void onStartSuccess(AdvertiseSettings settingsInEffect) {
            Log.i(TAG, "BLE advertise started successfully");
        }
        @Override
        public void onStartFailure(int errorCode) {
            Log.e(TAG, "BLE advertise failed: " + errorCode);
        }
    };

    private final BluetoothGattServerCallback gattServerCallback = new BluetoothGattServerCallback() {
        @Override
        public void onCharacteristicReadRequest(BluetoothDevice device, int requestId, int offset, BluetoothGattCharacteristic characteristic) {
            if (PAYLOAD_CHARACTERISTIC_UUID.equals(characteristic.getUuid())) {
                byte[] value = currentPayload.getBytes(StandardCharsets.UTF_8);
                gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value);
            }
        }

        @Override
        public void onCharacteristicWriteRequest(BluetoothDevice device, int requestId, BluetoothGattCharacteristic characteristic, boolean preparedWrite, boolean responseNeeded, int offset, byte[] value) {
            if (SAFE_CHARACTERISTIC_UUID.equals(characteristic.getUuid())) {
                if (responseNeeded) {
                    gattServer.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value);
                }
                // Buddy marked us as safe! Notify app.
                stopAdvertising();
                Intent intent = new Intent(ACTION_SAFE_RECEIVED);
                context.sendBroadcast(intent);
            }
        }
    };

    // --- Scanning Logic (For the rescuing buddy) ---
    public void startScanning() {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) return;
        scanner = bluetoothAdapter.getBluetoothLeScanner();
        if (scanner == null) return;

        ScanFilter filter = new ScanFilter.Builder()
                .setServiceUuid(new ParcelUuid(DISTRESS_SERVICE_UUID))
                .build();
        List<ScanFilter> filters = new ArrayList<>();
        filters.add(filter);

        ScanSettings settings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build();

        scanner.startScan(filters, settings, scanCallback);
        Log.i(TAG, "Started Scanning for Distress Signals");
    }

    public void stopScanning() {
        if (scanner != null && bluetoothAdapter != null && bluetoothAdapter.isEnabled()) {
            scanner.stopScan(scanCallback);
        }
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            super.onScanResult(callbackType, result);
            // We found a distress UUID! In a full implementation, we'd connect to read the GATT characteristic.
            // For now, we immediately notify the JS layer so the buddy is warned.
            Intent intent = new Intent(ACTION_DISTRESS_RECEIVED);
            intent.putExtra("macAddress", result.getDevice().getAddress());
            context.sendBroadcast(intent);
            Log.w(TAG, "DISTRESS SIGNAL DETECTED FROM: " + result.getDevice().getAddress());
            
            // To prevent spam, we'd typically add it to a "seen" list here.
        }
    };
}
