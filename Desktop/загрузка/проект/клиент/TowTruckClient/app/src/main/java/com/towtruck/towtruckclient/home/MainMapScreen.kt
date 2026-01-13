package com.towtruck.towtruckclient.home

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Address
import android.location.Geocoder
import android.util.Log
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SheetValue
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.core.content.ContextCompat
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.Marker
import com.google.android.gms.maps.model.MarkerOptions
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.android.libraries.places.api.Places
import com.google.android.libraries.places.api.model.AutocompletePrediction
import com.google.android.libraries.places.api.model.AutocompleteSessionToken
import com.google.android.libraries.places.api.model.Place
import com.google.android.libraries.places.api.model.TypeFilter
import com.google.android.libraries.places.api.net.FetchPlaceRequest
import com.google.android.libraries.places.api.net.FindAutocompletePredictionsRequest
import com.google.maps.android.compose.CameraPositionState
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapEffect
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapType
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.rememberCameraPositionState
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import com.towtruck.towtruckclient.R
import com.towtruck.towtruckclient.data.PhoneStorage
import com.towtruck.towtruckclient.data.firestore.FirestoreOrdersRepository
import com.towtruck.towtruckclient.data.firestore.DriversRepository
import com.towtruck.towtruckclient.data.firestore.OnlineDriver
import com.towtruck.towtruckclient.data.model.OrderRequest
import com.towtruck.towtruckclient.ui.AddressPanel
import com.towtruck.towtruckclient.ui.BottomActionPanel
import com.towtruck.towtruckclient.ui.MapMarker
import com.towtruck.towtruckclient.ui.MarkerShadow
import com.towtruck.towtruckclient.ui.OrderBottomSheet
import com.towtruck.towtruckclient.ui.EvacuatorType
import com.towtruck.towtruckclient.ui.VehicleType
import com.towtruck.towtruckclient.ui.model.AddressSuggestion
import com.towtruck.towtruckclient.ui.RatingDialog
import java.util.Locale
import kotlin.math.roundToInt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainMapScreen(
    modifier: Modifier = Modifier,
    onSupportClick: () -> Unit = {},
    onProfileClick: () -> Unit = {},
    onMyLocationClick: () -> Unit = {}
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val geocoder = remember { Geocoder(context, Locale.getDefault()) }
    val snackbarHostState = remember { SnackbarHostState() }
    var isOrderSheetVisible by rememberSaveable { mutableStateOf(false) }
    var allowOrderSheetDismiss by rememberSaveable { mutableStateOf(false) }
    val firestore = remember {
        runCatching { Firebase.firestore }
            .onFailure { throwable ->
                Log.w(TAG, "Unable to obtain Firestore instance.", throwable)
            }
            .getOrNull()
    }
    val ordersRepository = remember(firestore) { FirestoreOrdersRepository(firestore) }
    val phoneStorage = remember(context) { PhoneStorage(context) }
    var isSubmittingOrder by remember { mutableStateOf(false) }
    val orderSheetState = rememberModalBottomSheetState(
        skipPartiallyExpanded = true,
        confirmValueChange = { target ->
            if (target == SheetValue.Hidden && !allowOrderSheetDismiss) {
                false
            } else {
                true
            }
        }
    )

    var dropoffQuery by rememberSaveable { mutableStateOf("") }
    var dropoffSuggestions by remember { mutableStateOf(emptyList<AddressSuggestion>()) }
    var dropoffSessionToken by remember { mutableStateOf(AutocompleteSessionToken.newInstance()) }
    var selectedVehicleType by rememberSaveable { mutableStateOf<VehicleType?>(null) }
    var selectedLockedWheels by rememberSaveable { mutableStateOf<Int?>(null) }
    var selectedEvacuator by rememberSaveable { mutableStateOf<EvacuatorType?>(null) }
    var savedPhoneDigits by rememberSaveable { mutableStateOf(phoneStorage.getPhoneDigits()) }
    var clientPhone by rememberSaveable {
        mutableStateOf(savedPhoneDigits?.let { formatDisplayPhone(it) } ?: "+7 ")
    }
    var pendingOrderRequest by remember { mutableStateOf<OrderRequest?>(null) }
    var pendingPhoneDigits by rememberSaveable { mutableStateOf("") }
    var isSmsDialogVisible by rememberSaveable { mutableStateOf(false) }
    var smsCodeInput by rememberSaveable { mutableStateOf("") }
    var smsErrorMessage by rememberSaveable { mutableStateOf<String?>(null) }
    var smsResendSeconds by rememberSaveable { mutableStateOf(0) }
    var smsResendSession by remember { mutableStateOf(0) }
    var smsExpireSession by remember { mutableStateOf(0) }
    var isVerifyingSms by remember { mutableStateOf(false) }
    var isPhonePromptVisible by rememberSaveable { mutableStateOf(false) }
    var phonePromptValue by rememberSaveable {
        mutableStateOf(savedPhoneDigits?.drop(1) ?: "")
    }
    var phonePromptError by rememberSaveable { mutableStateOf<String?>(null) }
    var overlayState by rememberSaveable { mutableStateOf(OrderOverlayState.Hidden) }
    var isWaitingForDriver by remember { mutableStateOf(false) }
    var currentOrderId by remember { mutableStateOf<String?>(null) }
    var activeOrderId by rememberSaveable { mutableStateOf<String?>(null) }
    var activeOrderLatLng by remember { mutableStateOf<LatLng?>(null) }
    val searchViewModel: SearchTowViewModel = viewModel()
    val nearbyDrivers by searchViewModel.drivers.collectAsState()
    val matchedDriver by searchViewModel.assignedDriver.collectAsState()
    var orderListener by remember { mutableStateOf<ListenerRegistration?>(null) }
    var showTracking by rememberSaveable { mutableStateOf(false) }
    var isRatingDialogVisible by rememberSaveable { mutableStateOf(false) }
    var ratingOrderId by rememberSaveable { mutableStateOf<String?>(null) }

    var isPlacesReady by rememberSaveable { mutableStateOf(Places.isInitialized()) }
    var isPlayServicesAvailable by rememberSaveable { mutableStateOf(true) }
    val googleApiAvailability = remember { GoogleApiAvailability.getInstance() }

    DisposableEffect(Unit) {
        onDispose {
            searchViewModel.stopSearching()
            orderListener?.remove()
        }
    }

    LaunchedEffect(Unit) {
        val serviceStatus = googleApiAvailability.isGooglePlayServicesAvailable(context)
        if (serviceStatus != ConnectionResult.SUCCESS) {
            isPlayServicesAvailable = false
            isPlacesReady = false
            Toast.makeText(context, R.string.google_play_services_required, Toast.LENGTH_LONG).show()
            return@LaunchedEffect
        }

        if (!isPlacesReady) {
            val appContext = context.applicationContext
            isPlacesReady = runCatching {
                Places.initialize(appContext, context.getString(R.string.google_maps_key))
                true
            }.getOrElse { throwable ->
                Log.w(TAG, "Places SDK failed to initialize.", throwable)
                Toast.makeText(context, R.string.google_play_services_required, Toast.LENGTH_LONG).show()
                false
            }
        }
    }

    val placesClient = remember(isPlacesReady) {
        if (isPlacesReady) Places.createClient(context) else null
    }

    val pins = remember { sampleDriverPins }
    val initialPin = remember(pins) { pins.firstOrNull { it.isClient } ?: pins.first() }

    var centerPosition by rememberSaveable { mutableStateOf(initialPin.position) }
    var pickupAddress by rememberSaveable { mutableStateOf("") }
    var hasLocationPermission by remember {
        mutableStateOf(checkLocationPermission(context))
    }
    val fusedLocationClient = remember { LocationServices.getFusedLocationProviderClient(context) }

    var isPickupFocused by remember { mutableStateOf(false) }
    var isDropoffFocused by remember { mutableStateOf(false) }
    var pickupPredictions by remember { mutableStateOf(emptyList<AddressSuggestion>()) }
    var pickupSessionToken by remember { mutableStateOf(AutocompleteSessionToken.newInstance()) }
    var hasPickupSelection by rememberSaveable { mutableStateOf(false) }
    var lastCameraMoveFromUser by remember { mutableStateOf(false) }

    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(centerPosition, 14f)
    }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        hasLocationPermission = granted
        if (granted) {
            coroutineScope.launch {
                moveCameraToCurrentLocation(
                    fusedLocationClient = fusedLocationClient,
                    cameraPositionState = cameraPositionState,
                    context = context,
                    onLocationCentered = onMyLocationClick,
                    onCenterPositionUpdate = { latLng -> centerPosition = latLng },
                    onPickupConfirmed = { hasPickupSelection = true }
                )
            }
        } else {
            Toast.makeText(context, R.string.location_permission_denied, Toast.LENGTH_SHORT).show()
        }
    }

    LaunchedEffect(cameraPositionState.isMoving) {
        if (!cameraPositionState.isMoving) {
            centerPosition = cameraPositionState.position.target
        }
    }

    LaunchedEffect(centerPosition) {
        if (isPickupFocused) return@LaunchedEffect
        val resolved = withContext(Dispatchers.IO) {
            runCatching {
                @Suppress("DEPRECATION")
                geocoder.getFromLocation(centerPosition.latitude, centerPosition.longitude, 1)
                    ?.firstOrNull()
                    ?.let { formatCompactAddress(it) }
            }.getOrNull()
        }
        if (!resolved.isNullOrBlank()) {
            pickupAddress = resolved
            hasPickupSelection = true
        } else if (pickupAddress.isBlank()) {
            pickupAddress = "${centerPosition.latitude.format()}, ${centerPosition.longitude.format()}"
            hasPickupSelection = true
        }
    }

    LaunchedEffect(isPickupFocused, pickupAddress, placesClient, isPlacesReady) {
        if (!isPickupFocused || pickupAddress.length < AUTOCOMPLETE_QUERY_MIN || placesClient == null) {
            pickupPredictions = emptyList()
            return@LaunchedEffect
        }

        val request = FindAutocompletePredictionsRequest.builder()
            .setSessionToken(pickupSessionToken)
            .setQuery(pickupAddress)
            .setTypeFilter(TypeFilter.ADDRESS)
                .build()

        pickupPredictions = runCatching {
            placesClient.findAutocompletePredictions(request).await().autocompletePredictions.map { it.toSuggestion() }
        }.getOrElse { throwable ->
            Log.w(TAG, "Failed to fetch pickup predictions.", throwable)
            Toast.makeText(context, R.string.address_suggestions_error, Toast.LENGTH_SHORT).show()
            emptyList()
        }
    }

    LaunchedEffect(dropoffQuery, placesClient, isPlacesReady, isOrderSheetVisible) {
        if (!isOrderSheetVisible) {
            dropoffSuggestions = emptyList()
            return@LaunchedEffect
        }
        if (!isPlacesReady || placesClient == null || dropoffQuery.length < AUTOCOMPLETE_QUERY_MIN) {
            dropoffSuggestions = emptyList()
            return@LaunchedEffect
        }
        val request = FindAutocompletePredictionsRequest.builder()
            .setSessionToken(dropoffSessionToken)
            .setTypeFilter(TypeFilter.ADDRESS)
            .setQuery(dropoffQuery)
            .build()
        dropoffSuggestions = runCatching {
            placesClient.findAutocompletePredictions(request).await().autocompletePredictions.map { it.toSuggestion() }
        }.getOrElse { throwable ->
            Log.w(TAG, "Failed to fetch drop-off predictions.", throwable)
            emptyList()
        }
    }


    fun handlePickupSuggestion(suggestion: AddressSuggestion) {
        if (!isPlacesReady || placesClient == null) {
            pickupAddress = suggestion.fullText
            isPickupFocused = false
            pickupPredictions = emptyList()
            hasPickupSelection = true
            return
        }

        coroutineScope.launch {
            val request = FetchPlaceRequest.builder(
                suggestion.placeId,
                listOf(Place.Field.ADDRESS, Place.Field.LAT_LNG)
            )
                .setSessionToken(pickupSessionToken)
                .build()

            runCatching { placesClient.fetchPlace(request).await() }
                .onSuccess { response ->
                    val place = response.place
                    pickupAddress = place.address ?: suggestion.fullText
                    place.latLng?.let { latLng ->
                        centerPosition = latLng
                        cameraPositionState.animate(
                            update = CameraUpdateFactory.newCameraPosition(
                                CameraPosition(latLng, 15f, 0f, 0f)
                            )
                        )
                    }
                    hasPickupSelection = true
                }
                .onFailure { throwable ->
                    Log.e(TAG, "Failed to resolve pickup suggestion.", throwable)
                    Toast.makeText(context, R.string.address_details_error, Toast.LENGTH_SHORT).show()
                    pickupAddress = suggestion.fullText
                }

            pickupSessionToken = AutocompleteSessionToken.newInstance()
            isPickupFocused = false
            pickupPredictions = emptyList()
            hasPickupSelection = true
        }
    }

    fun handleDropoffSuggestion(suggestion: AddressSuggestion) {
        dropoffQuery = suggestion.fullText
        dropoffSuggestions = emptyList()
        dropoffSessionToken = AutocompleteSessionToken.newInstance()
    }

    fun hideOrderSheet(after: suspend () -> Unit = {}) {
        coroutineScope.launch {
            allowOrderSheetDismiss = true
            runCatching { orderSheetState.hide() }
            allowOrderSheetDismiss = false
            isOrderSheetVisible = false
            dropoffSuggestions = emptyList()
            isPickupFocused = false
            after()
        }
    }

    fun cancelActiveOrder(firestore: FirebaseFirestore?) {
        val orderId = activeOrderId ?: return
        firestore?.collection("orders")
            ?.document(orderId)
            ?.update(mapOf("status" to "canceled", "assignedDriverId" to null))
        overlayState = OrderOverlayState.Hidden
        activeOrderId = null
        activeOrderLatLng = null
        searchViewModel.clearAssignment()
        searchViewModel.stopSearching()
    }

    fun startSmsVerification(request: OrderRequest, digits: String) {
        pendingOrderRequest = request
        pendingPhoneDigits = digits
        isSubmittingOrder = true
        smsCodeInput = ""
        smsErrorMessage = null
        isSmsDialogVisible = true
        isVerifyingSms = false
        smsResendSession++
        smsExpireSession++
        smsResendSeconds = SMS_RESEND_SECONDS
        Toast.makeText(context, "Тестовый код: $SMS_TEST_CODE", Toast.LENGTH_SHORT).show()
    }

    fun submitPendingOrder(request: OrderRequest) {
        coroutineScope.launch {
            isSubmittingOrder = false
            isVerifyingSms = false

            // ============================================================
            // 🔥 ПОЛНЫЙ КОД СОЗДАНИЯ ЗАКАЗА (КОПИРОВАТЬ ОТСЮДА)
            // ============================================================

            // 1. Данные заказа
            val orderData = hashMapOf(
                "driverId" to request.driverId,
                "status" to "pending",           // Статус для начала
                "address" to request.pickupAddress,
                "pickupCoordinates" to mapOf(
                    "lat" to request.pickupLatitude,
                    "lng" to request.pickupLongitude
                ),
                "createdAt" to FieldValue.serverTimestamp()
            )
            request.dropoffAddress?.let { orderData["dropoffAddress"] = it }
            request.vehicleType?.let { orderData["vehicleType"] = it }
            request.lockedWheels?.let { orderData["lockedWheels"] = it }
            request.evacuatorType?.let { orderData["evacuatorType"] = it }

            Log.d("DEBUG_TAG", "1. Начинаю отправку заказа...")

            // 2. ПОКАЗЫВАЕМ ЗАГРУЗКУ
            isWaitingForDriver = true
            Toast.makeText(context, "Отправка заявки...", Toast.LENGTH_SHORT).show()

            // 3. Отправляем в базу
            FirebaseFirestore.getInstance().collection("orders")
                .add(orderData)
                .addOnSuccessListener { docRef ->

                    Log.d("DEBUG_TAG", "2. Заказ успешно создан в базе! ID: ${docRef.id}")
                    Log.d("DEBUG_TAG", "3. Запускаю прослушку ответа...")

                    // Update app state for success
                    activeOrderId = docRef.id
                    activeOrderLatLng = LatLng(request.pickupLatitude, request.pickupLongitude)
                    currentOrderId = docRef.id
                    if (pendingPhoneDigits.length == PHONE_REQUIRED_LENGTH) {
                        phoneStorage.savePhoneDigits(pendingPhoneDigits)
                        savedPhoneDigits = pendingPhoneDigits
                        clientPhone = formatDisplayPhone(pendingPhoneDigits)
                        phonePromptValue = pendingPhoneDigits.drop(1)
                    }
                    pendingOrderRequest = null
                    pendingPhoneDigits = ""
                    isSmsDialogVisible = false
                    hasPickupSelection = true
                    dropoffQuery = ""
                    selectedVehicleType = null
                    selectedLockedWheels = null
                    selectedEvacuator = null
                    smsCodeInput = ""
                    hideOrderSheet()
                }
                .addOnFailureListener { e ->
                    isWaitingForDriver = false
                    pendingOrderRequest = null
                    isSmsDialogVisible = false
                    smsErrorMessage = null
                    smsCodeInput = ""
                    Log.e("DEBUG_TAG", "❌ Не удалось создать заказ: ${e.message}")
                    Toast.makeText(context, "Ошибка интернета", Toast.LENGTH_SHORT).show()
                }
        }
    }


    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(Color(0xFFB6E3FF), Color(0xFF78C1FF))
                )
            )
    ) {
        if (isPlayServicesAvailable) {
            val centerDescriptor = remember {
                BitmapDescriptorFactory.fromResource(R.drawable.ic_premium_pin)
            }
            var centerMarker by remember { mutableStateOf<Marker?>(null) }

            GoogleMap(
                modifier = Modifier.fillMaxSize(),
                cameraPositionState = cameraPositionState,
                properties = MapProperties(mapType = MapType.NORMAL, isBuildingEnabled = true),
                uiSettings = MapUiSettings(zoomControlsEnabled = false, myLocationButtonEnabled = false, compassEnabled = false)
            ) {
                MapEffect(centerPosition) { map ->
                    map.setOnCameraMoveStartedListener { reason ->
                        lastCameraMoveFromUser = reason == GoogleMap.OnCameraMoveStartedListener.REASON_GESTURE
                    }
                    map.setOnCameraIdleListener {
                        val target = map.cameraPosition.target
                        if (target.latitude != centerPosition.latitude || target.longitude != centerPosition.longitude) {
                            centerPosition = target
                        }
                        if (lastCameraMoveFromUser) {
                            hasPickupSelection = true
                        }
                        lastCameraMoveFromUser = false
                    }
                    runCatching {
                        centerMarker?.remove()
                        centerMarker = map.addMarker(
                            MarkerOptions()
                                .position(centerPosition)
                                .icon(centerDescriptor)
                                .anchor(0.5f, 1f)
                        )
                    }.onFailure { throwable ->
                        Log.e(TAG, "Unable to update center marker.", throwable)
                    }
                }
            }

            MarkerShadow(modifier = Modifier.align(Alignment.Center))
            MapMarker(modifier = Modifier.align(Alignment.Center))
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 32.dp),
                contentAlignment = Alignment.Center
            ) {
                Surface(
                    shape = RoundedCornerShape(24.dp),
                    tonalElevation = 6.dp,
                    color = Color.White.copy(alpha = 0.92f)
                ) {
                    Text(
                        text = stringResource(R.string.google_play_services_required),
                        style = MaterialTheme.typography.bodyLarge,
                        color = Color(0xFF1F2D5B),
                        modifier = Modifier.padding(24.dp)
                    )
                }
            }
        }

        Column(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(horizontal = 20.dp, vertical = 28.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            AddressPanel(
                pickupAddress = pickupAddress,
                pickupPredictions = pickupPredictions,
                isPickupFocused = isPickupFocused,
                onPickupQueryChange = {
                    pickupAddress = it
                    hasPickupSelection = false
                },
                onPickupFocusChange = { focused ->
                    isPickupFocused = focused
                    if (focused) {
                        pickupSessionToken = AutocompleteSessionToken.newInstance()
                        hasPickupSelection = false
                    }
                },
                onPickupSuggestionClick = ::handlePickupSuggestion
            )
        }

        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(top = 16.dp, bottom = 56.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                if (hasPickupSelection && isPlayServicesAvailable) {
                    ConfirmOrderButton(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            dropoffSessionToken = AutocompleteSessionToken.newInstance()
                            isOrderSheetVisible = true
                        }
                    )
                }

                BottomActionPanel(
                    modifier = Modifier
                        .fillMaxWidth(0.82f),
                    onSupportClick = onSupportClick,
                    onProfileClick = onProfileClick
                )
            }
        }

        FloatingActionButton(
            onClick = {
                if (!isPlayServicesAvailable) {
                    Toast.makeText(context, R.string.google_play_services_required, Toast.LENGTH_SHORT).show()
                    return@FloatingActionButton
                }
                hasLocationPermission = checkLocationPermission(context)
                if (hasLocationPermission) {
                    coroutineScope.launch {
                        moveCameraToCurrentLocation(
                            fusedLocationClient = fusedLocationClient,
                            cameraPositionState = cameraPositionState,
                            context = context,
                            onLocationCentered = onMyLocationClick,
                            onCenterPositionUpdate = { latLng ->
                                centerPosition = latLng
                            },
                            onPickupConfirmed = { hasPickupSelection = true }
                        )
                    }
                } else {
                    locationPermissionLauncher.launch(
                        arrayOf(
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                        )
                    )
                }
            },
            containerColor = Color.White,
            shape = CircleShape,
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .padding(end = 16.dp),
            elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 8.dp)
        ) {
            Icon(
                painter = painterResource(R.drawable.ic_my_location),
                contentDescription = stringResource(R.string.map_my_location),
                tint = Color(0xFF0057FF),
                modifier = Modifier.size(28.dp)
            )
        }

        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 120.dp)
        )

        if (isWaitingForDriver) {
            LoadingOverlay()
        }
    }

    val storedPhoneDigits = savedPhoneDigits
    val hasStoredPhone = storedPhoneDigits?.length == PHONE_REQUIRED_LENGTH
    val manualPhoneDigits = phonePromptValue.takeIf { it.length == PHONE_LOCAL_DIGITS }?.let { "7$it" }
    val normalizedPhoneDigits = storedPhoneDigits ?: manualPhoneDigits ?: pendingPhoneDigits.ifBlank { "7" }
    val isPhoneValid = hasStoredPhone || manualPhoneDigits != null
    val isOrderDetailsReady = hasPickupSelection &&
        pickupAddress.isNotBlank() &&
        dropoffQuery.isNotBlank() &&
        selectedVehicleType != null &&
        selectedLockedWheels != null &&
        selectedEvacuator != null
    val isOrderSubmitReady = isOrderDetailsReady

    if (isOrderSheetVisible) {
        OrderBottomSheet(
            sheetState = orderSheetState,
            pickupAddress = pickupAddress,
            pickupSuggestions = pickupPredictions,
            dropoffQuery = dropoffQuery,
            dropoffSuggestions = dropoffSuggestions,
            selectedVehicleType = selectedVehicleType,
            selectedLockedWheels = selectedLockedWheels,
            selectedEvacuator = selectedEvacuator,
            hasSavedPhone = hasStoredPhone,
            onChangePhoneClick = {
                savedPhoneDigits = null
                pendingPhoneDigits = ""
                clientPhone = "+7 "
                phonePromptValue = ""
                phonePromptError = null
                isPhonePromptVisible = true
            },
            isSubmitting = isSubmittingOrder,
            isSubmitEnabled = isOrderSubmitReady && !isSubmittingOrder,
            onPickupQueryChange = { value ->
                pickupAddress = value
                hasPickupSelection = false
            },
            onPickupSuggestionSelect = { suggestion ->
                handlePickupSuggestion(suggestion)
            },
            onPickupEditStart = {
                isPickupFocused = true
            },
            onPickupEditDone = {
                isPickupFocused = false
                if (pickupAddress.isNotBlank()) {
                    hasPickupSelection = true
                }
            },
            onDropoffQueryChange = { query ->
                dropoffQuery = query
            },
            onDropoffSuggestionSelect = { suggestion ->
                handleDropoffSuggestion(suggestion)
            },
            onVehicleTypeSelect = { selectedVehicleType = it },
            onLockedWheelSelect = { selectedLockedWheels = it },
            onEvacuatorSelect = { selectedEvacuator = it },
            onConfirm = {
                if (!isOrderDetailsReady) {
                    coroutineScope.launch {
                        snackbarHostState.showSnackbar(context.getString(R.string.order_submit_incomplete))
                    }
                    return@OrderBottomSheet
                }
                if (isSubmittingOrder) return@OrderBottomSheet
                val pickup = pickupAddress
                val currentCenter = centerPosition
                val orderRequest = OrderRequest(
                    pickupAddress = pickup,
                    pickupLatitude = currentCenter.latitude,
                    pickupLongitude = currentCenter.longitude,
                    dropoffAddress = dropoffQuery.takeIf { it.isNotBlank() },
                    vehicleType = selectedVehicleType?.label,
                    lockedWheels = selectedLockedWheels,
                    evacuatorType = selectedEvacuator?.label
                )
                pendingOrderRequest = orderRequest
                pendingPhoneDigits = normalizedPhoneDigits
                when {
                    hasStoredPhone -> {
                        // isSubmittingOrder = true 
                        // submitPendingOrder(orderRequest) // REMOVED: Don't submit yet
                        
                        // Instead, show driver list
                        hideOrderSheet {
                            overlayState = OrderOverlayState.Searching
                        }
                    }
                    manualPhoneDigits != null -> {
                        startSmsVerification(orderRequest, manualPhoneDigits)
                    }
                    else -> {
                        phonePromptError = null
                        isPhonePromptVisible = true
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Введите номер телефона, чтобы подтвердить заказ.")
                        }
                    }
                }
            },
            onDismiss = {
                // Keep sheet open until confirmation
            }
        )
    }

    LaunchedEffect(isSmsDialogVisible, smsResendSession) {
    if (isSmsDialogVisible) {
        val session = smsResendSession
            var remaining = SMS_RESEND_SECONDS
            smsResendSeconds = remaining
            while (remaining > 0 && isSmsDialogVisible && session == smsResendSession) {
                delay(1000)
                remaining--
                smsResendSeconds = remaining
            }
        }
    }

    LaunchedEffect(isSmsDialogVisible, smsExpireSession) {
        if (isSmsDialogVisible) {
            val session = smsExpireSession
            delay(SMS_EXPIRE_SECONDS * 1000L)
            if (isSmsDialogVisible && session == smsExpireSession) {
                isSmsDialogVisible = false
                pendingOrderRequest = null
                isSubmittingOrder = false
                isVerifyingSms = false
                smsCodeInput = ""
                smsErrorMessage = null
                snackbarHostState.showSnackbar("Код не введён за 2 минуты. Заказ отменён.")
            }
        }
    }

    LaunchedEffect(overlayState, activeOrderLatLng, centerPosition) {
        if (overlayState == OrderOverlayState.Searching) {
            val target = activeOrderLatLng ?: centerPosition
            searchViewModel.startSearching(
                clientLat = target.latitude,
                clientLng = target.longitude
            )
        } else {
            searchViewModel.stopSearching()
        }
    }

    LaunchedEffect(overlayState, activeOrderId) {
        orderListener?.remove()
        orderListener = null
        val orderId = activeOrderId
        if (overlayState != OrderOverlayState.Hidden && orderId != null && firestore != null) {
            orderListener = firestore.collection("orders")
                .document(orderId)
                .addSnapshotListener { snapshot, error ->
                    if (error != null) return@addSnapshotListener
                    val assignedId = snapshot?.getString("assignedDriverId")
                    val status = snapshot?.getString("status")
                    
                    if (status == "completed") {
                         ratingOrderId = orderId
                         activeOrderId = null
                         activeOrderLatLng = null
                         overlayState = OrderOverlayState.Hidden
                         searchViewModel.clearAssignment()
                         searchViewModel.stopSearching()
                         isRatingDialogVisible = true
                    } else if (!assignedId.isNullOrBlank() && status == "assigned") {
                        coroutineScope.launch {
                            val driver = DriversRepository.getDriver(assignedId)
                            driver?.let { searchViewModel.assignDriver(it) }
                            overlayState = OrderOverlayState.DriverFound
                        }
                    }
                }
        }
    }

    if (isRatingDialogVisible && ratingOrderId != null) {
        RatingDialog(
            onDismiss = {
                isRatingDialogVisible = false
                ratingOrderId = null
            },
            onSubmit = { rating, comment ->
                coroutineScope.launch {
                    ratingOrderId?.let { id ->
                        ordersRepository.submitRating(id, rating, comment)
                    }
                    isRatingDialogVisible = false
                    ratingOrderId = null
                    Toast.makeText(context, "Спасибо за оценку!", Toast.LENGTH_SHORT).show()
                }
            }
        )
    }

    if (isSmsDialogVisible && pendingPhoneDigits.isNotBlank()) {
        SmsVerificationDialog(
            phone = formatDisplayPhone(pendingPhoneDigits),
            code = smsCodeInput,
            error = smsErrorMessage,
            resendSeconds = smsResendSeconds,
            isProcessing = isVerifyingSms,
            onCodeChange = {
                smsCodeInput = it.filter { char -> char.isDigit() }.take(SMS_CODE_LENGTH)
                smsErrorMessage = null
            },
            onResend = {
                if (smsResendSeconds == 0) {
                    smsResendSession++
                    Toast.makeText(context, "Тестовый код: $SMS_TEST_CODE", Toast.LENGTH_SHORT).show()
                }
            },
            onSubmit = {
                if (smsCodeInput.length < SMS_CODE_LENGTH) {
                    smsErrorMessage = "Введите код полностью"
                } else if (!isVerifyingSms) {
                    smsErrorMessage = null
                    isVerifyingSms = true
                    coroutineScope.launch {
                        delay(500)
                        if (smsCodeInput == SMS_TEST_CODE) {
                            pendingOrderRequest?.let { submitPendingOrder(it) } ?: run {
                                isVerifyingSms = false
                                isSmsDialogVisible = false
                                isSubmittingOrder = false
                            }
                        } else {
                            isVerifyingSms = false
                            smsErrorMessage = "Неверный код. Попробуйте ещё раз."
                        }
                    }
                }
            },
            onDismiss = {
                isSmsDialogVisible = false
                pendingOrderRequest = null
                isSubmittingOrder = false
                isVerifyingSms = false
                smsErrorMessage = null
                smsCodeInput = ""
            }
        )
    }

    when (overlayState) {
        OrderOverlayState.Searching -> {
            SearchingTowScreen(
                viewModel = searchViewModel,
                onCancel = { cancelActiveOrder(firestore) },
                onDispatcherCall = {
                    overlayState = OrderOverlayState.Hidden
                    onSupportClick()
                },
                onDriverSelect = { selectedDriver ->
                    // Клиент выбрал водителя
                    // searchViewModel.assignDriver(selectedDriver) // REMOVED: Don't assign locally yet
                    
                    // Create order with this driver
                    val request = pendingOrderRequest
                    if (request != null) {
                        val requestWithDriver = request.copy(driverId = selectedDriver.driverId)
                        submitPendingOrder(requestWithDriver)
                        overlayState = OrderOverlayState.Hidden // Hide list, waiting UI will show
                    } else {
                         // Should not happen if flow is correct, but handle fallback
                         Log.e(TAG, "Pending order request is null on driver select")
                    }
                }
            )
        }
        OrderOverlayState.DriverFound -> {
            matchedDriver?.let { driver ->
                DriverFoundScreen(
                    driver = driver,
                    onTrackOnMap = {
                        overlayState = OrderOverlayState.Hidden
                        showTracking = true
                    },
                    onCallDriver = {
                        runCatching {
                            val phone = driver.phoneNumber
                            if (phone.isNotBlank()) {
                                val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone"))
                                context.startActivity(intent)
                            }
                        }
                    },
                    onCallDispatcher = {
                        overlayState = OrderOverlayState.Hidden
                        onSupportClick()
                    }
                )
            }
        }
        else -> Unit
    }

    if (isPhonePromptVisible) {
        PhoneNumberDialog(
            value = phonePromptValue,
            error = phonePromptError,
            onValueChange = {
                phonePromptValue = it.filter { char -> char.isDigit() }
                    .take(PHONE_LOCAL_DIGITS)
                phonePromptError = null
            },
            onConfirm = {
                if (phonePromptValue.length == PHONE_LOCAL_DIGITS) {
                    val digits = "7${phonePromptValue}"
                    savedPhoneDigits = null
                    clientPhone = formatDisplayPhone(digits)
                    phonePromptError = null
                    isPhonePromptVisible = false
                    pendingPhoneDigits = digits
                    pendingOrderRequest?.let { startSmsVerification(it, digits) }
                } else {
                    phonePromptError = "Введите полный номер"
                }
            },
            onDismiss = {
                isPhonePromptVisible = false
                phonePromptError = null
                pendingOrderRequest = null
            }
        )
    }

    // Получаем контекст (нужен для показа сообщения)
    val contextForToast = LocalContext.current

    DisposableEffect(currentOrderId) {
        var listener: ListenerRegistration? = null

        if (currentOrderId != null) {
            val docRef = FirebaseFirestore.getInstance().collection("orders").document(currentOrderId!!)

            listener = docRef.addSnapshotListener { snapshot, e ->
                if (e != null) return@addSnapshotListener

                if (snapshot != null && snapshot.exists()) {
                    val status = snapshot.getString("status")

                    // --- ВАРИАНТ: ОТКАЗ ---
                    if (status == "rejected" || status == "searching") {

                        // 1. Показываем сообщение (ВАЖНО: До закрытия переменных)
                        Toast.makeText(contextForToast, "⚠️ Водитель отклонил заявку", Toast.LENGTH_LONG).show()

                        // 2. Закрываем шторку и сбрасываем ID
                        isWaitingForDriver = false
                        currentOrderId = null
                    }

                    // --- ВАРИАНТ: ПРИНЯТО ---
                    else if (status == "accepted") {
                        Toast.makeText(contextForToast, "✅ Водитель едет!", Toast.LENGTH_SHORT).show()

                        isWaitingForDriver = false
                        currentOrderId = null

                        // Тут будет переход на карту (пока закомментирован, чтобы не было ошибок)
                        // val intent = Intent(context, TrackDriverActivity::class.java)
                        // intent.putExtra("ORDER_ID", docRef.id)
                        // context.startActivity(intent)
                    }
                }
            }
        }

        onDispose {
            listener?.remove()
        }
    }

    // Экран отслеживания водителя
    if (showTracking && matchedDriver != null && activeOrderLatLng != null) {
        TrackingScreen(
            driver = matchedDriver!!,
            clientLocation = activeOrderLatLng!!,
            firestore = firestore,
            onBack = {
                showTracking = false
            },
            onCallDriver = {
                runCatching {
                    val phone = matchedDriver!!.phoneNumber
                    if (phone.isNotBlank()) {
                        val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone"))
                        context.startActivity(intent)
                    }
                }
            }
        )
    }
}

