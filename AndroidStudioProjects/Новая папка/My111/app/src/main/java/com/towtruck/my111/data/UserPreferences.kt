package com.towtruck.my111.data

import android.content.Context
import android.content.SharedPreferences

class UserPreferences(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("user_prefs", Context.MODE_PRIVATE)
    
    companion object {
        private const val KEY_IS_REGISTERED = "is_registered"
        private const val KEY_FIRST_NAME = "first_name"
        private const val KEY_LAST_NAME = "last_name"
        private const val KEY_PHONE = "phone"
        private const val KEY_VEHICLE_TYPE = "vehicle_type"
        private const val KEY_RATING = "rating"
        private const val KEY_AVATAR_URI = "avatar_uri"
    }
    
    var isRegistered: Boolean
        get() = prefs.getBoolean(KEY_IS_REGISTERED, false)
        set(value) = prefs.edit().putBoolean(KEY_IS_REGISTERED, value).apply()
    
    var firstName: String
        get() = prefs.getString(KEY_FIRST_NAME, "") ?: ""
        set(value) = prefs.edit().putString(KEY_FIRST_NAME, value).apply()
    
    var lastName: String
        get() = prefs.getString(KEY_LAST_NAME, "") ?: ""
        set(value) = prefs.edit().putString(KEY_LAST_NAME, value).apply()
    
    var phone: String
        get() = prefs.getString(KEY_PHONE, "") ?: ""
        set(value) = prefs.edit().putString(KEY_PHONE, value).apply()
    
    var vehicleType: String
        get() = prefs.getString(KEY_VEHICLE_TYPE, "") ?: ""
        set(value) = prefs.edit().putString(KEY_VEHICLE_TYPE, value).apply()
    
    var rating: Float
        get() = prefs.getFloat(KEY_RATING, 4.9f)
        set(value) = prefs.edit().putFloat(KEY_RATING, value).apply()

    var avatarUri: String?
        get() = prefs.getString(KEY_AVATAR_URI, null)
        set(value) = prefs.edit().putString(KEY_AVATAR_URI, value).apply()
    
    fun saveRegistrationData(
        firstName: String,
        lastName: String,
        phone: String,
        vehicleType: String
    ) {
        prefs.edit()
            .putString(KEY_FIRST_NAME, firstName)
            .putString(KEY_LAST_NAME, lastName)
            .putString(KEY_PHONE, phone)
            .putString(KEY_VEHICLE_TYPE, vehicleType)
            .putBoolean(KEY_IS_REGISTERED, true)
            .apply()
    }
    
    fun clearRegistration() {
        prefs.edit().clear().apply()
    }
}
