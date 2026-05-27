package com.godive.plugin.dive;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.CountDownTimer;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class DiveForegroundService extends Service {
    private static final String TAG = "DiveForegroundService";
    public static final String ACTION_START = "ACTION_START";
    public static final String ACTION_STOP = "ACTION_STOP";
    public static final String ACTION_EXTEND = "ACTION_EXTEND";
    public static final String ACTION_TIMER_EXPIRED = "com.godive.plugin.dive.TIMER_EXPIRED";
    public static final String ACTION_START_ADVERTISING = "ACTION_START_ADVERTISING";
    public static final String ACTION_STOP_ADVERTISING = "ACTION_STOP_ADVERTISING";

    private static final String CHANNEL_ID = "DiveSafetyChannel";
    private static final int NOTIFICATION_ID = 1001;

    private PowerManager.WakeLock wakeLock;
    private CountDownTimer countDownTimer;
    private long remainingMs = 0;
    
    private BleMeshManager bleMeshManager;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GoDive::DiveSafetyWakeLock");
            // Acquire wake lock to prevent Doze mode from putting the CPU to sleep
            wakeLock.acquire(12 * 60 * 60 * 1000L /*12 hours max*/); 
        }
        
        bleMeshManager = new BleMeshManager(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();
        if (ACTION_START.equals(action)) {
            long durationMs = intent.getLongExtra("durationMs", 0);
            startDiveTimer(durationMs);
            
            Notification notification = buildNotification(durationMs);
            
            // Android 14+ Requires explicit type declarations
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE | ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } else if (ACTION_STOP.equals(action)) {
            stopDiveTimer();
            stopForeground(true);
            stopSelf();
        } else if (ACTION_EXTEND.equals(action)) {
            long additionalMs = intent.getLongExtra("additionalMs", 0);
            extendDiveTimer(additionalMs);
        } else if (ACTION_START_ADVERTISING.equals(action)) {
            String diverId = intent.getStringExtra("diverId");
            double lat = intent.getDoubleExtra("lat", 0);
            double lng = intent.getDoubleExtra("lng", 0);
            int bat = intent.getIntExtra("bat", 100);
            bleMeshManager.startAdvertising(diverId, lat, lng, bat);
            // Also start scanning to hear if buddy reaches us
            bleMeshManager.startScanning();
        } else if (ACTION_STOP_ADVERTISING.equals(action)) {
            bleMeshManager.stopAdvertising();
            bleMeshManager.stopScanning();
        }

        return START_STICKY; // Restart if killed by the OS (critical for safety)
    }

    private void startDiveTimer(long durationMs) {
        if (countDownTimer != null) countDownTimer.cancel();
        this.remainingMs = durationMs;

        countDownTimer = new CountDownTimer(durationMs, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                remainingMs = millisUntilFinished;
                updateNotification(millisUntilFinished);
            }

            @Override
            public void onFinish() {
                remainingMs = 0;
                updateNotification(0);
                
                // Alert the JS Capacitor layer
                Intent broadcast = new Intent(ACTION_TIMER_EXPIRED);
                sendBroadcast(broadcast);
                Log.w(TAG, "Dive Timer Expired! Initiating Distress Protocols via JS layer.");
            }
        };
        countDownTimer.start();
    }

    private void extendDiveTimer(long additionalMs) {
        long newDuration = this.remainingMs + additionalMs;
        startDiveTimer(newDuration);
    }

    private void stopDiveTimer() {
        if (countDownTimer != null) {
            countDownTimer.cancel();
            countDownTimer = null;
        }
    }

    private Notification buildNotification(long millisUntilFinished) {
        String timeStr = formatTime(millisUntilFinished);
        
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        // FLAG_IMMUTABLE is required for Android 12+
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Active Dive Timer")
                .setContentText(millisUntilFinished > 0 ? "Time remaining: " + timeStr : "TIMER EXPIRED - DISTRESS ACTIVE")
                .setSmallIcon(android.R.drawable.ic_dialog_info) 
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();
    }

    private void updateNotification(long millisUntilFinished) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, buildNotification(millisUntilFinished));
        }
    }

    private String formatTime(long millis) {
        long hrs = millis / 3600000;
        long mins = (millis % 3600000) / 60000;
        long secs = (millis % 60000) / 1000;
        return String.format("%02d:%02d:%02d", hrs, mins, secs);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Dive Safety Timer",
                    NotificationManager.IMPORTANCE_HIGH
            );
            serviceChannel.setDescription("Keeps the Dead Man's Switch active while the screen is locked or underwater.");
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopDiveTimer();
        if (bleMeshManager != null) {
            bleMeshManager.stopAdvertising();
            bleMeshManager.stopScanning();
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        super.onDestroy();
    }
}