@Composable
private fun ConfirmOrderButton(
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        modifier = modifier
            .height(56.dp)
            .clickable(onClick = onClick)
            .clip(RoundedCornerShape(24.dp)),
        color = Color.Transparent
    ) {
        Box(
            modifier = Modifier
                .background(Brush.horizontalGradient(listOf(Color(0xFFFF8A65), Color(0xFFFFB199))))
                .fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = stringResource(R.string.place_order_button),
                color = Color.White,
                style = MaterialTheme.typography.titleMedium
            )
        }
    }
}

@Composable
private fun SmsVerificationDialog(
    phone: String,
    code: String,
    error: String?,
    resendSeconds: Int,
    isProcessing: Boolean,
    onCodeChange: (String) -> Unit,
    onResend: () -> Unit,
    onSubmit: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Подтверждение телефона") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = "Введите код из SMS, отправленный на номер:",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFF4A5568)
                )
                Text(
                    text = phone,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                SmsCodeInput(
                    value = code,
                    length = SMS_CODE_LENGTH,
                    onValueChange = onCodeChange
                )
                error?.let {
                    Text(text = it, color = Color(0xFFFF6B6B), style = MaterialTheme.typography.bodySmall)
                }
                if (resendSeconds > 0) {
                    Text(
                        text = "Отправить код повторно через $resendSeconds секунд",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF8D96B2)
                    )
                } else {
                    TextButton(onClick = onResend) {
                        Text("Отправить код повторно")
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onSubmit,
                enabled = !isProcessing && code.length == SMS_CODE_LENGTH
            ) {
                if (isProcessing) {
                    CircularProgressIndicator(
                        color = Color.White,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(20.dp)
                    )
                } else {
                    Text("Подтвердить")
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Отмена")
            }
        }
    )
}

