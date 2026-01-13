package com.towtruck.my111

import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.towtruck.my111.data.EmailStorage
import com.towtruck.my111.viewmodel.RegistrationViewModel
import com.towtruck.my111.data.UserPreferences
import com.towtruck.my111.ui.screens.LoginScreen
import com.towtruck.my111.ui.screens.MainScreen
import com.towtruck.my111.ui.screens.RegisterDriverScreen
import com.towtruck.my111.ui.screens.SplashScreen
import com.towtruck.my111.ui.screens.VerificationScreen
import com.towtruck.my111.ui.screens.WelcomeBackScreen
import com.towtruck.my111.ui.screens.WelcomeScreen
import com.towtruck.my111.ui.state.VerificationState
import com.towtruck.my111.ui.state.DriverNameState
import com.towtruck.my111.ui.theme.My111Theme
import com.towtruck.my111.ui.theme.TowTruckOrange
import com.towtruck.my111.ui.theme.TowTruckTextSecondary
import com.towtruck.my111.ui.theme.TowTruckWhite
import java.util.Locale


class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        FirebaseApp.initializeApp(this)
        ensureFirebaseInitialized()
        handleEmailLink(intent)
        DriverNameState.init(this)
        enableEdgeToEdge()

        // Устанавливаем русскую локализацию для Google Maps
        val locale = Locale("ru", "RU")
        Locale.setDefault(locale)
        val config = Configuration(resources.configuration)
        config.setLocale(locale)
        resources.updateConfiguration(config, resources.displayMetrics)

        setContent {
            My111Theme {
                TowTruckApp()
            }
        }
    }
    
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
        handleEmailLink(intent)
    }
    
    private fun handleIntent(intent: Intent) {
        val showNewOrder = intent.getBooleanExtra("show_new_order", false)
        val showActiveOrder = intent.getBooleanExtra("show_active_order", false)
        val orderId = intent.getStringExtra("order_id")
        
        if (showNewOrder || showActiveOrder) {
            // TODO: Передать параметры в композable для показа соответствующего экрана
        }
    }

    private fun ensureFirebaseInitialized() {
        if (FirebaseApp.getApps(this).isEmpty()) {
            FirebaseApp.initializeApp(this)
        }
    }

    private fun handleEmailLink(intent: Intent?) {
        val data = intent?.data ?: return
        val email = EmailStorage.getEmail(this) ?: return
        val link = data.toString()
        val auth = FirebaseAuth.getInstance()
        if (!auth.isSignInWithEmailLink(link)) return

        auth.signInWithEmailLink(email, link)
            .addOnSuccessListener {
                Log.d(TAG, "Email link sign-in successful")
                EmailStorage.clear(this)
            }
            .addOnFailureListener { error ->
                Log.e(TAG, "Email link sign-in failed", error)
            }
    }

    private companion object {
        const val TAG = "EmailAuth"
    }
}

@Composable
fun TowTruckApp() {
    val navController = rememberNavController()
    val context = LocalContext.current
    val userPrefs = remember { UserPreferences(context) }

    NavHost(
        navController = navController,
        startDestination = "splash",
        modifier = Modifier.fillMaxSize()
    ) {
        composable("splash") { SplashScreen(navController) }
        composable("login") { LoginScreen(navController) }
        composable("register") { RegisterDriverScreen(navController) }
        composable("home") { HomeFlow(userPrefs = userPrefs) }
    }
}

