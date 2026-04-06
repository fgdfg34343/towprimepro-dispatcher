export default function TruckIllustration({ className = '' }) {
  return (
    <div className={`truck-3d-container ${className}`}>
      <div className="animate-float relative">
        <svg viewBox="0 0 520 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-2xl">
          <defs>
            <linearGradient id="truckBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e293b"/>
              <stop offset="100%" stopColor="#0f172a"/>
            </linearGradient>
            <linearGradient id="cabGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#334155"/>
              <stop offset="100%" stopColor="#1e293b"/>
            </linearGradient>
            <linearGradient id="platformGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#475569"/>
              <stop offset="100%" stopColor="#334155"/>
            </linearGradient>
            <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f97316"/>
              <stop offset="100%" stopColor="#ea580c"/>
            </linearGradient>
            <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.9"/>
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.7"/>
            </linearGradient>
            <linearGradient id="wheelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#475569"/>
              <stop offset="100%" stopColor="#1e293b"/>
            </linearGradient>
            <linearGradient id="carBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#dc2626"/>
              <stop offset="100%" stopColor="#b91c1c"/>
            </linearGradient>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="4" dy="8" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.4"/>
            </filter>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <radialGradient id="headlightGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a"/>
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.5"/>
            </radialGradient>
          </defs>

          {/* Ground shadow */}
          <ellipse cx="260" cy="295" rx="200" ry="18" fill="#0f172a" opacity="0.12" className="animate-float-shadow"/>

          {/* Main truck platform/body */}
          <g filter="url(#shadow)">
            {/* Platform bed - bottom perspective */}
            <path d="M80 200 L400 200 L420 215 L60 215 Z" fill="url(#platformGrad)"/>
            {/* Platform top surface */}
            <rect x="80" y="155" width="320" height="45" rx="3" fill="url(#platformGrad)"/>
            {/* Platform rails */}
            <rect x="80" y="153" width="320" height="5" rx="2" fill="url(#orangeGrad)"/>
            <rect x="80" y="197" width="320" height="3" fill="#334155"/>

            {/* Side rails on platform */}
            <rect x="80" y="155" width="6" height="45" rx="2" fill="#64748b"/>
            <rect x="394" y="155" width="6" height="45" rx="2" fill="#64748b"/>

            {/* Platform cross ribs */}
            {[120, 160, 200, 240, 280, 320, 360].map((x, i) => (
              <rect key={i} x={x} y="158" width="3" height="39" rx="1" fill="#3d506b" opacity="0.6"/>
            ))}

            {/* Hook/winch at back */}
            <rect x="82" y="165" width="20" height="14" rx="3" fill="#f97316"/>
            <circle cx="92" cy="172" r="5" fill="#ea580c"/>
            <circle cx="92" cy="172" r="2.5" fill="#fed7aa"/>

            {/* Car on platform */}
            <g transform="translate(150, 95)">
              {/* Car body */}
              <path d="M20 60 L170 60 L185 72 L5 72 Z" fill="url(#carBodyGrad)" opacity="0.9"/>
              <rect x="20" y="30" width="150" height="32" rx="2" fill="url(#carBodyGrad)" opacity="0.9"/>
              {/* Car roof */}
              <path d="M50 30 L130 30 L148 10 L32 10 Z" fill="#b91c1c" opacity="0.85"/>
              {/* Car glass */}
              <path d="M55 28 L125 28 L140 12 L40 12 Z" fill="url(#glassGrad)" opacity="0.7"/>
              {/* Car windows */}
              <rect x="60" y="32" width="35" height="20" rx="2" fill="url(#glassGrad)" opacity="0.6"/>
              <rect x="102" y="32" width="35" height="20" rx="2" fill="url(#glassGrad)" opacity="0.6"/>
              {/* Car wheels */}
              <circle cx="45" cy="72" r="15" fill="url(#wheelGrad)"/>
              <circle cx="45" cy="72" r="10" fill="#374151"/>
              <circle cx="45" cy="72" r="5" fill="#9ca3af"/>
              <circle cx="145" cy="72" r="15" fill="url(#wheelGrad)"/>
              <circle cx="145" cy="72" r="10" fill="#374151"/>
              <circle cx="145" cy="72" r="5" fill="#9ca3af"/>
              {/* Car details */}
              <rect x="22" y="38" width="8" height="5" rx="1" fill="#fed7aa" opacity="0.8"/>
              <rect x="160" y="38" width="8" height="5" rx="1" fill="#fca5a5" opacity="0.8"/>
            </g>

            {/* Truck cab */}
            <path d="M310 215 L310 110 Q310 95 325 90 L395 90 Q420 90 430 110 L440 160 L440 215 Z" fill="url(#cabGrad)"/>
            {/* Cab side detail / door */}
            <path d="M318 150 L318 210 L430 210 L430 150 Z" fill="#334155" opacity="0.4"/>
            <rect x="322" y="155" width="104" height="50" rx="4" fill="#2d3f55" opacity="0.5"/>
            {/* Cab window */}
            <path d="M320 100 L320 148 L438 148 L430 115 Q425 100 410 97 L330 97 Q322 97 320 100 Z" fill="url(#glassGrad)" opacity="0.8"/>
            {/* Window frame */}
            <path d="M320 100 L320 148 L438 148 L430 115 Q425 100 410 97 L330 97 Q322 97 320 100 Z" fill="none" stroke="#475569" strokeWidth="2"/>
            {/* Door handle */}
            <rect x="395" y="180" width="18" height="5" rx="2.5" fill="#64748b"/>
            {/* Cab top light bar */}
            <rect x="320" y="87" width="110" height="6" rx="3" fill="url(#orangeGrad)"/>
            {/* Blinker lights on bar */}
            {[330, 350, 370, 390, 410].map((x, i) => (
              <circle key={i} cx={x} cy="90" r="3" fill="#fef08a" opacity="0.9"/>
            ))}

            {/* Front bumper */}
            <path d="M430 200 L460 200 L465 215 L430 215 Z" fill="#2d3748"/>
            <rect x="432" y="200" width="30" height="8" rx="2" fill="#374151"/>
            {/* Headlights */}
            <ellipse cx="450" cy="165" rx="12" ry="8" fill="url(#headlightGrad)" opacity="0.9" filter="url(#glow)"/>
            <ellipse cx="450" cy="130" rx="10" ry="6" fill="url(#headlightGrad)" opacity="0.7" filter="url(#glow)"/>
            {/* Headlight glow rays */}
            <line x1="462" y1="165" x2="495" y2="155" stroke="#fef08a" strokeWidth="1.5" opacity="0.4"/>
            <line x1="462" y1="165" x2="498" y2="165" stroke="#fef08a" strokeWidth="1.5" opacity="0.3"/>
            <line x1="462" y1="165" x2="495" y2="175" stroke="#fef08a" strokeWidth="1.5" opacity="0.4"/>

            {/* Exhaust pipe */}
            <rect x="442" y="95" width="6" height="40" rx="3" fill="#475569"/>
            <ellipse cx="445" cy="95" rx="5" ry="4" fill="#334155"/>

            {/* Exhaust smoke puffs */}
            <circle cx="445" cy="82" r="8" fill="#94a3b8" opacity="0.2"/>
            <circle cx="450" cy="68" r="6" fill="#94a3b8" opacity="0.15"/>
            <circle cx="443" cy="55" r="4" fill="#94a3b8" opacity="0.1"/>
          </g>

          {/* Truck wheels */}
          {/* Front wheels */}
          <g filter="url(#shadow)">
            <circle cx="420" cy="225" r="32" fill="url(#wheelGrad)"/>
            <circle cx="420" cy="225" r="24" fill="#1e293b"/>
            <circle cx="420" cy="225" r="16" fill="#334155"/>
            <circle cx="420" cy="225" r="7" fill="#64748b"/>
            {/* Wheel spokes */}
            {[0,60,120,180,240,300].map((angle, i) => (
              <line key={i}
                x1={420 + 10 * Math.cos(angle * Math.PI/180)}
                y1={225 + 10 * Math.sin(angle * Math.PI/180)}
                x2={420 + 22 * Math.cos(angle * Math.PI/180)}
                y2={225 + 22 * Math.sin(angle * Math.PI/180)}
                stroke="#64748b" strokeWidth="3" strokeLinecap="round"
              />
            ))}
          </g>

          {/* Rear wheels (double) */}
          <g filter="url(#shadow)">
            <circle cx="158" cy="225" r="32" fill="url(#wheelGrad)"/>
            <circle cx="158" cy="225" r="24" fill="#1e293b"/>
            <circle cx="158" cy="225" r="16" fill="#334155"/>
            <circle cx="158" cy="225" r="7" fill="#64748b"/>
            {[0,60,120,180,240,300].map((angle, i) => (
              <line key={i}
                x1={158 + 10 * Math.cos(angle * Math.PI/180)}
                y1={225 + 10 * Math.sin(angle * Math.PI/180)}
                x2={158 + 22 * Math.cos(angle * Math.PI/180)}
                y2={225 + 22 * Math.sin(angle * Math.PI/180)}
                stroke="#64748b" strokeWidth="3" strokeLinecap="round"
              />
            ))}
          </g>
          <g filter="url(#shadow)">
            <circle cx="245" cy="225" r="32" fill="url(#wheelGrad)"/>
            <circle cx="245" cy="225" r="24" fill="#1e293b"/>
            <circle cx="245" cy="225" r="16" fill="#334155"/>
            <circle cx="245" cy="225" r="7" fill="#64748b"/>
            {[0,60,120,180,240,300].map((angle, i) => (
              <line key={i}
                x1={245 + 10 * Math.cos(angle * Math.PI/180)}
                y1={225 + 10 * Math.sin(angle * Math.PI/180)}
                x2={245 + 22 * Math.cos(angle * Math.PI/180)}
                y2={225 + 22 * Math.sin(angle * Math.PI/180)}
                stroke="#64748b" strokeWidth="3" strokeLinecap="round"
              />
            ))}
          </g>

          {/* Orange accent stripe on side */}
          <path d="M82 200 L310 200 L310 195 L82 195 Z" fill="url(#orangeGrad)" opacity="0.9"/>

          {/* Company label on cab door */}
          <rect x="335" y="158" width="85" height="38" rx="4" fill="url(#orangeGrad)" opacity="0.15"/>
          <text x="377" y="174" textAnchor="middle" fill="#f97316" fontSize="9" fontWeight="700" fontFamily="Inter, sans-serif">TOWPRIME</text>
          <text x="377" y="187" textAnchor="middle" fill="#f97316" fontSize="8" fontFamily="Inter, sans-serif">24/7</text>

          {/* Rotating amber beacon */}
          <circle cx="375" cy="90" r="9" fill="#fbbf24" opacity="0.9"/>
          <circle cx="375" cy="90" r="5" fill="#f59e0b"/>
          <circle cx="375" cy="90" r="2.5" fill="#fef3c7"/>
          <line x1="375" y1="78" x2="375" y2="74" stroke="#fbbf24" strokeWidth="2" opacity="0.6"/>
          <line x1="387" y1="90" x2="391" y2="90" stroke="#fbbf24" strokeWidth="2" opacity="0.6"/>
        </svg>

        {/* Ambient glow underneath */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-orange-500/10 blur-2xl rounded-full animate-float-shadow"/>
      </div>
    </div>
  );
}