@Composable
private fun SmsCodeInput(
    value: String,
    length: Int,
    onValueChange: (String) -> Unit
) {
    val focusManager = LocalFocusManager.current
    BasicTextField(
        value = value,
        onValueChange = {
            val filtered = it.filter(Char::isDigit).take(length)
            onValueChange(filtered)
            if (filtered.length == length) {
                focusManager.clearFocus()
            }
        },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
        cursorBrush = SolidColor(Color.Transparent),
        textStyle = TextStyle(color = Color.Transparent),
        decorationBox = {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                repeat(length) { index ->
                    val digit = value.getOrNull(index)?.toString() ?: ""
                    Box(
                        modifier = Modifier
                            .size(width = 56.dp, height = 64.dp)
                            .clip(RoundedCornerShape(18.dp))
                            .background(Color(0xFFF1F3F9)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = digit,
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = Color(0xFF1F2D5B)
                        )
                    }
                }
            }
        }
    )
}

@Composable
private fun PhoneNumberDialog(
    value: String,
    error: String?,
    onValueChange: (String) -> Unit,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Введите номер телефона") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = "Номер нужен, чтобы подтвердить заказ и связаться с водителем.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFF4A5568)
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "+7",
                        modifier = Modifier.padding(end = 8.dp),
                        style = MaterialTheme.typography.titleMedium
                    )
                    OutlinedTextField(
                        value = value,
                        onValueChange = onValueChange,
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        shape = RoundedCornerShape(18.dp),
                        textStyle = LocalTextStyle.current.copy(
                            textAlign = TextAlign.Start,
                            textDirection = TextDirection.ContentOrLtr
                        )
                    )
                }
                error?.let {
                    Text(text = it, color = Color(0xFFFF6B6B), style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            Button(onClick = onConfirm) {
                Text("Продолжить")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Отмена")
            }
        }
    )
}