@Composable
private fun HomeFlow(userPrefs: UserPreferences) {
    val context = LocalContext.current
    
    // Определяем начальный экран в зависимости от статуса регистрации
    val initialScreen = if (userPrefs.isRegistered) {
        "welcome_back"
    } else {
        "welcome"
    }
    
    var currentScreen by remember { mutableStateOf(initialScreen) }
    
    // Инициализация хранения настроек уведомлений (DataStore)
    LaunchedEffect(Unit) {
        com.towtruck.my111.ui.state.NotificationSettingsState.init(context)
        // Инициализация VerificationState с контекстом для загрузки сохраненного статуса
        VerificationState.initialize(context)
    }
    
    Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
        // Глобальная обработка системной кнопки/жеста "Назад":
        // с любого экрана возвращаем на Главную и не закрываем приложение
        BackHandler(enabled = true) {
            if (currentScreen != "main") {
                currentScreen = "main"
            } else {
                // На главной просто игнорируем back, чтобы не закрывать приложение
            }
        }
        when (currentScreen) {
            "welcome" -> WelcomeScreen(
                onStartVerification = {
                    currentScreen = "verification"
                },
                modifier = Modifier.padding(innerPadding)
            )
            "welcome_back" -> WelcomeBackScreen(
                userName = userPrefs.firstName.ifBlank { "Водитель" },
                onContinue = {
                    currentScreen = "main"
                },
                onResetRegistration = {
                    userPrefs.clearRegistration()
                    DriverNameState.updateDriverName("Водитель")
                    currentScreen = "welcome"
                },
                modifier = Modifier.padding(innerPadding)
            )
            "verification" -> VerificationScreen(
                onBack = {
                    currentScreen = "welcome"
                },
                onVerificationComplete = { firstName, lastName, phone, vehicleType ->
                    // Сохраняем данные регистрации локально
                    userPrefs.saveRegistrationData(firstName, lastName, phone, vehicleType)
                    DriverNameState.updateDriverName(firstName)
                    
                    // Сначала регистрируем пользователя в Firebase Auth
                    val email = "${phone}@driver.towtruck.com" // Используем телефон как email
                    val password = "driver123" // Простой пароль для водителей
                    
                    Log.d("REGISTER", "Регистрируем пользователя: $email")
                    
                    FirebaseAuth.getInstance().createUserWithEmailAndPassword(email, password)
                        .addOnCompleteListener { task ->
                            if (task.isSuccessful) {
                                Log.d("REGISTER", "✅ Пользователь успешно зарегистрирован")
                                
                                // Теперь можно вызывать registerDriver()
                                val registrationViewModel = RegistrationViewModel()
                                registrationViewModel.firstName = firstName
                                registrationViewModel.lastName = lastName
                                registrationViewModel.phoneNumber = phone
                                registrationViewModel.vehicleType = vehicleType
                                registrationViewModel.register()
                            } else {
                                Log.e("REGISTER", "❌ Ошибка регистрации пользователя: ${task.exception?.message}")
                                // Все равно переходим на главный экран, так как данные сохранены локально
                            }
                        }
                    
                    // Переходим на главный экран
                    currentScreen = "main"
                },
                modifier = Modifier.padding(innerPadding)
            )
            "main" -> MainScreen(
                driverName = userPrefs.firstName.ifEmpty { "Водитель" }, // Fallback имя
                driverRating = userPrefs.rating,
                userPrefs = userPrefs,
                modifier = Modifier.padding(innerPadding)
            )
            "success" -> SuccessScreen(
                onBackToWelcome = {
                    currentScreen = "main"
                },
                modifier = Modifier.padding(innerPadding)
            )
        }
    }
}

@Composable
fun SuccessScreen(
    onBackToWelcome: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                androidx.compose.ui.graphics.Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF1A1A1A),  // Темно-серый сверху
                        Color(0xFF2A2A2A)   // Чуть светлее снизу
                    )
                )
            )
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        // Красивая панель успеха
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(
                    elevation = 16.dp,
                    shape = RoundedCornerShape(24.dp),
                    ambientColor = Color(0xFF000000).copy(alpha = 0.3f),
                    spotColor = TowTruckOrange.copy(alpha = 0.2f)
                )
                .clip(RoundedCornerShape(24.dp))
                .background(
                    androidx.compose.ui.graphics.Brush.verticalGradient(
                        colors = listOf(
                            Color(0xFF3A3A3A).copy(alpha = 0.9f),
                            Color(0xFF2F2F2F).copy(alpha = 0.9f)
                        )
                    )
                )
                .border(
                    width = 1.dp,
                    color = Color(0xFF4A4A4A).copy(alpha = 0.6f),
                    shape = RoundedCornerShape(24.dp)
                )
                .padding(32.dp)
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "✅",
                    fontSize = 64.sp
                )
                
                Spacer(modifier = Modifier.height(24.dp))
                
                Text(
                    text = "Регистрация завершена!",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = TowTruckWhite,
                    modifier = androidx.compose.ui.Modifier.shadow(
                        elevation = 8.dp,
                        ambientColor = TowTruckOrange.copy(alpha = 0.3f)
                    )
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                Text(
                    text = "Ваша регистрация водителя была успешно отправлена. Мы рассмотрим вашу информацию и свяжемся с вами в ближайшее время.",
                    fontSize = 16.sp,
                    color = TowTruckTextSecondary,
                    textAlign = TextAlign.Center
                )
                
                Spacer(modifier = Modifier.height(32.dp))
                
                Button(
                    onClick = onBackToWelcome,
                    modifier = androidx.compose.ui.Modifier
                        .shadow(
                            elevation = 8.dp,
                            shape = RoundedCornerShape(20.dp),
                            ambientColor = TowTruckOrange.copy(alpha = 0.3f)
                        ),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = TowTruckOrange
                    ),
                    shape = RoundedCornerShape(20.dp)
                ) {
                    Text(
                        text = "Вернуться к Приветствию",
                        color = TowTruckWhite
                    )
                }
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
fun MainActivityPreview() {
    My111Theme {
        TowTruckApp()
    }
}
