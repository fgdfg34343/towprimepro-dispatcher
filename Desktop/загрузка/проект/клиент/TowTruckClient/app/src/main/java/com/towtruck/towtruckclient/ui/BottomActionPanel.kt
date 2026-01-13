package com.towtruck.towtruckclient.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.  matchParentSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.ripple.rememberRipple
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.towtruck.towtruckclient.R

@Composable
fun BottomActionPanel(
    modifier: Modifier = Modifier,
    onSupportClick: () -> Unit,
    onProfileClick: () -> Unit
) {
    val shape = RoundedCornerShape(24.dp)
    Box(
        modifier = modifier
            .shadow(
                elevation = 24.dp,
                shape = shape,
                spotColor = Color.Black.copy(alpha = 0.1f),
                ambientColor = Color.Black.copy(alpha = 0.08f)
            )
            .clip(shape)
    ) {
        GlassBackground()

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            ActionButton(
                modifier = Modifier.weight(1f),
                label = stringResource(R.string.support_action_label),
                labelColor = Color(0xFF1A237E),
                icon = Icons.AutoMirrored.Outlined.Chat,
                iconTint = Color.White,
                iconBrush = Brush.linearGradient(listOf(Color(0xFF667EEA), Color(0xFF764BA2))),
                activeIconBrush = Brush.linearGradient(listOf(Color(0xFF5B6FF1), Color(0xFF6F52B0))),
                onClick = onSupportClick
            )

            ActionButton(
                modifier = Modifier.weight(1f),
                label = stringResource(R.string.profile_action_label),
                labelColor = Color(0xFF263238),
                icon = Icons.Outlined.Person,
                iconTint = Color(0xFF263238),
                iconBrush = Brush.linearGradient(listOf(Color(0xFFE2E7EB), Color(0xFFD2D8DC))),
                activeIconBrush = Brush.linearGradient(listOf(Color(0xFF90A4AE), Color(0xFF263238))),
                onClick = onProfileClick
            )
        }
    }
}

@Composable
private fun BoxScope.GlassBackground() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White.copy(alpha = 0.9f))
    )
    Box(
        modifier = Modifier
            .fillMaxSize()
            .blur(18.dp)
            .background(Color.White.copy(alpha = 0.18f))
    )
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(Color.White.copy(alpha = 0.22f), Color.Transparent)
                )
            )
    )
}

@Composable
private fun ActionButton(
    modifier: Modifier = Modifier,
    label: String,
    labelColor: Color,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    iconTint: Color,
    iconBrush: Brush,
    activeIconBrush: Brush,
    onClick: () -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) 0.95f else 1f,
        label = "action_button_scale"
    )
    val glowAlpha by animateFloatAsState(
        targetValue = if (pressed) 0.2f else 0f,
        label = "action_button_glow"
    )
    val brush = if (pressed) activeIconBrush else iconBrush

    Box(
        modifier = modifier
            .scale(scale)
            .clip(RoundedCornerShape(20.dp))
            .clickable(
                interactionSource = interactionSource,
                indication = rememberRipple(
                    bounded = true,
                    color = iconTint.copy(alpha = 0.18f)
                ),
                onClick = onClick
            )
            .padding(vertical = 18.dp),
        contentAlignment = Alignment.Center
    ) {
        if (glowAlpha > 0f) {
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .background(
                        Brush.radialGradient(
                            colors = listOf(iconTint.copy(alpha = glowAlpha), Color.Transparent)
                        )
                    )
            )
        }

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(brush, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = label,
                    tint = iconTint
                )
            }
            Text(
                text = label,
                color = labelColor,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}
