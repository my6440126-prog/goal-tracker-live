package com.goaltracker.live;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class StepCounterService extends Service implements SensorEventListener {
    private static final String PREFS = "native_step_counter";
    private static final String CHANNEL = "goal_tracker_steps";
    private static final int NOTIFICATION_ID = 7312;

    private SensorManager sensorManager;
    private Sensor stepSensor;
    private boolean registered = false;

    private String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US)
            .format(new Date());
    }

    @Override
    public void onCreate() {
        super.onCreate();

        createNotificationChannel();
        startServiceNotification();

        sensorManager = (SensorManager) getSystemService(SENSOR_SERVICE);
        if (sensorManager != null) {
            stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL,
                "Goal Tracker step counting",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps the phone step sensor active.");
            NotificationManager manager =
                (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification() {
        Notification.Builder builder;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL);
        } else {
            builder = new Notification.Builder(this);
        }

        return builder
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("Goal Tracker Live")
            .setContentText("फोन का Step Sensor कदम गिन रहा है")
            .setCategory(Notification.CATEGORY_SERVICE)
            .setOngoing(true)
            .build();
    }

    private void startServiceNotification() {
        Notification notification = buildNotification();

        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (stepSensor == null || sensorManager == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        if (!registered) {
            registered = sensorManager.registerListener(
                this,
                stepSensor,
                SensorManager.SENSOR_DELAY_NORMAL
            );
        }

        if (!registered) {
            stopSelf();
            return START_NOT_STICKY;
        }

        getSharedPreferences(PREFS, MODE_PRIVATE)
            .edit().putBoolean("tracking", true).apply();

        return START_STICKY;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_STEP_COUNTER ||
            event.values.length == 0) {
            return;
        }

        long raw = Math.max(0L, Math.round(event.values[0]));
        String date = today();

        android.content.SharedPreferences prefs =
            getSharedPreferences(PREFS, MODE_PRIVATE);

        String savedDate = prefs.getString("date", "");
        boolean hasRaw = prefs.getBoolean("has_raw", false);
        long lastRaw = prefs.getLong("last_raw", -1L);
        int steps = prefs.getInt("steps", 0);

        if (!date.equals(savedDate)) {
            // Do not assign yesterday's sensor delta to today's total.
            steps = 0;
            lastRaw = raw;
            hasRaw = true;
        } else if (!hasRaw || lastRaw < 0) {
            // Establish the first baseline; never invent earlier steps.
            lastRaw = raw;
            hasRaw = true;
        } else if (raw >= lastRaw) {
            long delta = raw - lastRaw;
            long updated = (long) steps + delta;
            steps = (int) Math.min(Integer.MAX_VALUE, updated);
            lastRaw = raw;
        } else {
            // Sensor total decreased, usually after a device reboot.
            // Keep the saved daily total and establish a new baseline.
            lastRaw = raw;
        }

        prefs.edit()
            .putString("date", date)
            .putInt("steps", Math.max(0, steps))
            .putLong("last_raw", lastRaw)
            .putBoolean("has_raw", hasRaw)
            .apply();
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // No action required.
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Do not stop counting merely because the app task was dismissed.
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }

        getSharedPreferences(PREFS, MODE_PRIVATE)
            .edit().putBoolean("tracking", false).apply();

        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