@Composable
private fun OrderStatusOverlay(
    state: OrderOverlayState,
    drivers: List<OnlineDriver>,
    matchedDriver: OnlineDriver?,
    onCancel: () -> Unit,
    onCallDispatcher: () -> Unit,
    onTrack: () -> Unit,
    onCallDriver: (String) -> Unit,
    onDismiss: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.65f))
            .padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        val rotation = rememberInfiniteTransition(label = "searchIndicator")
            .animateFloat(
                initialValue = 0f,
                targetValue = 360f,
                animationSpec = infiniteRepeatable(
                    animation = tween(durationMillis = 1400, easing = LinearEasing),
                    repeatMode = RepeatMode.Restart
                ),
                label = "rotation"
            ).value

        Surface(
            shape = RoundedCornerShape(36.dp),
            color = Color(0xFF0E1017),
            tonalElevation = 0.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .padding(horizontal = 28.dp, vertical = 32.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp)
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(18.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (state == OrderOverlayState.Searching) {
                        Box(
                            modifier = Modifier
                                .size(26.dp)
                                .rotate(rotation)
                                .border(2.dp, Color.Transparent, CircleShape)
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.fillMaxSize(),
                                color = Color(0xFFFFAA3B),
                                strokeWidth = 3.dp
                            )
                        }
                    } else {
                        Box(
                            modifier = Modifier
                                .size(18.dp)
                                .background(Color(0xFF00D184), CircleShape)
                        )
                    }
                    Column {
                        Text(
                            text = if (state == OrderOverlayState.Searching)
                                "Ищем свободные эвакуаторы рядом"
                            else
                                "Эвакуатор найден!",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = if (state == OrderOverlayState.Searching)
                                "Это займёт не больше пары минут. Мы уведомим, когда примет заказ."
                            else
                                matchedDriver?.let {
                                    "${it.name} • ⭐ ${String.format(Locale.getDefault(), "%.1f", it.rating)}\n${it.vehicleBrand} ${it.vehicleType}\nПрибудет через ~${estimateEta(it.distanceKm)} минут."
                                } ?: "Подтверждаем назначение эвакуатора…",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFFB5BED3)
                        )
                    }
                }

                if (state == OrderOverlayState.Searching) {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(
                            text = "Свободные эвакуаторы поблизости",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFF808AA8)
                        )
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            drivers.forEach { driver ->
                                AnimatedVisibility(
                                    visible = true,
                                    enter = fadeIn(tween(300)) + slideInVertically(initialOffsetY = { it / 2 })
                                ) {
                                    DriverRow(driver)
                                }
                            }
                            if (drivers.size < 2) {
                                Text(
                                    text = "Ищем эвакуаторы чуть дальше…",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFF808AA8)
                                )
                            }
                        }
                    }
                }

                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    GradientActionButton(
                        text = if (state == OrderOverlayState.Searching) "Отменить заказ" else "Отслеживать на карте",
                        onClick = {
                            if (state == OrderOverlayState.Searching) {
                                onCancel()
                            } else {
                                onTrack()
                            }
                        }
                    )
                    OutlinedActionButton(
                        text = if (state == OrderOverlayState.Searching) "Позвонить диспетчеру" else "Позвонить водителю",
                        enabled = state != OrderOverlayState.DriverFound || (matchedDriver?.phoneNumber?.isNotBlank() == true),
                        onClick = {
                            if (state == OrderOverlayState.Searching) {
                                onCallDispatcher()
                            } else {
                                matchedDriver?.phoneNumber?.takeIf { it.isNotBlank() }?.let(onCallDriver)
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun GradientActionButton(text: String, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(54.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
        contentPadding = PaddingValues(),
        shape = RoundedCornerShape(22.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.horizontalGradient(
                        listOf(Color(0xFFFF7A00), Color(0xFFFFB347))
                    ),
                    shape = RoundedCornerShape(22.dp)
                ),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = text,
                color = Color.White,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
private fun OutlinedActionButton(
    text: String,
    onClick: () -> Unit,
    enabled: Boolean = true
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier
            .fillMaxWidth()
            .height(54.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
        contentPadding = PaddingValues(),
        shape = RoundedCornerShape(22.dp),
        border = BorderStroke(1.dp, Color(0xFFFF8C00))
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Transparent, shape = RoundedCornerShape(22.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = text,
                color = Color.White,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun DriverRow(driver: OnlineDriver) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = Icons.Outlined.LocalShipping,
                contentDescription = null,
                tint = Color(0xFFFF9A3B),
                modifier = Modifier.size(24.dp)
            )
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = driver.name,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "⭐ ${String.format(Locale.getDefault(), "%.1f", driver.rating)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFFFFC107)
                    )
                    Text(
                        text = "•",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF808AA8)
                    )
                    Text(
                        text = driver.vehicleBrand,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFFB5BED3)
                    )
                }
                Text(
                    text = driver.vehicleType,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF808AA8)
                )
            }
        }
        val distanceText = if (driver.distanceKm > 0.0) {
            String.format(Locale.getDefault(), "%.1f км", driver.distanceKm)
        } else {
            "—"
        }
        Text(
            text = distanceText,
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFFB5BED3)
        )
    }
}

