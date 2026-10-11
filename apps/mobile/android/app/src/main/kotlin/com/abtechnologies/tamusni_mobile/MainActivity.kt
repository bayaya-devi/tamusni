package com.abtechnologies.tamusni

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.content.Context
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "tamusni_news",
                "Actualités TAMUSNI",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Alertes éditoriales et informations TAMUSNI"
            }
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                .createNotificationChannel(channel)
        }
    }
}
