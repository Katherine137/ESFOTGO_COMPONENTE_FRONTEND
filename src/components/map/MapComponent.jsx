import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Popup, CircleMarker, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import L from 'leaflet';
import axios from 'axios';
import storeAuth from '../../context/storeAuth';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CATEGORY_CONFIG = {
    academico:       { color: '#1B6BB0', label: 'Académico',       tw: 'bg-blue-100 text-blue-700'   },
    biblioteca:      { color: '#7C3AED', label: 'Biblioteca',       tw: 'bg-purple-100 text-purple-700' },
    servicios:       { color: '#059669', label: 'Servicios',        tw: 'bg-emerald-100 text-emerald-700' },
    deportes:        { color: '#DC2626', label: 'Deportes',         tw: 'bg-red-100 text-red-700'     },
    eventos:         { color: '#F59E0B', label: 'Eventos',          tw: 'bg-amber-100 text-amber-700' },
    estacionamiento: { color: '#6B7280', label: 'Estacionamiento',  tw: 'bg-gray-100 text-gray-600'   },
    entrada:         { color: '#0EA5E9', label: 'Entrada',          tw: 'bg-sky-100 text-sky-700'     },
    otro:            { color: '#9CA3AF', label: 'Otro',             tw: 'bg-gray-100 text-gray-500'   },
};

const userLocationIcon = L.divIcon({
    className: '',
    html: `
        <div style="position:relative;width:24px;height:24px">
            <div style="position:absolute;inset:0;background:#2563eb;border-radius:50%;box-shadow:0 0 0 4px rgba(37,99,235,.3);animation:pulse-loc 2s ease-in-out infinite;"></div>
            <div style="position:absolute;inset:4px;background:#fff;border-radius:50%;"></div>
            <div style="position:absolute;inset:7px;background:#2563eb;border-radius:50%;"></div>
        </div>
        <style>@keyframes pulse-loc{0%,100%{box-shadow:0 0 0 4px rgba(37,99,235,.3)}50%{box-shadow:0 0 0 10px rgba(37,99,235,.1)}}</style>`,
    iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12],
});

const destinationIcon = L.divIcon({
    className: '',
    html: `<div style="width:32px;height:40px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4));">
        <svg viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16c0 10.627 14.234 22.75 15.265 23.648a1 1 0 001.47 0C17.766 38.75 32 26.627 32 16 32 7.163 24.837 0 16 0z" fill="#ef4444"/>
            <circle cx="16" cy="16" r="7" fill="#fff"/>
            <circle cx="16" cy="16" r="4" fill="#ef4444"/>
        </svg>
    </div>`,
    iconSize: [32, 40], iconAnchor: [16, 40], popupAnchor: [0, -42],
});

function createPoiIcon(category) {
    const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.otro;
    return L.divIcon({
        className: '',
        html: `<div style="background:${cfg.color};color:#fff;padding:4px 8px;border-radius:7px;border:2px solid #fff;font-weight:800;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,.3);white-space:nowrap;">${cfg.label.charAt(0)}</div>`,
        iconSize: [26, 26], iconAnchor: [13, 13],
    });
}

function MapUpdater({ center, zoom }) {
    const map = useMap();
    useEffect(() => { if (center) map.flyTo(center, zoom, { duration: 1.2 }); }, [center, zoom, map]);
    return null;
}

function MapClickHandler({ onMapClick, isSettingDestination }) {
    const map = useMap();
    useEffect(() => {
        if (!isSettingDestination) return;
        const handler = (e) => onMapClick([e.latlng.lat, e.latlng.lng]);
        map.on('click', handler);
        map.getContainer().style.cursor = 'crosshair';
        return () => { map.off('click', handler); map.getContainer().style.cursor = ''; };
    }, [map, onMapClick, isSettingDestination]);
    return null;
}