private fun formatCompactAddress(address: Address): String? {
    val city = address.locality?.takeIf { it.isNotBlank() }
        ?: address.subAdminArea?.takeIf { it.isNotBlank() }
        ?: address.adminArea?.takeIf { it.isNotBlank() }

    val streetCandidate = address.thoroughfare?.takeIf { it.isNotBlank() }?.let(::normalizeStreetName)
    val street = streetCandidate?.takeUnless { city != null && it.equals(city, ignoreCase = true) }
        ?: address.subLocality?.takeIf { it.isNotBlank() && !it.equals(city, ignoreCase = true) }

    val house = address.subThoroughfare?.takeIf { it.isNotBlank() }?.let(::normalizeHouseNumber)
        ?: address.premises
            ?.takeIf { it.isNotBlank() && it.any(Char::isDigit) }
            ?.let(::normalizeHouseNumber)

    val parts = mutableListOf<String>()
    if (city != null) parts += city
    if (street != null) parts += street
    if (house != null) parts += house

    if (parts.isNotEmpty()) return parts.joinToString(", ")
    return address.getAddressLine(0)
}

private fun normalizeStreetName(raw: String): String {
    val trimmed = raw.trim()
    if (trimmed.isEmpty()) return trimmed

    STREET_PREFIX_PATTERNS.forEach { (regex, replacement) ->
        if (regex.containsMatchIn(trimmed)) {
            val remainder = regex.replace(trimmed, "").trim()
            return if (remainder.isEmpty()) {
                replacement
            } else {
                "$replacement ${capitalizeWords(remainder)}"
            }
        }
    }

    return capitalizeWords(trimmed)
}

