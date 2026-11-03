package com.goaltracker.live;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(
    name = "NativeStepCounter",
    permissions = {
        @Permission(
            alias = "activityRecognition",
            strings = { Manifest.permission.ACTIVITY_RECOGNITION }
        )
    }
)
public class NativeStepCounterPlugin extends Plugin {
    private static final String PREFS = "native_step_counter";

    private String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US)
            .format(new Date());
    }

    private boolean sensorAvailable() {
        SensorManager manager = (SensorManager)
            getContext().getSystemService(Context.SENSOR_SERVICE);

        return manager != null &&
            manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", sensorAvailable());
        call.resolve(result);
    }

    @PluginMethod
    public void requestActivityPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        if (getPermissionState("activityRecognition") == PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        requestPermissionForAlias(
            "activityRecognition",
            call,
            "activityPermissionCallback"
        );
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void activityPermissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put(
            "granted",
            getPermissionState("activityRecognition") == PermissionState.GRANTED
        );
        call.resolve(result);
    }

    @PluginMethod
    public void initializeToday(PluginCall call) {
        Integer requested = call.getInt("steps");
        int steps = requested == null ? 0 : Math.max(0, requested);

        android.content.SharedPreferences prefs =
            getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        String currentDate = today();
        String savedDate = prefs.getString("date", "");

        if (!currentDate.equals(savedDate)) {
            prefs.edit()
                .putString("date", currentDate)
                .putInt("steps", steps)
                .remove("has_raw")
                .apply();
        } else {
            int existing = Math.max(0, prefs.getInt("steps", 0));
            if (steps > existing) {
                prefs.edit().putInt("steps", steps).apply();
            }
        }

        call.resolve();
    }

    @PluginMethod
    public void startTracking(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            getPermissionState("activityRecognition") != PermissionState.GRANTED) {
            call.reject("Activity Recognition permission is required.");
            return;
        }

        if (!sensorAvailable()) {
            call.reject("This phone does not provide TYPE_STEP_COUNTER.");
            return;
        }

        try {
            Intent intent = new Intent(getContext(), StepCounterService.class);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }

            call.resolve();
        } catch (Exception e) {
            call.reject("Could not start the Android step service.", e);
        }
    }

    @PluginMethod
    public void refreshSensor(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            getPermissionState("activityRecognition") != PermissionState.GRANTED) {
            call.reject("Activity Recognition permission is required.");
            return;
        }

        if (!sensorAvailable()) {
            call.reject("This phone does not provide TYPE_STEP_COUNTER.");
            return;
        }

        try {
            Intent intent = new Intent(getContext(), StepCounterService.class);
            intent.setAction(StepCounterService.ACTION_REFRESH);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }

            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                android.content.SharedPreferences prefs =
                    getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);

                int steps = today().equals(prefs.getString("date", ""))
                    ? prefs.getInt("steps", 0)
                    : 0;

                JSObject result = new JSObject();
                result.put("steps", steps);
                result.put("available", sensorAvailable());
                result.put("tracking", prefs.getBoolean("tracking", false));
                result.put("lastUpdated", prefs.getLong("last_updated", 0L));
                call.resolve(result);
            }, 1200);
        } catch (Exception e) {
            call.reject("Could not refresh the Android step sensor.", e);
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        android.content.SharedPreferences prefs =
            getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        int steps = today().equals(prefs.getString("date", ""))
            ? prefs.getInt("steps", 0)
            : 0;

        JSObject result = new JSObject();
        result.put("steps", steps);
        result.put("available", sensorAvailable());
        result.put("tracking", prefs.getBoolean("tracking", false));
        result.put("lastUpdated", prefs.getLong("last_updated", 0L));
        call.resolve(result);
    }
}