function UserToDestinationRoute({ origin, destination, onRouteFound }) {
    const map = useMap();
    const controlRef = useRef(null);
    useEffect(() => {
        if (!origin || !destination) return;
        if (controlRef.current) { map.removeControl(controlRef.current); controlRef.current = null; }
        const ctrl = L.Routing.control({
            waypoints: [L.latLng(origin[0], origin[1]), L.latLng(destination[0], destination[1])],
            routeWhileDragging: false, addWaypoints: false, draggableWaypoints: false,
            createMarker: () => null, show: false,
            lineOptions: { styles: [{ color: '#2563eb', weight: 5, opacity: 0.85 }] },
            router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1', language: 'es' }),
        }).addTo(map);
        ctrl.on('routesfound', (e) => {
            const s = e.routes[0].summary;
            onRouteFound({ distanceKm: (s.totalDistance / 1000).toFixed(2), durationMin: Math.ceil(s.totalTime / 60) });
        });
        ctrl.on('routingerror', () => onRouteFound(null));
        controlRef.current = ctrl;
        return () => { if (controlRef.current) { map.removeControl(controlRef.current); controlRef.current = null; } };
    }, [map, origin, destination, onRouteFound]);
    return null;
}

function RoutingMachine({ waypoints, color }) {
    const map = useMap();
    const controlRef = useRef(null);
    useEffect(() => {
        if (!map || !waypoints || waypoints.length < 2) return;
        if (controlRef.current) { map.removeControl(controlRef.current); controlRef.current = null; }
        const ctrl = L.Routing.control({
            waypoints: waypoints.map(p => L.latLng(p[0], p[1])),
            routeWhileDragging: false, addWaypoints: false, draggableWaypoints: false,
            createMarker: () => null, show: false,
            lineOptions: { styles: [{ color: color || '#3b82f6', weight: 4, opacity: 0.75 }] },
            router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1', language: 'es' }),
        }).addTo(map);
        controlRef.current = ctrl;
        return () => { if (controlRef.current) { map.removeControl(controlRef.current); controlRef.current = null; } };
    }, [map, waypoints, color]);
    return null;
}