private fun normalizeHouseNumber(raw: String): String {
    val trimmed = raw.trim()
    if (trimmed.isEmpty()) return trimmed
    val cleaned = HOUSE_PREFIX_PATTERN.replace(trimmed, "").trim()
    return cleaned.ifEmpty { trimmed }
}

private fun capitalizeWords(value: String): String =
    value.split(Regex("\\s+"))
        .filter { it.isNotEmpty() }
        .joinToString(" ") { word ->
            word.replaceFirstChar { ch ->
                if (ch.isLowerCase()) ch.titlecase(Locale.getDefault()) else ch.toString()
            }
        }

private val STREET_PREFIX_PATTERNS = listOf(
    Regex("(?i)^улица\\s+") to "ул.",
    Regex("(?i)^ул\\.?\\s+") to "ул.",
    Regex("(?i)^просп(ект)?\\.?\\s+") to "просп.",
    Regex("(?i)^пр-т\\s+") to "просп.",
    Regex("(?i)^площадь\\s+") to "пл.",
    Regex("(?i)^пл\\.?\\s+") to "пл.",
    Regex("(?i)^бульвар\\s+") to "бул.",
    Regex("(?i)^бул\\.?\\s+") to "бул.",
    Regex("(?i)^шоссе\\s+") to "ш.",
    Regex("(?i)^ш\\.?\\s+") to "ш.",
    Regex("(?i)^набережная\\s+") to "наб.",
    Regex("(?i)^наб\\.?\\s+") to "наб."
)

