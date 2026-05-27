package com.godive.plugin.dive;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DiveService")
public class DiveServicePlugin extends Plugin {

    private BroadcastReceiver timerReceiver;
    private BroadcastReceiver safeReceiver;

    @Override
    public void load() {
        super.load();
        
        timerReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (DiveForegroundService.ACTION_TIMER_EXPIRED.equals(intent.getAction())) {
                    notifyListeners("timerExpired", new JSObject());
                }
            }
        };

        safeReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (BleMeshManager.ACTION_SAFE_RECEIVED.equals(intent.getAction())) {
                    notifyListeners("safeReceived", new JSObject());
                }
            }
        };

        // Register the BroadcastReceivers
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(timerReceiver, new IntentFilter(DiveForegroundService.ACTION_TIMER_EXPIRED), Context.RECEIVER_NOT_EXPORTED);
            getContext().registerReceiver(safeReceiver, new IntentFilter(BleMeshManager.ACTION_SAFE_RECEIVED), Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(timerReceiver, new IntentFilter(DiveForegroundService.ACTION_TIMER_EXPIRED));
            getContext().registerReceiver(safeReceiver, new IntentFilter(BleMeshManager.ACTION_SAFE_RECEIVED));
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (timerReceiver != null) {
            getContext().unregisterReceiver(timerReceiver);
        }
        if (safeReceiver != null) {
            getContext().unregisterReceiver(safeReceiver);
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void startTimer(PluginCall call) {
        Long durationMs = call.getLong("durationMs");
        if (durationMs == null) {
            call.reject("durationMs is required");
            return;
        }

        Intent serviceIntent = new Intent(getContext(), DiveForegroundService.class);
        serviceIntent.setAction(DiveForegroundService.ACTION_START);
        serviceIntent.putExtra("durationMs", durationMs);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(serviceIntent);
        } else {
            getContext().startService(serviceIntent);
        }

        call.resolve();
    }

    @PluginMethod
    public void extendTimer(PluginCall call) {
        Long additionalMs = call.getLong("additionalMs");
        if (additionalMs == null) {
            call.reject("additionalMs is required");
            return;
        }

        Intent serviceIntent = new Intent(getContext(), DiveForegroundService.class);
        serviceIntent.setAction(DiveForegroundService.ACTION_EXTEND);
        serviceIntent.putExtra("additionalMs", additionalMs);
        getContext().startService(serviceIntent);

        call.resolve();
    }

    @PluginMethod
    public void stopTimer(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), DiveForegroundService.class);
        serviceIntent.setAction(DiveForegroundService.ACTION_STOP);
        getContext().startService(serviceIntent);
        call.resolve();
    }

    @PluginMethod
    public void startDistressAdvertising(PluginCall call) {
        String diverId = call.getString("diverId", "unknown");
        Double lat = call.getDouble("lat", 0.0);
        Double lng = call.getDouble("lng", 0.0);
        Integer bat = call.getInt("batteryLevel", 100);

        Intent serviceIntent = new Intent(getContext(), DiveForegroundService.class);
        serviceIntent.setAction(DiveForegroundService.ACTION_START_ADVERTISING);
        serviceIntent.putExtra("diverId", diverId);
        serviceIntent.putExtra("lat", lat);
        serviceIntent.putExtra("lng", lng);
        serviceIntent.putExtra("bat", bat);
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(serviceIntent);
        } else {
            getContext().startService(serviceIntent);
        }

        call.resolve();
    }

    @PluginMethod
    public void stopAdvertising(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), DiveForegroundService.class);
        serviceIntent.setAction(DiveForegroundService.ACTION_STOP_ADVERTISING);
        getContext().startService(serviceIntent);
        call.resolve();
    }
}