async function geocodeAddress(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=ec`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    return res.json();
}

async function reverseGeocode(lat, lng) {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
        const data = await res.json();
        if (data?.display_name) {
            return data.display_name.split(',').slice(0, 3).join(', ');
        }
    } catch {}
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function ETABanner({ routeInfo, onClose, destination, destName }) {
    if (!routeInfo) return null;
    const h = Math.floor(routeInfo.durationMin / 60);
    const m = routeInfo.durationMin % 60;
    const eta = new Date(Date.now() + routeInfo.durationMin * 60000);
    const etaStr = eta.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    return (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-4 max-w-[90%] min-w-[280px] border border-gray-100">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 truncate mb-0.5">📍 {destName || (destination ? `${destination[0].toFixed(4)}, ${destination[1].toFixed(4)}` : '—')}</p>
                <p className="text-lg font-bold text-gray-900 leading-tight">{h > 0 ? `${h}h ` : ''}{m} min · {routeInfo.distanceKm} km</p>
                <p className="text-xs text-gray-400">Llegada: <strong className="text-blue-600">{etaStr}</strong></p>
            </div>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-xl leading-none p-1 transition-colors">✕</button>
        </div>
    );
}

function AddressSearchBox({ onSelect, disabled }) {
    const [query, setQuery]     = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [focused, setFocused] = useState(false);
    const debounceRef = useRef(null);

    const search = (val) => {
        setQuery(val);
        clearTimeout(debounceRef.current);
        if (val.trim().length < 3) { setResults([]); return; }
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try { const data = await geocodeAddress(val); setResults(data.slice(0, 5)); } catch { setResults([]); }
            setLoading(false);
        }, 500);
    };

    const pick = (item) => {
        setQuery(item.display_name.split(',').slice(0, 2).join(','));
        setResults([]);
        onSelect([parseFloat(item.lat), parseFloat(item.lon)], item.display_name.split(',').slice(0, 2).join(','));
    };

    return (
        <div className="relative">
            <div className="relative">
                <input
                    type="text" value={query} onChange={e => search(e.target.value)}
                    onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 200)}
                    placeholder="Buscar dirección o lugar…" disabled={disabled}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none bg-white disabled:bg-gray-50 disabled:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                />
                {loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs animate-spin">⟳</span>}
            </div>
            {focused && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-[2000] bg-white rounded-xl border border-gray-100 shadow-xl mt-1 overflow-hidden">
                    {results.map((r, i) => (
                        <div key={i} onMouseDown={() => pick(r)}
                            className="px-3 py-2 text-xs text-gray-600 cursor-pointer hover:bg-blue-50 border-b border-gray-50 last:border-0 leading-snug">
                            📍 {r.display_name.split(',').slice(0, 3).join(', ')}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function Section({ title, icon, open, onToggle, children, accent = 'blue' }) {
    const accents = {
        blue:   'text-blue-700 bg-blue-50 border-blue-100',
        red:    'text-red-700 bg-red-50 border-red-100',
        green:  'text-green-700 bg-green-50 border-green-100',
        indigo: 'text-indigo-700 bg-indigo-50 border-indigo-100',
        amber:  'text-amber-700 bg-amber-50 border-amber-100',
    };
    return (
        <div className="rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <button onClick={onToggle}
                className={`w-full flex items-center justify-between px-4 py-3 ${accents[accent]} border-b font-semibold text-sm transition hover:brightness-95`}>
                <span className="flex items-center gap-2">{icon} {title}</span>
                <span className="text-xs opacity-60">{open ? '▲' : '▼'}</span>
            </button>
            {open && <div className="bg-white">{children}</div>}
        </div>
    );
}

function Viewer360({ imageUrl, onClose }) {
    const containerRef = useRef(null);
    const viewerRef = useRef(null);
    const [brightness, setBrightness] = useState(105);
    const [contrast, setContrast] = useState(108);
    const [saturation, setSaturation] = useState(105);
    const [showControls, setShowControls] = useState(false);

    const applyFilter = useCallback((b, c, s) => {
        if (!containerRef.current) return;
        const canvas = containerRef.current.querySelector('canvas');
        if (canvas) canvas.style.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
    }, []);

    useEffect(() => {
        if (!imageUrl || !containerRef.current) return;
        const loadPannellum = () => new Promise((resolve) => {
            if (window.pannellum) { resolve(); return; }
            if (!document.getElementById('pannellum-css')) {
                const link = document.createElement('link');
                link.id = 'pannellum-css'; link.rel = 'stylesheet';
                link.href = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css';
                document.head.appendChild(link);
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
        loadPannellum().then(() => {
            if (viewerRef.current) { try { viewerRef.current.destroy(); } catch {} }
            viewerRef.current = window.pannellum.viewer(containerRef.current, {
                type: 'equirectangular',
                panorama: imageUrl,
                autoLoad: true,
                showControls: true,
                compass: false,
                friction: 0.15,
                mouseZoom: true,
                hfov: 85,
                yaw: 0,
                pitch: -10,
                minHfov: 70,
                maxHfov: 140,
                crossOrigin: 'anonymous',
            });
            viewerRef.current.on('load', () => applyFilter(brightness, contrast, saturation));
        });
        return () => { if (viewerRef.current) { try { viewerRef.current.destroy(); } catch {} viewerRef.current = null; } };
    }, [imageUrl]);

    useEffect(() => { applyFilter(brightness, contrast, saturation); }, [brightness, contrast, saturation, applyFilter]);

    const sliderRow = (label, value, setter, min, max) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <span style={{ fontSize: 11, color: '#cbd5e1', width: 70, flexShrink: 0 }}>{label}</span>
            <input type="range" min={min} max={max} value={value} onChange={e => setter(Number(e.target.value))} style={{ flex: 1, accentColor: '#38bdf8', cursor: 'pointer' }} />
            <span style={{ fontSize: 11, color: '#94a3b8', width: 36, textAlign: 'right' }}>{value}%</span>
            <button onClick={() => setter(100)} style={{ background: 'none', border: '1px solid #475569', color: '#94a3b8', borderRadius: 4, fontSize: 10, padding: '1px 5px', cursor: 'pointer' }}>↺</button>
        </div>
    );

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.96)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ color: '#e0f2fe', fontWeight: 700, fontSize: 14 }}>🔭 Vista 360°</span>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowControls(v => !v)} style={{ background: showControls ? '#0369a1' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>🎛️ Visibilidad</button>
                    <button onClick={onClose} style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>✕ Cerrar</button>
                </div>
            </div>
            {showControls && (
                <div style={{ background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Ajustes de imagen</span>
                        <button onClick={() => { setBrightness(115); setContrast(110); setSaturation(115); }} style={{ background: 'none', border: '1px solid #334155', color: '#64748b', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}>↺ Restablecer todo</button>
                    </div>
                    {sliderRow('☀️ Brillo', brightness, setBrightness, 50, 200)}
                    {sliderRow('◑ Contraste', contrast, setContrast, 50, 200)}
                    {sliderRow('🎨 Saturación', saturation, setSaturation, 0, 200)}
                </div>
            )}
            <div ref={containerRef} style={{ flex: 1, width: '100%' }} />
        </div>
    );
}

const MapComponent = () => {
    const { token } = storeAuth();

    const BASE_URL = useMemo(() => {
        const url = import.meta.env.VITE_BACKEND_URL || '';
        return url.endsWith('/api') ? url : `${url}/api`;
    }, []);

    const axiosAuth = useMemo(() => {
        const instance = axios.create({ baseURL: BASE_URL });
        instance.interceptors.request.use((config) => {
            const t = token || localStorage.getItem('token');
            if (t) config.headers.Authorization = `Bearer ${t}`;
            return config;
        });
        instance.interceptors.response.use((r) => r, (err) => {
            if (err.response?.status === 401) console.warn('Token expirado.');
            return Promise.reject(err);
        });
        return instance;
    }, [BASE_URL, token]);

    const [dbPois,    setDbPois]    = useState([]);
    const [dbRoutes,  setDbRoutes]  = useState([]);
    const [loadingDB, setLoadingDB] = useState(false);
    const [dbError,   setDbError]   = useState(null);

    const fetchDB = useCallback(async () => {
        setLoadingDB(true); setDbError(null);
        try {
            const [poisRes, routesRes] = await Promise.allSettled([
                axiosAuth.get('/mapa/ubicaciones'),
                axiosAuth.get('/bus/rutas'),
            ]);
            if (poisRes.status === 'fulfilled') {
                const raw = Array.isArray(poisRes.value.data) ? poisRes.value.data : poisRes.value.data?.data || [];
                setDbPois(raw.map(d => ({
                    _id:         d._id || d.id,
                    nombre:      d.nombre || d.name || '',
                    descripcion: d.descripcion || d.description || '',
                    categoria:   d.categoria || d.category || 'otro',
                    latitud:     d.latitud ?? d.latitude ?? 0,
                    longitud:    d.longitud ?? d.longitude ?? 0,
                    imagen:      d.imagen || null,
                })));
            }
            if (routesRes.status === 'fulfilled') {
                const raw = Array.isArray(routesRes.value.data) ? routesRes.value.data : routesRes.value.data?.data || [];
                const withStops = await Promise.all(raw.map(async (r) => {
                    const id = r._id || r.id;
                    try {
                        const pr = await axiosAuth.get(`/bus/paradas/${id}`);
                        const arr = Array.isArray(pr.data) ? pr.data : pr.data?.data || [];
                        return {
                            ...r,
                            _stops: arr.map(s => ({
                                nombre: s.nombre || s.name || '',
                                lat: s.latitud ?? s.latitude ?? 0,
                                lng: s.longitud ?? s.longitude ?? 0,
                                orden: s.orden ?? 0,
                            })).sort((a, b) => a.orden - b.orden),
                        };
                    } catch { return { ...r, _stops: [] }; }
                }));
                setDbRoutes(withStops);
            }
        } catch { setDbError('No se pudieron cargar los datos del servidor.'); }
        finally { setLoadingDB(false); }
    }, [axiosAuth]);

    useEffect(() => { fetchDB(); }, [fetchDB]);

    const [selectedDbRoute,      setSelectedDbRoute]      = useState(null);
    const [selectedPoint,        setSelectedPoint]        = useState(null);
    const [mapCenter,            setMapCenter]            = useState([-0.26, -78.52]);
    const [userLocation,         setUserLocation]         = useState(null);
    const [destination,          setDestination]          = useState(null);
    const [destName,             setDestName]             = useState('');
    const [isSettingDestination, setIsSettingDestination] = useState(false);
    const [routeInfo,            setRouteInfo]            = useState(null);
    const [locationError,        setLocationError]        = useState(null);
    const [locating,             setLocating]             = useState(false);
    const [viewer360Url,         setViewer360Url]         = useState(null);
    const watchIdRef = useRef(null);

    /* ── Responsive & sidebar ── */
    const [isMobile,    setIsMobile]    = useState(window.innerWidth < 768);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [secOpen, setSecOpen] = useState({ location: true, dest: true, dbRoutes: true, pois: true });

    useEffect(() => {
        const h = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, []);

    const startTracking = () => {
        if (!navigator.geolocation) { setLocationError('Tu navegador no soporta geolocalización.'); return; }
        setLocating(true); setLocationError(null);
        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                const c = [pos.coords.latitude, pos.coords.longitude];
                setUserLocation(c); setMapCenter(c); setLocating(false);
            },
            () => { setLocationError('No se pudo obtener tu ubicación.'); setLocating(false); },
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );
    };
    const stopTracking = () => {
        if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
        setUserLocation(null); setDestination(null); setDestName(''); setRouteInfo(null); setIsSettingDestination(false);
    };
    useEffect(() => () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); }, []);

    const handleSelectDbRoute = (r) => {
        setSelectedPoint(null); setSelectedDbRoute(r);
        if (r._stops?.length) setMapCenter([r._stops[0].lat, r._stops[0].lng]);
    };
    const handleSelectPoi = (poi) => {
        setSelectedPoint(poi._id); setMapCenter([poi.latitud, poi.longitud]);
        if (isMobile) setSidebarOpen(false);
    };

    const handleMapClick = useCallback(async (coords) => {
        setDestination(coords);
        setRouteInfo(null);
        setIsSettingDestination(false);
        setDestName(`${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`);
        const name = await reverseGeocode(coords[0], coords[1]);
        setDestName(name);
    }, []);
    const handleAddressSelect = (coords, name) => {
        setDestination(coords); setDestName(name); setRouteInfo(null); setMapCenter(coords);
    };
    const handleRouteFound = useCallback((info) => setRouteInfo(info), []);
    const clearDestination  = () => { setDestination(null); setDestName(''); setRouteInfo(null); setIsSettingDestination(false); };
    const tog = (k) => setSecOpen(p => ({ ...p, [k]: !p[k] }));

    const [routeVisible, setRouteVisible] = useState(true);
    const activeDbRoute = selectedDbRoute && !destination ? selectedDbRoute : null;

    const sidebarContent = (
        <div className="flex flex-col gap-3 p-3">

            {/* ── Mi ubicación ── */}
            <Section title="Mi Ubicación en Tiempo Real" icon="📍" open={secOpen.location} onToggle={() => tog('location')} accent="blue">
                <div className="p-3 flex flex-col gap-2">
                    {!userLocation ? (
                        <button onClick={startTracking} disabled={locating}
                            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition">
                            {locating ? <><span className="animate-spin">⟳</span> Localizando…</> : <><span>🎯</span> Activar mi ubicación</>}
                        </button>
                    ) : (
                        <>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 text-xs text-green-800">
                                ✅ <strong>Ubicación activa</strong><br />
                                <span className="text-green-600">{userLocation[0].toFixed(5)}, {userLocation[1].toFixed(5)}</span>
                            </div>
                            <button onClick={stopTracking}
                                className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold px-4 py-2 rounded-lg transition border border-red-100">
                                ⛔ Detener seguimiento
                            </button>
                        </>
                    )}
                    {locationError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-600">⚠️ {locationError}</div>
                    )}
                </div>
            </Section>

            {/* ── Destino ── */}
            <Section title="Destino" icon="🏁" open={secOpen.dest} onToggle={() => tog('dest')} accent="red">
                <div className="p-3 flex flex-col gap-2">
                    <AddressSearchBox onSelect={handleAddressSelect} disabled={!userLocation} />
                    <div className="flex items-center gap-2 text-xs text-gray-300">
                        <div className="flex-1 h-px bg-gray-100" /> o <div className="flex-1 h-px bg-gray-100" />
                    </div>
                    <button onClick={() => setIsSettingDestination(s => !s)} disabled={!userLocation}
                        className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition border-2 ${isSettingDestination ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'} disabled:opacity-40`}>
                        {isSettingDestination ? '✋ Toca el mapa…' : '🗺️ Seleccionar en el mapa'}
                    </button>
                    {dbPois.length > 0 && (
                        <>
                            <div className="flex items-center gap-2 text-xs text-gray-300">
                                <div className="flex-1 h-px bg-gray-100" /> o <div className="flex-1 h-px bg-gray-100" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <p className="text-xs font-semibold text-gray-500">📍 Elegir ubicación del campus</p>
                                <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-100" style={{ scrollbarWidth: 'thin' }}>
                                    {dbPois.map(poi => {
                                        const cfg = CATEGORY_CONFIG[poi.categoria] || CATEGORY_CONFIG.otro;
                                        return (
                                            <div key={poi._id} onClick={() => handleAddressSelect([poi.latitud, poi.longitud], poi.nombre)}
                                                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50 border-b border-gray-50 last:border-0 text-sm transition">
                                                <div className="w-5 h-5 rounded flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                                                    style={{ background: cfg.color }}>
                                                    {cfg.label.charAt(0)}
                                                </div>
                                                <span className="text-gray-700 truncate flex-1">{poi.nombre}</span>
                                                <span className="text-[10px] text-gray-400 shrink-0">{cfg.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                    {destination && (
                        <>
                            <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-xs text-rose-800">
                                📌 <strong>Destino:</strong><br />{destName || `${destination[0].toFixed(5)}, ${destination[1].toFixed(5)}`}
                            </div>
                            <button onClick={() => setMapCenter(destination)}
                                className="flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-semibold px-4 py-2 rounded-lg transition border border-emerald-200">
                                🔍 Centrar en destino
                            </button>
                            <button onClick={clearDestination}
                                className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold px-4 py-2 rounded-lg transition border border-red-100">
                                🗑️ Borrar destino
                            </button>
                        </>
                    )}
                    {!userLocation && <p className="text-xs text-gray-400 m-0">Activa tu ubicación para calcular rutas.</p>}
                </div>
            </Section>

            {/* ── Rutas DB ── */}
            <Section title={`Rutas del Polibus ${dbRoutes.length ? `(${dbRoutes.length})` : ''}`} icon="🚌" open={secOpen.dbRoutes} onToggle={() => tog('dbRoutes')} accent="indigo">
                <div className="p-2 max-h-60 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                    {loadingDB && (
                        <div className="text-center py-4 text-sm text-gray-400 animate-pulse">Cargando rutas…</div>
                    )}
                    {!loadingDB && dbError && (
                        <div className="mx-2 mb-2 bg-red-50 border border-red-100 rounded-lg p-2.5 text-xs text-red-600 flex items-center justify-between gap-2">
                            <span>⚠️ {dbError}</span>
                            <button onClick={fetchDB} className="text-blue-600 underline text-xs">Reintentar</button>
                        </div>
                    )}
                    {!loadingDB && !dbError && dbRoutes.length === 0 && (
                        <p className="text-center text-xs text-gray-400 py-3">No hay rutas registradas.</p>
                    )}
                    {dbRoutes.map(r => {
                        const rid = r._id || r.id;
                        const active = selectedDbRoute && (selectedDbRoute._id || selectedDbRoute.id) === rid;
                        return (
                            <div key={rid} onClick={() => handleSelectDbRoute(r)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 cursor-pointer transition-all text-sm ${active ? 'bg-indigo-50 border border-indigo-200 font-semibold text-indigo-800' : 'hover:bg-gray-50 border border-transparent text-gray-700'}`}>
                                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: r.color || '#3b82f6' }} />
                                <div className="flex-1 min-w-0">
                                    <p className="truncate leading-tight">{r.nombre || r.name}</p>
                                    {r._stops?.length > 0 && (
                                        <p className="text-xs text-gray-400 font-normal">{r._stops.length} paradas</p>
                                    )}
                                </div>
                                {active && (
                                    <button onClick={e => { e.stopPropagation(); setRouteVisible(v => !v); }}
                                        className="text-xs transition hover:scale-110" title={routeVisible ? 'Ocultar ruta' : 'Mostrar ruta'}>
                                        {routeVisible ? '👁' : '🙈'}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Section>

            <Section title={`Ubicaciones ${dbPois.length ? `(${dbPois.length})` : ''}`} icon="📌" open={secOpen.pois} onToggle={() => tog('pois')} accent="green">
                <div className="p-2 max-h-80 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                    {loadingDB && <div className="text-center py-4 text-sm text-gray-400 animate-pulse">Cargando ubicaciones…</div>}
                    {!loadingDB && dbPois.length === 0 && (
                        <p className="text-center text-xs text-gray-400 py-3">No hay ubicaciones registradas.</p>
                    )}
                    {dbPois.map(poi => {
                        const cfg = CATEGORY_CONFIG[poi.categoria] || CATEGORY_CONFIG.otro;
                        const active = selectedPoint === poi._id;
                        return (
                            <div key={poi._id} onClick={() => handleSelectPoi(poi)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 cursor-pointer transition-all ${active ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                                    style={{ background: cfg.color }}>
                                    {cfg.label.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate leading-tight">{poi.nombre}</p>
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.tw}`}>{cfg.label}</span>
                                </div>
                                {poi.imagen && (
                                    <button
                                        onClick={e => { e.stopPropagation(); setViewer360Url(poi.imagen); }}
                                        className="text-xs text-sky-500 font-bold shrink-0 hover:text-sky-700 transition"
                                        title="Ver en 360°"
                                    >
                                        360°
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Section>
        </div>
    );

    const mapContent = (
        <div className="relative w-full h-full">
            <ETABanner routeInfo={routeInfo} destination={destination} destName={destName} onClose={clearDestination} />

            {isSettingDestination && !routeInfo && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-amber-50 border-2 border-amber-400 rounded-xl px-5 py-2.5 text-sm font-semibold text-amber-800 shadow-lg pointer-events-none">
                    🗺️ Toca el mapa para fijar tu destino
                </div>
            )}

            {isMobile && (
                <button onClick={() => setSidebarOpen(v => !v)}
                    className="absolute bottom-5 right-4 z-[1000] w-12 h-12 rounded-full bg-blue-600 text-white shadow-2xl flex items-center justify-center text-xl hover:bg-blue-700 transition">
                    {sidebarOpen ? '✕' : '☰'}
                </button>
            )}

            <MapContainer center={mapCenter} zoom={12} maxZoom={22} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap' maxZoom={22} maxNativeZoom={19} />
                <MapUpdater center={mapCenter} zoom={userLocation ? 15 : 12} />
                <MapClickHandler onMapClick={handleMapClick} isSettingDestination={isSettingDestination} />

                {/* User location */}
                {userLocation && (
                    <Marker position={userLocation} icon={userLocationIcon}>
                        <Popup>
                            <strong>📍 Tu ubicación actual</strong><br />
                            <span style={{ fontSize: 11, color: '#6b7280' }}>{userLocation[0].toFixed(6)}, {userLocation[1].toFixed(6)}</span>
                        </Popup>
                    </Marker>
                )}

                {/* Destination */}
                {destination && (
                    <Marker position={destination} icon={destinationIcon}>
                        <Popup>
                            <strong>🏁 {destName || 'Destino'}</strong><br />
                            <span style={{ fontSize: 11, color: '#6b7280' }}>{destination[0].toFixed(6)}, {destination[1].toFixed(6)}</span>
                            {routeInfo && <div style={{ marginTop: 6, color: '#2563eb', fontWeight: 600 }}>⏱ {routeInfo.durationMin} min · {routeInfo.distanceKm} km</div>}
                        </Popup>
                    </Marker>
                )}

                {/* Route to destination */}
                {userLocation && destination && (
                    <UserToDestinationRoute origin={userLocation} destination={destination} onRouteFound={handleRouteFound} />
                )}

                {/* DB route stops */}
                {activeDbRoute && routeVisible && activeDbRoute._stops?.length > 1 && activeDbRoute._stops.map((s, i) => (
                    <CircleMarker key={i} center={[s.lat, s.lng]}
                        radius={i === 0 || i === activeDbRoute._stops.length - 1 ? 10 : 7}
                        pathOptions={{
                            color: i === 0 ? '#16a34a' : i === activeDbRoute._stops.length - 1 ? '#dc2626' : activeDbRoute.color || '#6366f1',
                            fillColor: '#fff', fillOpacity: 1, weight: 2.5,
                        }}>
                        <Popup><strong>{i === 0 ? '🟢 ' : i === activeDbRoute._stops.length - 1 ? '🔴 ' : `${i + 1}. `}{s.nombre}</strong></Popup>
                    </CircleMarker>
                ))}
                {activeDbRoute && routeVisible && activeDbRoute._stops?.length > 1 && (
                    <RoutingMachine waypoints={activeDbRoute._stops.map(s => [s.lat, s.lng])} color={activeDbRoute.color || '#6366f1'} />
                )}

                {/* DB POIs */}
                {dbPois.map(poi => (
                    <Marker key={poi._id} position={[poi.latitud, poi.longitud]} icon={createPoiIcon(poi.categoria)}>
                        <Popup minWidth={220}>
                            <div style={{ minWidth: 200 }}>
                                <strong style={{ fontSize: 14 }}>{poi.nombre}</strong>
                                {poi.descripcion && (
                                    <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 6px' }}>{poi.descripcion}</p>
                                )}
                                <span style={{
                                    fontSize: 10, fontWeight: 700,
                                    background: (CATEGORY_CONFIG[poi.categoria]?.color || '#9ca3af') + '25',
                                    color: CATEGORY_CONFIG[poi.categoria]?.color || '#9ca3af',
                                    padding: '2px 8px', borderRadius: 6, display: 'inline-block',
                                }}>{CATEGORY_CONFIG[poi.categoria]?.label || 'Otro'}</span>

                                {poi.imagen && (
                                    <div style={{ marginTop: 10 }}>
                                        <div
                                            style={{ position: 'relative', cursor: 'pointer', borderRadius: 8, overflow: 'hidden', border: '2px solid #bae6fd' }}
                                            onClick={() => setViewer360Url(poi.imagen)}
                                        >
                                            <img
                                                src={poi.imagen}
                                                alt="Vista 360°"
                                                style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }}
                                                onError={e => { e.target.closest('div').style.display = 'none'; }}
                                            />
                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,105,161,0.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                                                <span style={{ fontSize: 22 }}>🔭</span>
                                                <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>Ver en 360°</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setViewer360Url(poi.imagen)}
                                            style={{ marginTop: 6, width: '100%', padding: '6px', borderRadius: 7, background: '#0369a1', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                                        >
                                            🔭 Abrir vista 360°
                                        </button>
                                    </div>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );

    return (
        <div className="flex flex-col md:flex-row w-full font-sans" style={{ height: 'calc(100vh - 64px)' }}>
            {viewer360Url && <Viewer360 imageUrl={viewer360Url} onClose={() => setViewer360Url(null)} />}

            {/* ── Desktop sidebar ── */}
            <aside className="hidden md:flex flex-col w-72 lg:w-80 border-r border-gray-100 bg-gray-50 shrink-0 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-100 shrink-0">
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                    <span className="font-bold text-sm text-gray-800">Panel del Mapa</span>
                    {loadingDB && <span className="ml-auto text-xs text-gray-400 animate-pulse">Actualizando…</span>}
                    {!loadingDB && (
                        <button onClick={fetchDB} title="Actualizar datos" className="ml-auto text-gray-300 hover:text-blue-500 text-base transition">↻</button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                    {sidebarContent}
                </div>
            </aside>

            <div className="flex-1 relative overflow-hidden" style={{ minHeight: isMobile ? '60vh' : undefined }}>
                {mapContent}

                {isMobile && sidebarOpen && (
                    <>
                        <div onClick={() => setSidebarOpen(false)}
                            className="absolute inset-0 z-[900] bg-black/40 backdrop-blur-sm" />
                        <div className="absolute bottom-0 left-0 right-0 z-[950] bg-white rounded-t-2xl shadow-2xl flex flex-col"
                            style={{ maxHeight: '70vh' }}>
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
                                <span className="font-bold text-sm text-gray-800">Panel del Mapa</span>
                                <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                            </div>
                            <div className="flex-1 overflow-y-auto bg-gray-50" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                                {sidebarContent}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default MapComponent;