private val HOUSE_PREFIX_PATTERN = Regex("(?i)^(дом|д\\.?|house)\\s+")

private data class DriverPin(
    val position: LatLng,
    val isClient: Boolean = false
)

private val sampleDriverPins = listOf(
    DriverPin(LatLng(55.7708, 37.6328)),
    DriverPin(LatLng(55.7805, 37.6003)),
    DriverPin(LatLng(55.7585, 37.6521)),
    DriverPin(LatLng(55.7452, 37.5904)),
    DriverPin(LatLng(55.7522, 37.5750)),
    DriverPin(LatLng(55.7580, 37.6155), isClient = true)
)

private fun Double.format(): String = String.format(Locale.getDefault(), "%.5f", this)

private fun AutocompletePrediction.toSuggestion(): AddressSuggestion =
    AddressSuggestion(
        placeId = placeId,
        primaryText = getPrimaryText(null).toString(),
        secondaryText = getSecondaryText(null)?.toString()
    )

private fun checkLocationPermission(context: Context): Boolean {
    val fineGranted = ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACCESS_FINE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
    val coarseGranted = ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACCESS_COARSE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
    return fineGranted || coarseGranted
}

private suspend fun moveCameraToCurrentLocation(
    fusedLocationClient: FusedLocationProviderClient,
    cameraPositionState: CameraPositionState,
    context: Context,
    onLocationCentered: () -> Unit,
    onCenterPositionUpdate: (LatLng) -> Unit,
    onPickupConfirmed: () -> Unit = {}
) {
    val locationLatLng = withContext(Dispatchers.IO) {
        runCatching {
            fusedLocationClient.lastLocation.await()
        }.getOrNull() ?: runCatching {
            val cancellationTokenSource = CancellationTokenSource()
            fusedLocationClient.getCurrentLocation(
                Priority.PRIORITY_HIGH_ACCURACY,
                cancellationTokenSource.token
            ).await()
        }.getOrNull()
    }?.let { location -> LatLng(location.latitude, location.longitude) }

    if (locationLatLng != null) {
        onCenterPositionUpdate(locationLatLng)
        runCatching {
            cameraPositionState.animate(
                update = CameraUpdateFactory.newCameraPosition(
                    CameraPosition(locationLatLng, 16f, 0f, 0f)
                )
            )
        }.onFailure { throwable ->
            Log.w(TAG, "Failed to animate camera to user location.", throwable)
        }
        onLocationCentered()
        onPickupConfirmed()
    } else {
        Toast.makeText(context, R.string.location_unavailable, Toast.LENGTH_SHORT).show()
    }
}

