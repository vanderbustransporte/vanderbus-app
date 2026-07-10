import {
  Target, DollarSign, AlertTriangle, MapPin,
  Navigation, TrendingUp, Wrench, Settings, ShieldAlert,
} from 'lucide-react'

export const TIPO_CONFIG = {
  accion:        { color: '#f87171', Icon: ShieldAlert   },
  oportunidad:   { color: '#38bdf8', Icon: Target        },
  nomina:        { color: '#34d399', Icon: DollarSign    },
  vencimiento:   { color: '#fb923c', Icon: AlertTriangle },
  viaje:         { color: '#60a5fa', Icon: MapPin        },
  gps:           { color: '#22d3ee', Icon: Navigation    },
  finanzas:      { color: '#a78bfa', Icon: TrendingUp    },
  mantenimiento: { color: '#fbbf24', Icon: Wrench        },
  sistema:       { color: '#94a3b8', Icon: Settings      },
}