@Composable
fun LoadingOverlay() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.5f))
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() }
            ) {}
            .zIndex(10f),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .background(Color.White, shape = RoundedCornerShape(16.dp))
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            CircularProgressIndicator(
                color = Color(0xFFFF9800),
                modifier = Modifier.size(48.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Ждем подтверждения...",
                color = Color.Black,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
        }
    }
}

private const val TAG = "MainMapScreen"
private const val AUTOCOMPLETE_QUERY_MIN = 3

private fun String.toPhoneDigits(): String = sanitizePhoneDigits(this)

private fun formatPhoneInput(input: String): String {
    val digits = sanitizePhoneDigits(input)
    val builder = StringBuilder("+7 ")
    digits.drop(1).forEachIndexed { index, c ->
        when (index) {
            0 -> builder.append('(')
            3 -> builder.append(") ")
            6, 8 -> builder.append('-')
        }
        builder.append(c)
    }
    return builder.toString().trim()
}

private fun formatDisplayPhone(digits: String): String {
    if (digits.length < 2) return "+7"
    val builder = StringBuilder("+7 ")
    digits.drop(1).forEachIndexed { index, c ->
        when (index) {
            0 -> builder.append('(')
            3 -> builder.append(") ")
            6, 8 -> builder.append('-')
        }
        builder.append(c)
    }
    return builder.toString()
}

private fun sanitizePhoneDigits(value: String): String {
    val digits = value.filter { it.isDigit() }
    val normalized = when {
        digits.startsWith("7") -> digits
        digits.startsWith("8") -> "7" + digits.drop(1)
        digits.isEmpty() -> "7"
        else -> "7$digits"
    }
    return normalized.take(PHONE_REQUIRED_LENGTH)
}

private const val PHONE_REQUIRED_LENGTH = 11
private const val PHONE_LOCAL_DIGITS = PHONE_REQUIRED_LENGTH - 1
private const val SMS_CODE_LENGTH = 4
private const val SMS_RESEND_SECONDS = 30
private const val SMS_EXPIRE_SECONDS = 120
private const val SMS_TEST_CODE = "1234"

private enum class OrderOverlayState {
    Hidden,
    Searching,
    DriverFound
}

private fun estimateEta(distanceKm: Double): Int =
    distanceKm.takeIf { it > 0 }?.times(4)?.roundToInt()?.coerceAtLeast(5) ?: 10
